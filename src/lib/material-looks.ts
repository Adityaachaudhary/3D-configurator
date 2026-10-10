import { SRGBColorSpace, type Color, type MeshPhysicalMaterial } from "three";
import { materialRecipe } from "./material-recipes";

export type UpholsteryFamily = "woven" | "velvet" | "leather";
export type MaterialLook = ReturnType<typeof materialRecipe> & {
  bumpScale: number;
  /** sRGB grey for textured white-base materials. */
  sheenGrey: number;
  /** Scale the linear base hue without mixing in white. */
  sheenTint: number;
};

export const OVERRIDES: Readonly<Record<string, Partial<MaterialLook>>> = {
  oat: { bumpScale: 0.00018 },
  moss: { bumpScale: 0.00018 },
  ink: { bumpScale: 0.00004, sheenGrey: 0.08, sheenTint: 1.1 },
  wisdom: { sheenGrey: 0.2 },
  "red-fish": { sheenGrey: 0.2 },
  "orange-pattern": { sheenGrey: 0.2 },
  "ochre-chevron": { sheenGrey: 0.22 },
  "swatch-urban": {
    roughness: 1, sheen: 0.5, sheenRoughness: 0.62,
    bumpScale: 0.0011, sheenGrey: 0.24,
  },
};

export function resolveLook(id: string, family: UpholsteryFamily, tufted = false): MaterialLook {
  return {
    ...materialRecipe(family, tufted),
    bumpScale: tufted ? 0.024 : family === "leather" ? 0.0001 : family === "velvet" ? 0.00004 : 0.00009,
    sheenGrey: 0.22,
    sheenTint: 1.25,
    ...OVERRIDES[id],
  };
}

/** Leaves texture maps and shader hooks intact. */
export function applyLook(material: MeshPhysicalMaterial, look: MaterialLook, baseColor: Color, whiteBase: boolean) {
  const { sheenGrey, sheenTint, ...physical } = look;
  Object.assign(material, physical);
  material.sheenColor.copy(baseColor);
  if (whiteBase) material.sheenColor.setRGB(sheenGrey, sheenGrey, sheenGrey, SRGBColorSpace);
  else material.sheenColor.multiplyScalar(sheenTint);
  material.needsUpdate = true;
}