import { describe, expect, it } from "vitest";
import { updateStats, type PurchaseStats } from "./stats.js";

describe("updateStats", () => {
  it("adds purchases using cents while preserving the stats contract", () => {
    const stats: PurchaseStats = {
      currency: null,
      members: {
        alice: { name: "Old Alice", total_spent: 1.74, total_purchased: 1 },
      },
    };

    updateStats(stats, "alice", "Alice", {
      kind: "paid",
      priceCents: 7898,
      currency: "BRL",
      fromBundle: false,
    });

    expect(stats).toEqual({
      currency: "BRL",
      members: {
        alice: { name: "Alice", total_spent: 80.72, total_purchased: 2 },
      },
    });
  });

  it("creates a member record for a new buyer", () => {
    const stats: PurchaseStats = { currency: null, members: {} };

    updateStats(stats, "bob", "Bob", {
      kind: "paid",
      priceCents: 250,
      fromBundle: true,
    });

    expect(stats.members.bob).toEqual({
      name: "Bob",
      total_spent: 2.5,
      total_purchased: 1,
    });
  });
});
