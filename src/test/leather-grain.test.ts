import { describe, expect, it } from "vitest";
import { leatherHeightField } from "../lib/leather-grain";

describe("real leather grain", () => {
  it("generates deterministic 512px bounded relief with distinct creases and crowns", () => {
    const field = leatherHeightField(512);
    expect(field.length).toBe(512 * 512);
    expect(field).toEqual(leatherHeightField(512));
    let low = 1, high = 0;
    for (const height of field) {
      expect(Number.isFinite(height)).toBe(true);
      low = Math.min(low, height);
      high = Math.max(high, height);
    }
    expect(low).toBeGreaterThanOrEqual(0);
    expect(high).toBeLessThanOrEqual(1);
    expect(low).toBeLessThan(0.05);
    expect(high).toBeGreaterThan(0.85);
  }, 20000);
  it("wraps both tile edges without a larger jump than neighbouring interior samples", () => {
    const size = 512, field = leatherHeightField(size);
    let seam = 0, interior = 0;
    for (let n = 0; n < size; n++) {
      seam += Math.abs((field[n * size] ?? 0) - (field[n * size + size - 1] ?? 0));
      seam += Math.abs((field[n] ?? 0) - (field[(size - 1) * size + n] ?? 0));
      interior += Math.abs((field[n * size + 1] ?? 0) - (field[n * size] ?? 0));
      interior += Math.abs((field[size + n] ?? 0) - (field[n] ?? 0));
    }
    // Steep crease walls vary substantially over a pixel; wrapping must be
    // comparable to ordinary adjacent pixels, not artificially flattened.
    expect(seam / (2 * size)).toBeLessThan(0.3);
    expect(seam).toBeLessThan(interior * 1.25);
  }, 20000);
  it("rejects invalid map dimensions", () => {
    for (const size of [0, -1, 1.5, NaN]) expect(() => leatherHeightField(size)).toThrow(RangeError);
  }, 20000);
});