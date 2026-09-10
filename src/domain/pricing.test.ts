import { describe, expect, it } from "vitest";
import { directPrice, fallbackPrice } from "./pricing.js";

describe("pricing outcomes", () => {
  it("treats the Steam free flag as authoritative", () => {
    expect(directPrice(true, undefined, undefined)).toEqual({ kind: "free" });
  });

  it("prefers a direct standalone price", () => {
    expect(directPrice(false, 1299, "BRL")).toEqual({
      kind: "paid",
      priceCents: 1299,
      currency: "BRL",
      fromBundle: false,
    });
  });

  it("uses the cheapest valid package price before search", () => {
    expect(fallbackPrice([6290, 1990, 0], 999, "BRL")).toEqual({
      kind: "paid",
      priceCents: 1990,
      currency: "BRL",
      fromBundle: true,
    });
  });

  it("falls back to store search when packages have no price", () => {
    expect(fallbackPrice([], 999, "BRL")).toEqual({
      kind: "paid",
      priceCents: 999,
      currency: "BRL",
      fromBundle: true,
    });
  });

  it("keeps paid games with no usable price distinct from free games", () => {
    expect(fallbackPrice([], undefined, undefined)).toEqual({ kind: "unknown" });
  });
});
