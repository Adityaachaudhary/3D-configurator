export type MaterialFamily = "woven" | "velvet" | "leather" | "wood" | "steel";

// Base parameters; linear roughness maps add restrained microvariation.
export function materialRecipe(family: MaterialFamily, tufted = false) {
  const base = { metalness: 0, sheen: 0, sheenRoughness: 0.5, clearcoat: 0, clearcoatRoughness: 0.35, specularIntensity: 1 };
  switch (family) {
    case "woven": return { ...base, roughness: 0.96, sheen: 0.65 };
    case "velvet": return { ...base, roughness: 0.92, sheen: 1, sheenRoughness: 0.4 };
    case "leather": return { ...base, roughness: 0.58, clearcoat: tufted ? 0.04 : 0.06, specularIntensity: 0.6 };
    case "wood": return { ...base, roughness: 0.56, clearcoat: 0.025 };
    case "steel": return { ...base, roughness: 0.3, metalness: 0.82 };
  }
}