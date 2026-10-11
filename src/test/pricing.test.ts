import { describe, expect, it } from "vitest";

import {
  FABRIC_PRICES,
  PRICE_PER_LEG_FINISH,
  PRICE_PER_SEAT,
  fabricPrice,
  formatINR,
  legFinishPrice,
  totalPrice,
} from "@/lib/pricing";

describe("pricing (mock INR rates)", () => {
  it("charges 150 per seat", () => {
    expect(PRICE_PER_SEAT).toBe(150);
  });

  it("charges 100 per leg finish", () => {
    expect(PRICE_PER_LEG_FINISH).toBe(100);
  });

  it("prices solid fabrics at 50", () => {
    expect(fabricPrice({ weave: "boucle" })).toBe(50);
    expect(fabricPrice({ weave: "velvet" })).toBe(50);
  });

  it("prices pattern and photo fabrics at 80", () => {
    expect(fabricPrice({ weave: "twill", pattern: "check" })).toBe(80);
    expect(fabricPrice({ weave: "linen", photo: "x.png" })).toBe(80);
    expect(fabricPrice({ weave: "tweed", printed: true, photo: "x.png" })).toBe(80);
  });

  it("prices leather fabrics at 100", () => {
    expect(fabricPrice({ weave: "leather" })).toBe(100);
    expect(fabricPrice({ weave: "leather", tufted: true } as never)).toBe(100);
  });

  it("totals seats + fabric + leg finish", () => {
    const solid = { weave: "boucle" };
    expect(totalPrice(1, solid)).toBe(150 + 50 + 100);
    expect(totalPrice(2, solid)).toBe(300 + 50 + 100);
    expect(totalPrice(3, { weave: "leather" })).toBe(450 + 100 + 100);
  });

  it("charges the same 100 mock surcharge for every leg finish", () => {
    const solid = { weave: "boucle" };
    for (const finish of ["oak", "walnut", "ebonized", "steel"] as const) {
      expect(legFinishPrice(finish)).toBe(PRICE_PER_LEG_FINISH);
      expect(totalPrice(2, solid, finish)).toBe(300 + 50 + PRICE_PER_LEG_FINISH);
    }
  });

  it("formats totals as INR without decimals", () => {
    expect(formatINR(300)).toBe("₹300");
  });

  it("keeps mock fabric rates at 50/80/100", () => {
    expect(FABRIC_PRICES).toEqual({ solid: 50, pattern: 80, leather: 100 });
  });
});
