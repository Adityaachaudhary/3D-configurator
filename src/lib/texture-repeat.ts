// One physical tile, independent of sofa size; model scale is applied in the shader.
export const DEFAULT_TILE_CM = 12.5;
export const MIN_TILE_CM = 5;
export const MAX_TILE_CM = 25;
export function tileDensity(tileCm: number) {
  const bounded = Math.min(MAX_TILE_CM, Math.max(MIN_TILE_CM, Number.isFinite(tileCm) ? tileCm : DEFAULT_TILE_CM));
  return 100 / bounded;
}