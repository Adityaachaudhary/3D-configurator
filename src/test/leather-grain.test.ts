import { describe, expect, it } from "vitest";
import { boucleHeightField, leatherHeightField } from "../lib/leather-grain";

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
});

describe("bouclé loops", () => {
  it("generates deterministic bounded domes with recessed gaps", () => {
    const field = boucleHeightField(256);
    expect(field.length).toBe(256 * 256);
    expect(field).toEqual(boucleHeightField(256));
    let low = 1, high = 0, raised = 0;
    for (const height of field) {
      expect(Number.isFinite(height)).toBe(true);
      low = Math.min(low, height);
      high = Math.max(high, height);
      if (height > 0.5) raised += 1;
    }
    expect(low).toBeGreaterThanOrEqual(0);
    expect(high).toBeLessThanOrEqual(1);
    // Each loop is a dome: dark gaps between clearly raised centres.
    expect(low).toBeLessThan(0.05);
    expect(high).toBeGreaterThan(0.85);
    // Loops cover most of the tile, so the fabric reads as packed pile, not dots.
    expect(raised / field.length).toBeGreaterThan(0.4);
  }, 20000);
  it("wraps both tile edges without a larger jump than neighbouring interior samples", () => {
    const size = 256, field = boucleHeightField(size);
    let seam = 0, interior = 0;
    for (let n = 0; n < size; n++) {
      seam += Math.abs((field[n * size] ?? 0) - (field[n * size + size - 1] ?? 0));
      seam += Math.abs((field[n] ?? 0) - (field[(size - 1) * size + n] ?? 0));
      interior += Math.abs((field[n * size + 1] ?? 0) - (field[n * size] ?? 0));
      interior += Math.abs((field[size + n] ?? 0) - (field[n] ?? 0));
    }
    expect(seam / (2 * size)).toBeLessThan(0.3);
    expect(seam).toBeLessThan(interior * 1.25);
  }, 20000);
});
