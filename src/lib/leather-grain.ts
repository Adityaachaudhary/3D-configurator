/** Approximately forty irregular pebbles across one physical texture tile. */
const CELLS_PER_TILE = 40;
const wrapCell = (cell: number) => ((cell % CELLS_PER_TILE) + CELLS_PER_TILE) % CELLS_PER_TILE;

function cellNoise(x: number, y: number, seed: number) {
  const value = Math.sin(wrapCell(x) * 127.1 + wrapCell(y) * 311.7 + seed * 74.7) * 43758.5453;
  return value - Math.floor(value);
}

/** Deterministic tileable Voronoi domes with narrow creases; pure CPU data. */
export function leatherHeightField(size: number): Float32Array {
  if (!Number.isInteger(size) || size < 1) throw new RangeError("Leather grain size must be a positive integer");
  const field = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const py = y / size * CELLS_PER_TILE;
    for (let x = 0; x < size; x++) {
      const px = x / size * CELLS_PER_TILE;
      const cx = Math.floor(px), cy = Math.floor(py);
      let nearest = Infinity, second = Infinity, variation = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const gx = cx + dx, gy = cy + dy;
        const sx = gx + 0.2 + cellNoise(gx, gy, 1) * 0.6;
        const sy = gy + 0.2 + cellNoise(gx, gy, 2) * 0.6;
        const distance = Math.hypot(px - sx, py - sy);
        if (distance < nearest) {
          second = nearest;
          nearest = distance;
          variation = cellNoise(gx, gy, 3);
        } else if (distance < second) second = distance;
      }
      const dome = 1 - Math.exp(-Math.max(0, second - nearest) * 12);
      const u = x / size * Math.PI * 2, v = y / size * Math.PI * 2;
      const pores = Math.sin(u * 173 + Math.sin(v * 91)) * Math.sin(v * 167 + Math.cos(u * 71));
      field[y * size + x] = Math.max(0, Math.min(1, dome * (0.86 + variation * 0.12) + pores * 0.018));
    }
  }
  return field;
}