import { describe, expect, it } from "vitest";
import { materialRecipe } from "../lib/material-recipes";

describe("client physical material recipes", () => {
  it("keeps woven fabric matte with soft tinted sheen", () => {
    const recipe = materialRecipe("woven");
    expect(recipe.roughness).toBeGreaterThanOrEqual(0.9);
    expect(recipe.roughness).toBeLessThanOrEqual(1);
    expect(recipe.sheen).toBeGreaterThanOrEqual(0.5);
    expect(recipe.sheen).toBeLessThanOrEqual(1);
    expect(recipe.sheenRoughness).toBe(0.5);
  });
  it("gives velvet full sheen with a soft edge glow", () => {
    const recipe = materialRecipe("velvet");
    expect(recipe.roughness).toBeGreaterThanOrEqual(0.8);
    expect(recipe.roughness).toBeLessThanOrEqual(1);
    expect(recipe.sheen).toBe(1);
    expect(recipe.sheenRoughness).toBeGreaterThanOrEqual(0.3);
    expect(recipe.sheenRoughness).toBeLessThanOrEqual(0.5);
  });
  it("keeps ordinary and tufted leather rougher with restrained coating", () => {
    for (const tufted of [false, true]) {
      const recipe = materialRecipe("leather", tufted);
      expect(recipe.roughness).toBeGreaterThanOrEqual(0.45);
      expect(recipe.roughness).toBeLessThanOrEqual(0.6);
      expect(recipe.clearcoat).toBeGreaterThanOrEqual(0);
      expect(recipe.clearcoat).toBeLessThanOrEqual(0.15);
      expect(recipe.clearcoatRoughness).toBe(0.35);
      expect(recipe.specularIntensity).toBe(0.6);
      expect(recipe.sheen).toBe(0);
    }
  });
  it("keeps wood legs matte with only a tiny clearcoat", () => {
    const recipe = materialRecipe("wood");
    expect(recipe.roughness).toBeGreaterThanOrEqual(0.5);
    expect(recipe.roughness).toBeLessThanOrEqual(0.6);
    expect(recipe.clearcoat).toBe(0.025);
    expect(recipe.metalness).toBe(0);
  });
});