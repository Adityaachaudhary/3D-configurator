import { describe, expect, it } from "vitest";
import { Color, MeshPhysicalMaterial } from "three";
import { applyLook, resolveLook, tileFor, LIGHTING, RELIEF } from "../lib/material-looks";

describe("per-fabric material looks", () => {
  it("uses the existing tile size when a fabric has no supplied tile override", () => {
    expect(tileFor("orange-pattern", 12.5)).toBe(12.5);
    expect(tileFor("unknown", 7)).toBe(7);
  });
  it("preserves fixed product exposure", () => {
    expect(LIGHTING.exposure).toBe(1);
  });
  it("preserves the fixed Chesterfield relief constants", () => {
    expect(RELIEF.recess).toBe(0.0015);
    expect(RELIEF.normalHeight).toBe(0.042);
    expect(RELIEF.grainNormal).toBe(0.00045);
    expect(RELIEF.seamShadeMin + RELIEF.seamShadeRange).toBe(1);
  });
  it("keeps Ink Velvet sheen nearly base-coloured with only a small linear lerp toward white", () => {
    const base = new Color("#34383b");
    const material = new MeshPhysicalMaterial();
    const look = resolveLook("ink", "velvet");
    applyLook(material, look, base, false);
    expect(look.sheenTint).toBe(0.04);
    expect(material.sheenColor.r).toBeCloseTo(base.r + (1 - base.r) * 0.04);
    expect(material.sheenColor.r).toBeLessThan(0.1);
    expect(base.getHexString()).toBe("34383b");
    material.dispose();
  });
  it("uses a linear grey sheen for white-base photo and pattern fabrics", () => {
    for (const id of ["wisdom", "red-fish", "orange-pattern", "ochre-chevron", "swatch-urban"]) {
      const look = resolveLook(id, "woven");
      const material = new MeshPhysicalMaterial();
      applyLook(material, look, new Color(1, 1, 1), true);
      expect(material.sheenColor.r).toBeCloseTo(look.sheenGrey);
      expect(material.sheenColor.g).toBeCloseTo(look.sheenGrey);
      expect(material.sheenColor.b).toBeCloseTo(look.sheenGrey);
      material.dispose();
    }
  });
  it("keeps Swatch Urban's tweed recipe in its per-fabric override", () => {
    const look = resolveLook("swatch-urban", "woven");
    expect(look.roughness).toBe(1);
    expect(look.sheen).toBe(0.5);
    expect(look.sheenRoughness).toBe(0.62);
    expect(look.bumpScale).toBe(0.0011);
    expect(look.sheenGrey).toBe(0.4);
  });
  it("starts steeper ordinary leather grain at 0.0001 bump depth", () => {
    for (const id of ["cognac-leather", "charcoal-leather", "olive-leather"]) {
      expect(resolveLook(id, "leather").bumpScale).toBe(0.0001);
    }
  });
  it("preserves Chesterfield relief and the shader hook", () => {
    const look = resolveLook("chesterfield-saddle", "leather", true);
    expect(look.bumpScale).toBe(0.024);
    expect(look.clearcoat).toBe(0.04);
    const material = new MeshPhysicalMaterial();
    const hook = material.onBeforeCompile;
    applyLook(material, look, new Color("#653922"), false);
    expect(material.onBeforeCompile).toBe(hook);
    const clone = material.clone();
    expect(clone.bumpScale).toBe(0.024);
    expect(clone.sheenColor.equals(material.sheenColor)).toBe(true);
    clone.dispose();
    material.dispose();
  });
});
