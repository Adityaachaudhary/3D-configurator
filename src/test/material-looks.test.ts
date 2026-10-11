import { describe, expect, it } from "vitest";
import { Color, MeshPhysicalMaterial } from "three";
import { applyLook, resolveLook, tileFor, LIGHTING, RELIEF, MIN_LEATHER_TILE_CM, LEG_BUMP } from "../lib/material-looks";

describe("per-fabric material looks", () => {
  it("uses supplied per-fabric tiles and falls back for unknown fabrics", () => {
    for (const [id, tile] of Object.entries({ oat: 10, wisdom: 12, clay: 8, moss: 8, ink: 8, "orange-pattern": 8, "red-fish": 6, "swatch-urban": 8, "cognac-leather": 20, "charcoal-leather": 20, "olive-leather": 20, "chesterfield-oxblood": 20, "chesterfield-saddle": 20 })) expect(tileFor(id, 12.5)).toBe(tile);
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
    expect(RELIEF.recess).toBe(0.004);
    expect(RELIEF.normalHeight).toBe(0.085);
    expect(RELIEF.grainNormal).toBe(0.0004);
    expect(RELIEF.seamShadeMin).toBe(0.45);
    expect(RELIEF.seamShadeRange).toBe(0.55);
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
    for (const id of ["wisdom", "red-fish", "orange-pattern", "swatch-urban"]) {
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
    expect(look.bumpScale).toBe(1.2);
    expect(look.sheenGrey).toBe(0.4);
  });
  it("applies supplied ordinary leather grain and softening", () => {
    for (const id of ["cognac-leather", "charcoal-leather", "olive-leather"]) {
      const look = resolveLook(id, "leather");
      expect(look.bumpScale).toBe(id === "charcoal-leather" ? 0.8 : 1);
      expect(look.normalSoften).toBe(0.45);
    }
  });
  it("preserves Chesterfield relief and the shader hook", () => {
    const look = resolveLook("chesterfield-saddle", "leather", true);
    expect(look.bumpScale).toBe(0);
    expect(look.clearcoat).toBe(0.02);
    expect(look.normalSoften).toBe(0.3);
    const material = new MeshPhysicalMaterial();
    const hook = material.onBeforeCompile;
    applyLook(material, look, new Color("#653922"), false);
    expect(material.onBeforeCompile).toBe(hook);
    const clone = material.clone();
    expect(clone.bumpScale).toBe(0);
    expect(clone.sheenColor.equals(material.sheenColor)).toBe(true);
    clone.dispose();
    material.dispose();
  });
  it("uses the supplied woven bump strengths", () => {
    for (const [id, bump] of Object.entries({ oat: 2.5, clay: 2.2, moss: 2, wisdom: 1, "orange-pattern": 1, "red-fish": 1 })) {
      expect(resolveLook(id, "woven").bumpScale).toBe(bump);
    }
    expect(resolveLook("unknown", "woven").bumpScale).toBe(2);
  });
  it("disables velvet bump", () => {
    expect(resolveLook("ink", "velvet").bumpScale).toBe(0);
  });
  it("exports the supplied leather tile minimum", () => {
    expect(MIN_LEATHER_TILE_CM).toBe(14);
  });
  it("exports the supplied leg bump strengths", () => {
    expect(LEG_BUMP).toEqual({ wood: 0.6, steel: 0.2 });
  });
  it("uses the supplied duller Chesterfield finishes", () => {
    expect(resolveLook("chesterfield-oxblood", "leather", true)).toMatchObject({ roughness: 0.6, specularIntensity: 0.5, clearcoatRoughness: 0.5 });
    expect(resolveLook("chesterfield-saddle", "leather", true)).toMatchObject({ roughness: 0.62, specularIntensity: 0.5, clearcoatRoughness: 0.5 });
  });
});
