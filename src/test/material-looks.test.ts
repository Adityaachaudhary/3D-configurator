import { describe, expect, it } from "vitest";
import { Color, MeshPhysicalMaterial, SRGBColorSpace } from "three";
import { applyLook, resolveLook } from "../lib/material-looks";

describe("per-fabric material looks", () => {
  it("keeps Ink Velvet sheen base-tinted without mixing in linear white", () => {
    const base = new Color("#34383b");
    const material = new MeshPhysicalMaterial();
    applyLook(material, resolveLook("ink", "velvet"), base, false);
    expect(material.sheenColor.r).toBeCloseTo(base.r * 1.1);
    expect(material.sheenColor.g).toBeCloseTo(base.g * 1.1);
    expect(material.sheenColor.b).toBeCloseTo(base.b * 1.1);
    expect(material.sheenColor.r).toBeLessThan(0.05);
    expect(base.getHexString()).toBe("34383b");
    material.dispose();
  });
  it("uses calibrated sRGB grey rather than white sheen for photos and patterns", () => {
    for (const id of ["wisdom", "red-fish", "orange-pattern", "ochre-chevron", "swatch-urban"]) {
      const look = resolveLook(id, "woven");
      const material = new MeshPhysicalMaterial();
      applyLook(material, look, new Color(1, 1, 1), true);
      expect(material.sheenColor.equals(new Color().setRGB(look.sheenGrey, look.sheenGrey, look.sheenGrey, SRGBColorSpace))).toBe(true);
      expect(material.sheenColor.r).toBeLessThan(0.05);
      material.dispose();
    }
  });
  it("moves Swatch Urban's tweed recipe to its per-fabric override", () => {
    const look = resolveLook("swatch-urban", "woven");
    expect(look.roughness).toBe(1);
    expect(look.sheen).toBe(0.5);
    expect(look.sheenRoughness).toBe(0.62);
    expect(look.bumpScale).toBe(0.0011);
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