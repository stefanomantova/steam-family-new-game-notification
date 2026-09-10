export type PriceResult =
  | { kind: "free" }
  | { kind: "paid"; priceCents: number; currency?: string; fromBundle: boolean }
  | { kind: "unknown" };

export function directPrice(
  isFree: boolean,
  finalCents: number | undefined,
  currency: string | undefined,
): PriceResult {
  if (isFree) {
    return { kind: "free" };
  }

  if (finalCents === undefined) {
    return { kind: "unknown" };
  }

  return {
    kind: "paid",
    priceCents: finalCents,
    ...(currency ? { currency } : {}),
    fromBundle: false,
  };
}

export function fallbackPrice(
  packagePricesCents: number[],
  searchPriceCents: number | undefined,
  currency: string | undefined,
): PriceResult {
  const validPackagePrices = packagePricesCents.filter((price) => price > 0);
  const packagePrice = validPackagePrices.length > 0 ? Math.min(...validPackagePrices) : undefined;
  const priceCents = packagePrice ?? searchPriceCents;

  if (priceCents === undefined) {
    return { kind: "unknown" };
  }

  return {
    kind: "paid",
    priceCents,
    ...(currency ? { currency } : {}),
    fromBundle: true,
  };
}
