import { describe, expect, it } from "vitest";
import { tileDensity } from "../lib/texture-repeat";

describe("physical texture repeats", () => {
  it("converts centimeters per tile to tiles per meter", () => {
    expect(tileDensity(12.5)).toBe(8);
    expect(tileDensity(5)).toBe(20);
    expect(tileDensity(25)).toBe(4);
  });
  it("keeps invalid or out-of-range repeats finite", () => {
    expect(tileDensity(0)).toBe(20);
    expect(tileDensity(100)).toBe(4);
    expect(tileDensity(Number.NaN)).toBe(8);
  });
});