import * as THREE from "three";

// v3: PROTOTYPE, everything hardcoded in this one file. No sliders, no leva.
// Three blocks you may ever edit: LIGHTING, RELIEF, and OVERRIDES / TILE_CM.
// For the real configurator, the per-fabric fields become backend columns.

type V3 = [number, number, number];

// ---------------------------------------------------------------------------
// 1) LIGHTING: one studio setup, used by static-light-rig.tsx
// ---------------------------------------------------------------------------
// The key light is LOW and from the side ("raking light"). Light that skims a
// surface throws long shadows from every grain/pleat, which is what makes bump
// and padding read. Light from above/front (the old setup) flattens relief.
export const LIGHTING = {
  exposure: 1.15,
  ambient: 0.12,
  directional: { position: [-4, 2.4, 1.8] as V3, intensity: 1.1 },
  environmentIntensity: 1,
  /** Dim uniform fill (linear grey) inside the environment so no direction is pitch black. */
  envBase: 0.22,
  key: { position: [-5, 2.5, 2.5] as V3, intensity: 2.6, scale: [6, 4, 1] as V3 },
  fill: { position: [4, 2, 3] as V3, intensity: 1.0, scale: [6, 4, 1] as V3 },
  rim: { position: [1, 4, -4] as V3, intensity: 0.9, scale: [5, 3, 1] as V3 },
};

// ---------------------------------------------------------------------------
// 2) RELIEF: Chesterfield depth/padding knobs (used inside the tuft shader)
// ---------------------------------------------------------------------------
export const RELIEF = {
  /** Seam/pocket darkening: colour *= seamShadeMin + seamShadeRange * profile. Lower min = deeper pockets. */
  seamShadeMin: 0.55,
  seamShadeRange: 0.45,
  /** Height of the padding in metres for the analytic normals (was 0.042). Bigger = puffier. */
  normalHeight: 0.065,
  /** Vertex recess of seams/buttons in metres (was 0.0015). Keep <= 0.004 or the silhouette wobbles. */
  recess: 0.003,
  /** Leather grain contribution inside the tuft normal chunk (was 0.00045). */
  grainNormal: 0.0012,
};

// ---------------------------------------------------------------------------
// 3) Per-fabric looks
// ---------------------------------------------------------------------------
export type LookFamily = "woven" | "velvet" | "leather";

export type MaterialLook = {
  roughness: number;
  sheen: number;
  sheenRoughness: number;
  /** 0..1, pushes sheenColor toward white in LINEAR space. Small for dark colours. */
  sheenTint: number;
  /** Patterns/photos have a white base colour, so they use this linear grey for sheen. */
  sheenGrey: number;
  clearcoat: number;
  clearcoatRoughness: number;
  specularIntensity: number;
  bumpScale: number;
  /** 0..1 blend of the shading normal toward the smoothed panel normal (vertex shader). */
  normalSoften: number;
};

const DEFAULTS: Record<LookFamily, MaterialLook> = {
  woven: {
    roughness: 0.96, sheen: 0.35, sheenRoughness: 0.55, sheenTint: 0.12, sheenGrey: 0.25,
    clearcoat: 0, clearcoatRoughness: 0.35, specularIntensity: 1, bumpScale: 0.0006, normalSoften: 0.15,
  },
  velvet: {
    roughness: 0.85, sheen: 1, sheenRoughness: 0.3, sheenTint: 0.14, sheenGrey: 0.25,
    clearcoat: 0, clearcoatRoughness: 0.35, specularIntensity: 1, bumpScale: 0.00008, normalSoften: 0.35,
  },
  leather: {
    roughness: 0.5, sheen: 0, sheenRoughness: 0.5, sheenTint: 0, sheenGrey: 0.25,
    clearcoat: 0.04, clearcoatRoughness: 0.4, specularIntensity: 0.6, bumpScale: 0.0012, normalSoften: 0.45,
  },
};

// Chesterfield = leather + tufts. bumpScale is unused by the analytic tuft normals.
const TUFTED: Partial<MaterialLook> = { clearcoat: 0.06, bumpScale: 0.024, normalSoften: 0.3 };

// Patterns and photo fabrics (white base colour; the texture carries the colour).
const PATTERN: Partial<MaterialLook> = { sheen: 0.2, sheenRoughness: 0.6, sheenGrey: 0.25, bumpScale: 0.0002 };

const OVERRIDES: Record<string, Partial<MaterialLook>> = {
  // Solids
  oat: { roughness: 1, sheen: 0.3, sheenRoughness: 0.6, sheenTint: 0.15, bumpScale: 0.0012, normalSoften: 0.1 },
  pearl: { sheen: 0.25, sheenTint: 0.08, bumpScale: 0.0007 },
  wisdom: { ...PATTERN },
  clay: { roughness: 0.93, sheen: 0.35, sheenTint: 0.15, bumpScale: 0.0008 },
  moss: { roughness: 0.95, sheen: 0.7, sheenRoughness: 0.45, sheenTint: 0.2, bumpScale: 0.0009 },
  ink: { roughness: 0.85, sheen: 1, sheenRoughness: 0.3, sheenTint: 0.14 },

  // Patterns / photo fabrics
  "ochre-chevron": { ...PATTERN },
  "orange-pattern": { ...PATTERN },
  "red-fish": { ...PATTERN },
  "swatch-urban": { roughness: 1, sheen: 0.5, sheenRoughness: 0.62, sheenGrey: 0.4, bumpScale: 0.0011 },

  // Leather: dark leathers read their form through reflections, so they get
  // LOWER roughness and MORE specular than light ones.
  "cognac-leather": { roughness: 0.5, specularIntensity: 0.6, clearcoat: 0.03 },
  "charcoal-leather": { roughness: 0.45, specularIntensity: 0.85, clearcoat: 0.12, clearcoatRoughness: 0.3, bumpScale: 0.0008 },
  "olive-leather": { roughness: 0.5, specularIntensity: 0.65, clearcoat: 0.05 },
  "ivory-leather": { roughness: 0.55, specularIntensity: 0.6 },
  "chesterfield-oxblood": { roughness: 0.46, specularIntensity: 0.75, clearcoat: 0.1 },
  "chesterfield-saddle": { roughness: 0.5, specularIntensity: 0.65, clearcoat: 0.06 },
};

export function resolveLook(id: string, family: LookFamily, tufted = false): MaterialLook {
  return { ...DEFAULTS[family], ...(tufted ? TUFTED : {}), ...(OVERRIDES[id] ?? {}) };
}

// Default texture tile (cm), applied when a fabric is selected.
// Leather grain = 40 cells per tile: 20 cm gives ~5 mm cells. Anything under
// ~4 mm is smaller than a pixel at normal framing and simply vanishes.
const TILE_CM: Record<string, number> = {
  oat: 10, pearl: 8, wisdom: 12, clay: 8, moss: 8, ink: 8,
  "ochre-chevron": 6, "orange-pattern": 8, "red-fish": 6, "swatch-urban": 8,
  "cognac-leather": 20, "charcoal-leather": 20, "olive-leather": 20, "ivory-leather": 20,
  "chesterfield-oxblood": 20, "chesterfield-saddle": 20,
};
export const tileFor = (id: string, fallback: number) => TILE_CM[id] ?? fallback;

const WHITE = new THREE.Color(1, 1, 1);

/** Applies a look to an upholstery material. */
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