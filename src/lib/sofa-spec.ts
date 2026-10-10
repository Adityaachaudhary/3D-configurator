// ONE place for every real-world size. Web configurator and AR both read from here.

// Units: metres (1 three.js unit = 1 m, which is also what WebXR uses).

// >>> Replace SOFA_2_SEATER with the numbers agreed with the client. <<<
// The values below are what the prototype already used: 58 x 33 x 32 inches
// = 147.3 x 83.8 x 81.3 cm (width x depth x height, height measured with legs).

export const INCH = 0.0254;

export const SOFA_2_SEATER = {
  width: 58 * INCH,
  depth: 33 * INCH,
  height: 32 * INCH,
};

/** Width added per extra seat. 1 and 3 seaters are web-only; AR is 2-seater only. */
export const SEAT_STEP = 24 * INCH;

export const seatingWidth = (seats: number) => SOFA_2_SEATER.width + (seats - 2) * SEAT_STEP;

export const BASE_SIZE = {
  width: SOFA_2_SEATER.width,
  height: SOFA_2_SEATER.height,
  depth: SOFA_2_SEATER.depth,
};

/**
 * Gap between the floor and the bottom of the legs.
 * Studio view keeps 1.5 cm so the legs do not z-fight with the floor plane.
 * AR must be exactly 0, otherwise the sofa floats 1.5 cm above the real floor.
 */
export const FLOOR_LIFT = { studio: 0.015, ar: 0 };
