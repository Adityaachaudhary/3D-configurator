// Tileable Worley (cellular) leather grain.
//
// Real leather grain is irregular polygonal cells separated by fine creases.
// The old generator used a product of sines, which makes a regular lattice and
// reads as "plastic with a pattern". This returns a height field in 0..1:
// ~0 on the creases, ~1 on the cell domes, with a small per-cell height variation.
//
// `cells` = cells per tile edge. With the default 12.5 cm tile and cells = 40
// the average cell is ~3 mm, which is realistic for fine-grain leather.
// Wrapping is handled, so the texture tiles seamlessly.

const smoothstep = (x: number, a: number, b: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Small deterministic hash so the grain is identical on every load.
const rnd = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

export function leatherHeightField(size: number, cells = 40): Float32Array {
  if (!Number.isInteger(size) || size < 1) throw new RangeError("Leather grain size must be a positive integer");
  if (!Number.isInteger(cells) || cells < 1) throw new RangeError("Leather grain cells must be a positive integer");
  const pts = new Float32Array(cells * cells * 3); // x, y, per-cell random
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      const id = j * cells + i;
      const k = id * 3;
      pts[k] = i + 0.15 + 0.7 * rnd(id * 2 + 1);
      pts[k + 1] = j + 0.15 + 0.7 * rnd(id * 2 + 2);
      pts[k + 2] = rnd(id + 99);
    }
  }

  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = (x / size) * cells;
      const gy = (y / size) * cells;
      const ci = Math.floor(gx);
      const cj = Math.floor(gy);
      let f1 = 9;
      let f2 = 9;
      let r1 = 0;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const wi = (ci + di + cells) % cells;
          const wj = (cj + dj + cells) % cells;
          const k = (wj * cells + wi) * 3;
          // Shift the point by the wrap amount so neighbours across the tile edge line up.
          const px = (pts[k] ?? 0) + (ci + di - wi);
          const py = (pts[k + 1] ?? 0) + (cj + dj - wj);
          const d = Math.hypot(px - gx, py - gy);
          if (d < f1) {
            f2 = f1;
            f1 = d;
            r1 = pts[k + 2] ?? 0;
          } else if (d < f2) {
            f2 = d;
          }
        }
      }
      // F2 - F1 is 0 on cell borders and grows toward the cell centre.
      const dome = smoothstep(f2 - f1, 0, 0.45);
      out[y * size + x] = dome * (0.8 + 0.2 * r1);
    }
  }
  return out;
}
