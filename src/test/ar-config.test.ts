import { describe, expect, it } from "vitest";
import { arEligible, arScale, buildARUrl, isARFloor, readARConfiguration } from "@/lib/ar-config";
describe("Android AR rules", () => {
  it("permits only the two-seater", () => { expect([1, 2, 3].map(arEligible)).toEqual([false, true, false]); });
  it("shares finishes and density without a seating or scale override", () => {
    const url = buildARUrl("https://panache.example/?seats=3", { fabric: "wisdom", leg: "steel", tile: 12.5 });
    expect(readARConfiguration(new URL(url).search)).toEqual({ fabric: "wisdom", leg: "steel", tile: 12.5 });
    expect(new URL(url).searchParams.has("seats")).toBe(false);
    expect(new URL(url).searchParams.has("scale")).toBe(false);
  });
  it("allows pinch resizing", () => { expect(arScale(0.1)).toBe(0.3); expect(arScale(4)).toBe(3); expect(arScale(1)).toBe(1); });
  it("rejects elevated surfaces and walls", () => {
    const floor = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
    expect(isARFloor(floor)).toBe(true);
    expect(isARFloor(floor.map((v,i) => i === 13 ? 0.8 : v))).toBe(false);
    expect(isARFloor(floor.map((v,i) => i === 5 ? 0 : v))).toBe(false);
  });
});