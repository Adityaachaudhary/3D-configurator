import * as THREE from "three";

// One "look" = every number that decides how a fabric reacts to light.
// Prototype: hardcoded below. Real configurator: the SAME fields become columns
// on the dashboard's materials table, edited with a live preview.

export type LookFamily = "woven" | "velvet" | "leather";
/** Backwards-compatible alias for the configurator imports. */
export type UpholsteryFamily = LookFamily;

export type MaterialLook = {
  roughness: number;
  sheen: number;
  sheenRoughness: number;
  /**
   * 0..1: how far sheenColor is pushed toward white. THREE.Color.lerp works in
   * LINEAR space, so 0.35 on a dark fabric is a very bright sheen (that is what
   * washed Ink Velvet to grey). Keep it small for dark colours.
   */
  sheenTint: number;
  /**
   * Patterns and photo fabrics use a white base colour (the texture carries the
   * colour), so a base-derived sheenColor would be white. They use this linear
   * grey instead.
   */
  sheenGrey: number;
  clearcoat: number;
  clearcoatRoughness: number;
  specularIntensity: number;
  bumpScale: number;
};

const DEFAULTS: Record<LookFamily, MaterialLook> = {
  woven: {
    roughness: 0.96, sheen: 0.35, sheenRoughness: 0.55, sheenTint: 0.12, sheenGrey: 0.25,
    clearcoat: 0, clearcoatRoughness: 0.35, specularIntensity: 1, bumpScale: 0.00009,
  },
  velvet: {
    roughness: 0.9, sheen: 0.8, sheenRoughness: 0.35, sheenTint: 0.05, sheenGrey: 0.25,
    clearcoat: 0, clearcoatRoughness: 0.35, specularIntensity: 1, bumpScale: 0.00004,
  },
  leather: {
    // bumpScale is for the new Voronoi grain (3 mm cells). The old sine grain
    // used 0.00045; the new one is much steeper per unit height, so start low.
    roughness: 0.56, sheen: 0, sheenRoughness: 0.5, sheenTint: 0, sheenGrey: 0.25,
    clearcoat: 0.05, clearcoatRoughness: 0.4, specularIntensity: 0.55, bumpScale: 0.0001,
  },
};

// Chesterfield = leather + tufts. bumpScale is not used by the analytic tuft
// normals but is kept for the swatch/grain path.
const TUFTED: Partial<MaterialLook> = { clearcoat: 0.04, bumpScale: 0.024 };

// Starting points, tune by eye with the live panel (dev-tuning.tsx).
const PATTERN: Partial<MaterialLook> = { sheen: 0.2, sheenRoughness: 0.6, sheenGrey: 0.25 };

const OVERRIDES: Record<string, Partial<MaterialLook>> = {
  // Solids
  oat: { roughness: 0.98, sheen: 0.3, sheenRoughness: 0.6, sheenTint: 0.15, bumpScale: 0.00018 },
  wisdom: { ...PATTERN },
  clay: { roughness: 0.93, sheen: 0.35, sheenTint: 0.15 },
  forest: { roughness: 0.97, sheen: 0.5, sheenTint: 0.12, bumpScale: 0.00018 },
  ink: { roughness: 0.88, sheen: 0.8, sheenRoughness: 0.35, sheenTint: 0.04 },

  // Patterns / photo fabrics (white base colour)
  "olive-check": { ...PATTERN },
  "ochre-chevron": { ...PATTERN },
  "red-fish": { ...PATTERN },
  "orange-pattern": { ...PATTERN },
  "swatch-urban": { roughness: 1, sheen: 0.5, sheenRoughness: 0.62, sheenGrey: 0.4, bumpScale: 0.0011 },

  // Leather: darker leathers read glossier, so give them a touch more roughness.
  "cognac-leather": { roughness: 0.55 },
  "charcoal-leather": { roughness: 0.62, specularIntensity: 0.45 },
  "olive-leather": { roughness: 0.58, specularIntensity: 0.5 },
  "chesterfield-oxblood": { roughness: 0.58, specularIntensity: 0.5 },
  "chesterfield-saddle": { roughness: 0.55 },
};

export function resolveLook(id: string, family: LookFamily, tufted = false): MaterialLook {
  return { ...DEFAULTS[family], ...(tufted ? TUFTED : {}), ...(OVERRIDES[id] ?? {}) };
}

const WHITE = new THREE.Color(1, 1, 1);

/** Applies a look to an upholstery material. Safe to call repeatedly (live tuning). */
export function applyLook(
  material: THREE.MeshPhysicalMaterial,
  look: MaterialLook,
  baseColor: THREE.Color,
  whiteBase: boolean,
) {
  material.roughness = look.roughness;
  material.sheen = look.sheen;
  material.sheenRoughness = look.sheenRoughness;
  if (whiteBase) material.sheenColor.setScalar(look.sheenGrey);
  else material.sheenColor.copy(baseColor).lerp(WHITE, look.sheenTint);
  material.clearcoat = look.clearcoat;
  material.clearcoatRoughness = look.clearcoatRoughness;
  material.specularIntensity = look.specularIntensity;
  material.bumpScale = look.bumpScale;
}
