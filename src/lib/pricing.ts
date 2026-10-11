// Mock prices in INR — placeholders until the client confirms real rates.
export const PRICE_PER_SEAT = 150;
export const PRICE_PER_LEG_FINISH = 100;
export const FABRIC_PRICES = { solid: 50, pattern: 80, leather: 100 } as const;

export type PricedFabric = { weave: string; pattern?: unknown; photo?: unknown; printed?: boolean };
export type LegFinishId = "oak" | "walnut" | "ebonized" | "steel";

export function fabricPrice(fabric: PricedFabric): number {
  if (fabric.weave === "leather") return FABRIC_PRICES.leather;
  if (fabric.pattern || fabric.photo || fabric.printed) return FABRIC_PRICES.pattern;
  return FABRIC_PRICES.solid;
}

export function legFinishPrice(_finish: LegFinishId): number {
  return PRICE_PER_LEG_FINISH;
}

export function totalPrice(
  seats: number,
  fabric: PricedFabric,
  finish: LegFinishId = "oak",
): number {
  return seats * PRICE_PER_SEAT + fabricPrice(fabric) + legFinishPrice(finish);
}

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
export const formatINR = (value: number) => inr.format(value);
