import * as THREE from "three";

// v4: PROTOTYPE, everything hardcoded in this one file.
//
// IMPORTANT CHANGE vs v3: bumpScale is now in three.js's real convention.
// three's bump shader measures the height change PER SCREEN PIXEL (0..1 height
// units) and multiplies by bumpScale, so a useful bumpScale is about 0.5 to 3.
// The old values (0.00009 to 0.0012) produced a surface tilt of ~0.0002, i.e. no
// bump at all; the relief you saw was only the dark/light painted into the
// colour map, which cannot react to the light and looks "reversed" from some
// directions. The new numbers were calibrated numerically for a target tilt of
// about 8 degrees at normal framing (see PATCH-NOTES-4).

type V3 = [number, number, number];

export const LIGHTING = {
  exposure: 1.15,
  ambient: 0.12,
  directional: { position: [-4, 2.4, 1.8] as V3, intensity: 1.1 },
  environmentIntensity: 1,
  envBase: 0.22,
  key: { position: [-5, 2.5, 2.5] as V3, intensity: 2.6, scale: [6, 4, 1] as V3 },
  fill: { position: [4, 2, 3] as V3, intensity: 1.0, scale: [6, 4, 1] as V3 },
  rim: { position: [1, 4, -4] as V3, intensity: 0.9, scale: [5, 3, 1] as V3 },
};

// Chesterfield depth knobs (used inside the tuft shader; these are in METRES and
// use a physical bump path, unlike bumpScale below).
export const RELIEF = {
  /** colour *= seamShadeMin + seamShadeRange * profile. Lower min = deeper pockets. */
  seamShadeMin: 0.45,
  seamShadeRange: 0.55,
  /** Padding height in metres for the analytic normals. Bigger = puffier. */
  normalHeight: 0.085,
  /** Vertex recess of seams/buttons in metres. Keep <= 0.004 or the silhouette wobbles. */
  recess: 0.004,
  /** Leather grain inside the tuft normal chunk, metres. 0.0012 was too noisy (sparkle). */
  grainNormal: 0.0004,
};

export type LookFamily = "woven" | "velvet" | "leather";

export type MaterialLook = {
  roughness: number;
  sheen: number;
  sheenRoughness: number;
  sheenTint: number;
  sheenGrey: number;
  clearcoat: number;
  clearcoatRoughness: number;
  specularIntensity: number;
  /** three.js convention: ~0.5 to 3 is a visible bump. 0 disables it. */
  bumpScale: number;
  normalSoften: number;
};

const DEFAULTS: Record<LookFamily, MaterialLook> = {
  woven: {
    roughness: 0.96, sheen: 0.35, sheenRoughness: 0.55, sheenTint: 0.12, sheenGrey: 0.25,
    clearcoat: 0, clearcoatRoughness: 0.35, specularIntensity: 1, bumpScale: 2, normalSoften: 0.15,
  },
  // Velvet's pile is too fine to bump; sheen carries it, so bump is off.
  velvet: {
    roughness: 0.85, sheen: 1, sheenRoughness: 0.3, sheenTint: 0.14, sheenGrey: 0.25,
    clearcoat: 0, clearcoatRoughness: 0.35, specularIntensity: 1, bumpScale: 0, normalSoften: 0.35,
  },
  leather: {
    roughness: 0.55, sheen: 0, sheenRoughness: 0.5, sheenTint: 0, sheenGrey: 0.25,
    clearcoat: 0.02, clearcoatRoughness: 0.45, specularIntensity: 0.55, bumpScale: 1, normalSoften: 0.45,
  },
};

// Chesterfield = leather + tufts. Its normals come from the physical tuft path,
// so bumpScale is unused there.
const TUFTED: Partial<MaterialLook> = { bumpScale: 0, normalSoften: 0.3 };

const PATTERN: Partial<MaterialLook> = { sheen: 0.2, sheenRoughness: 0.6, sheenGrey: 0.25, bumpScale: 1 };

const OVERRIDES: Record<string, Partial<MaterialLook>> = {
  // Solids
  oat: { roughness: 1, sheen: 0.3, sheenRoughness: 0.6, sheenTint: 0.15, bumpScale: 0.9, normalSoften: 0.1 },
  clay: { roughness: 0.93, sheen: 0.35, sheenTint: 0.15, bumpScale: 2.2 },
  moss: { roughness: 0.95, sheen: 0.7, sheenRoughness: 0.45, sheenTint: 0.2, bumpScale: 2 },
  ink: { roughness: 0.85, sheen: 1, sheenRoughness: 0.3, sheenTint: 0.14, bumpScale: 0 },

  // Patterns / photo fabrics
  wisdom: { ...PATTERN },
  "ochre-chevron": { ...PATTERN },
  "orange-pattern": { ...PATTERN },
  "red-fish": { ...PATTERN },
  "swatch-urban": { roughness: 1, sheen: 0.5, sheenRoughness: 0.62, sheenGrey: 0.4, bumpScale: 1.2 },

  // Leather: dark leathers still get a touch more specular so their form reads.
  "cognac-leather": { roughness: 0.55, specularIntensity: 0.55, clearcoat: 0.02 },
  "charcoal-leather": { roughness: 0.5, specularIntensity: 0.8, clearcoat: 0.1, clearcoatRoughness: 0.3, bumpScale: 0.8 },
  "olive-leather": { roughness: 0.55, specularIntensity: 0.6, clearcoat: 0.04 },

  // Chesterfield: was too shiny (flattened the padding). Duller, so the pleats show.
  "chesterfield-oxblood": { roughness: 0.6, specularIntensity: 0.5, clearcoat: 0.02, clearcoatRoughness: 0.5 },
  "chesterfield-saddle": { roughness: 0.62, specularIntensity: 0.5, clearcoat: 0.02, clearcoatRoughness: 0.5 },
};

export function resolveLook(id: string, family: LookFamily, tufted = false): MaterialLook {
  return { ...DEFAULTS[family], ...(tufted ? TUFTED : {}), ...(OVERRIDES[id] ?? {}) };
}

// Leather grain = 40 cells per tile. Below ~14 cm the cells are smaller than a
// pixel and turn into noise, so the leather slider minimum is MIN_LEATHER_TILE_CM.
export const MIN_LEATHER_TILE_CM = 14;

const TILE_CM: Record<string, number> = {
  oat: 10, wisdom: 12, clay: 8, moss: 8, ink: 8,
  "ochre-chevron": 6, "orange-pattern": 8, "red-fish": 6, "swatch-urban": 8,
  "cognac-leather": 20, "charcoal-leather": 20, "olive-leather": 20,
  "chesterfield-oxblood": 20, "chesterfield-saddle": 20,
};
export const tileFor = (id: string, fallback: number) => TILE_CM[id] ?? fallback;

// Leg bump in the same three.js convention (the old 0.000025 / 0.000008 did nothing).
export const LEG_BUMP = { wood: 0.6, steel: 0.2 };

const WHITE = new THREE.Color(1, 1, 1);

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