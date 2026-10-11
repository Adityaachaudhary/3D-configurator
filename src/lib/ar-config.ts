import { DEFAULT_TILE_CM, MIN_TILE_CM, MAX_TILE_CM } from "./texture-repeat";
export interface ARConfiguration { fabric: string; leg: string; tile: number }
const PREVIEW_ORIGIN = "https://id-preview--509c4dcd-5e06-420c-b286-4e068a01cc45.lovable.app";
export const arEligible = (seats: number) => seats === 2;
export const arScale = (scale: number) => Math.min(3, Math.max(0.3, Number.isFinite(scale) ? scale : 1));
export function readARConfiguration(search: string): ARConfiguration {
  const params = new URLSearchParams(search);
  const raw = Number(params.get("tile") ?? DEFAULT_TILE_CM);
  return { fabric: params.get("fabric") ?? "oat", leg: params.get("leg") ?? "oak", tile: Math.min(MAX_TILE_CM, Math.max(MIN_TILE_CM, Number.isFinite(raw) ? raw : DEFAULT_TILE_CM)) };
}
export function buildARUrl(href: string, config: ARConfiguration) {
  const url = new URL(href);
  if (url.hostname === "lovable.dev" || url.hostname.endsWith(".lovable.dev") || url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    url.protocol = "https:";
    url.host = new URL(PREVIEW_ORIGIN).host;
    url.port = "";
    url.pathname = "/";
  }
  url.search = new URLSearchParams({ ar: "1", fabric: config.fabric, leg: config.leg, tile: String(config.tile) }).toString();
  url.hash = "";
  return url.href;
}
export function isARFloor(matrix: ArrayLike<number>) {
  return matrix.length >= 16 && Number.isFinite(matrix[13]) && (matrix[5] ?? 0) >= 0.95 && Math.abs(matrix[13] ?? Infinity) <= 0.15;
}