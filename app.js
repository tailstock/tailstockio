/* ------------------------------------------------------------------
   Tailstock — 1-bit dithered flowing background
   A soft plasma/flow field is rendered to a low-res buffer, then
   quantized to pure black & white using an 8x8 Bayer ordered-dither
   matrix. Nearest-neighbour upscaling gives it the chunky 1-bit look.
   ------------------------------------------------------------------ */
(() => {
  const canvas = document.getElementById("dither");
  const ctx = canvas.getContext("2d", { willReadFrequently: false });

  // Size of a single dithered "pixel" on screen. Bigger = chunkier + faster.
  const PIXEL = 4;

  // 8x8 Bayer matrix, normalized to thresholds in [0, 1).
  const BAYER = [
    0, 32, 8, 40, 2, 34, 10, 42,
    48, 16, 56, 24, 50, 18, 58, 26,
    12, 44, 4, 36, 14, 46, 6, 38,
    60, 28, 52, 20, 62, 30, 54, 22,
    3, 35, 11, 43, 1, 33, 9, 41,
    51, 19, 59, 27, 49, 17, 57, 25,
    15, 47, 7, 39, 13, 45, 5, 37,
    63, 31, 55, 23, 61, 29, 53, 21,
  ].map((v) => (v + 0.5) / 64);

  let cols, rows, buffer;
  const pointer = { x: 0.5, y: 0.5, active: 0 };

  function resize() {
    cols = Math.ceil(window.innerWidth / PIXEL);
    rows = Math.ceil(window.innerHeight / PIXEL);
    canvas.width = cols;
    canvas.height = rows;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    buffer = ctx.createImageData(cols, rows);
  }

  // Flowing scalar field -> value in [0, 1].
  function field(x, y, t) {
    // Normalized coords, aspect-corrected.
    const nx = x / cols;
    const ny = y / rows;
    const ax = nx * 6.0;
    const ay = ny * 6.0;

    let v =
      Math.sin(ax + t) +
      Math.sin(ay * 1.3 - t * 0.8) +
      Math.sin((ax + ay) * 0.7 + t * 0.6) +
      Math.sin(Math.hypot(ax - 3, ay - 3) * 1.6 - t * 1.4);

    // Pointer ripple — soft interactive swell around the cursor.
    if (pointer.active > 0) {
      const dx = nx - pointer.x;
      const dy = ny - pointer.y;
      const d = Math.hypot(dx, dy) * 10;
      v += Math.sin(d - t * 3) * (2.2 / (1 + d)) * pointer.active;
    }

    // Map roughly [-4, 4] -> [0, 1].
    return v * 0.125 + 0.5;
  }

  function render(t) {
    const data = buffer.data;
    let i = 0;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const val = field(x, y, t);
        const threshold = BAYER[(y & 7) * 8 + (x & 7)];
        const on = val > threshold ? 255 : 0;
        data[i] = on;
        data[i + 1] = on;
        data[i + 2] = on;
        data[i + 3] = 255;
        i += 4;
      }
    }
    ctx.putImageData(buffer, 0, 0);
  }

  let start = null;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function loop(now) {
    if (start === null) start = now;
    const t = (now - start) / 1000;

    // Ease the pointer influence back down when idle.
    pointer.active *= 0.96;

    render(t * 0.6);
    if (!reduced) requestAnimationFrame(loop);
  }

  // --- Interaction ---
  function movePointer(clientX, clientY) {
    pointer.x = clientX / window.innerWidth;
    pointer.y = clientY / window.innerHeight;
    pointer.active = 1;
  }

  window.addEventListener("pointermove", (e) => movePointer(e.clientX, e.clientY));
  window.addEventListener(
    "touchmove",
    (e) => {
      const tch = e.touches[0];
      if (tch) movePointer(tch.clientX, tch.clientY);
    },
    { passive: true }
  );

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  });

  resize();
  if (reduced) {
    render(0); // single static frame
  } else {
    requestAnimationFrame(loop);
  }

  // Footer year
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
