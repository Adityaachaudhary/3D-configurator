// Exact inch-based dimensions, expressed in meters.
const INCH_METERS = 0.0254;

export const seatingWidth = (seats: number) => (34 + (seats - 1) * 24) * INCH_METERS;
export const BASE_SIZE = { width: seatingWidth(2), height: 32 * INCH_METERS, depth: 33 * INCH_METERS };
export const FLOOR_LIFT = { studio: 0.015 };
