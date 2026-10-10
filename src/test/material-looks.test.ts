import { describe, expect, it } from "vitest";
import { Color, MeshPhysicalMaterial } from "three";
import { applyLook, resolveLook, tileFor, LIGHTING, RELIEF } from "../lib/material-looks";

describe("per-fabric material looks", () => {
  it("uses supplied per-fabric tiles and falls back for unknown fabrics", () => {
    for (const [id, tile] of Object.entries({ oat: 10, pearl: 8, wisdom: 12, clay: 8, moss: 8, ink: 8, "ochre-chevron": 6, "orange-pattern": 8, "red-fish": 6, "swatch-urban": 8, "cognac-leather": 20, "charcoal-leather": 20, "olive-leather": 20, "ivory-leather": 20, "chesterfield-oxblood": 20, "chesterfield-saddle": 20 })) expect(tileFor(id, 12.5)).toBe(tile);
    expect(tileFor("unknown", 7)).toBe(7);
  });
  it("preserves fixed product exposure", () => {
    expect(LIGHTING.exposure).toBe(1.15);
    expect(LIGHTING.ambient).toBe(0.12);
    expect(LIGHTING.directional).toEqual({ position: [-4, 2.4, 1.8], intensity: 1.1 });
    expect(LIGHTING.environmentIntensity).toBe(1);
    expect(LIGHTING.envBase).toBe(0.22);
    expect(LIGHTING.key).toEqual({ position: [-5, 2.5, 2.5], intensity: 2.6, scale: [6, 4, 1] });
    expect(LIGHTING.fill).toEqual({ position: [4, 2, 3], intensity: 1, scale: [6, 4, 1] });
    expect(LIGHTING.rim).toEqual({ position: [1, 4, -4], intensity: 0.9, scale: [5, 3, 1] });
  });
  it("preserves the fixed Chesterfield relief constants", () => {
    expect(RELIEF.recess).toBe(0.003);
    expect(RELIEF.normalHeight).toBe(0.065);
    expect(RELIEF.grainNormal).toBe(0.0012);
    expect(RELIEF.seamShadeMin + RELIEF.seamShadeRange).toBe(1);
  });
  it("applies the supplied Ink Velvet sheen and softening", () => {
    const base = new Color("#34383b");
    const material = new MeshPhysicalMaterial();
    const look = resolveLook("ink", "velvet");
    applyLook(material, look, base, false);
    expect(look.sheenTint).toBe(0.14);
    expect(material.sheenColor.r).toBeCloseTo(base.r + (1 - base.r) * 0.14);
    expect(look.normalSoften).toBe(0.35);
    expect(look.roughness).toBe(0.85);
    expect(look.sheen).toBe(1);
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
  it("applies supplied ordinary leather grain and softening", () => {
    for (const id of ["cognac-leather", "charcoal-leather", "olive-leather"]) {
      const look = resolveLook(id, "leather");
      expect(look.bumpScale).toBe(id === "charcoal-leather" ? 0.0008 : 0.0012);
      expect(look.normalSoften).toBe(0.45);
    }
  });
  it("preserves Chesterfield relief and the shader hook", () => {
    const look = resolveLook("chesterfield-saddle", "leather", true);
    expect(look.bumpScale).toBe(0.024);
    expect(look.clearcoat).toBe(0.06);
    expect(look.normalSoften).toBe(0.3);
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
