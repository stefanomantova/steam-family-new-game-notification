import type { PriceResult } from "./pricing.js";

export interface MemberStats {
  name: string;
  total_spent: number;
  total_purchased: number;
}

export interface PurchaseStats {
  currency: string | null;
  members: Record<string, MemberStats>;
}

export function updateStats(
  stats: PurchaseStats,
  steamId: string,
  name: string,
  price: Extract<PriceResult, { kind: "paid" }>,
): void {
  if (price.currency && !stats.currency) {
    stats.currency = price.currency;
  }

  const member = stats.members[steamId] ?? {
    name,
    total_spent: 0,
    total_purchased: 0,
  };

  member.name = name;
  // Keep arithmetic in cents, then preserve the existing JSON number format.
  const currentCents = Math.round(member.total_spent * 100);
  member.total_spent = (currentCents + price.priceCents) / 100;
  member.total_purchased += 1;
  stats.members[steamId] = member;
}
