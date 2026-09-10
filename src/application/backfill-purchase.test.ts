import { describe, expect, it } from "vitest";
import { backfillPurchase } from "./backfill-purchase.js";
import type { PurchaseStats } from "../domain/stats.js";

describe("backfillPurchase", () => {
  it("uses a manual price and persists stats without touching state", async () => {
    let savedStats: PurchaseStats = { currency: null, members: {} };
    const savedMessages: string[] = [];

    const result = await backfillPurchase(
      {
        members: { alice: "Alice" },
        storeCountryCode: "br",
        messageLanguage: "EN",
      },
      {
        steamId: "alice",
        appid: "42",
        gameName: "Backfilled Game",
        manualPrice: 62.9,
        manualCurrency: "BRL",
        notify: true,
      },
      {
        store: {
          fetchGameDetails: async () => ({ kind: "unknown" as const }),
          fetchGameName: async () => "unused",
        },
        stats: {
          load: async () => savedStats,
          save: async (stats) => {
            savedStats = stats;
          },
        },
        notifier: {
          send: async (message) => {
            savedMessages.push(message);
          },
        },
        log: () => undefined,
      },
    );

    expect(result).toBe("added");
    expect(savedStats.members.alice).toEqual({
      name: "Alice",
      total_spent: 62.9,
      total_purchased: 1,
    });
    expect(savedMessages[0]).toContain("retroactively added");
  });

  it("does not save stats for free or unknown-price apps", async () => {
    let saveCount = 0;
    const dependencies = {
      store: {
        fetchGameDetails: async (_appid: string, _name: string, _country: string) => ({ kind: "free" as const }),
        fetchGameName: async () => "Free Game",
      },
      stats: {
        load: async () => ({ currency: null, members: {} }),
        save: async () => {
          saveCount += 1;
        },
      },
      log: () => undefined,
    };

    const result = await backfillPurchase(
      { members: {}, storeCountryCode: "br", messageLanguage: "EN" },
      { steamId: "alice", appid: "42", notify: false },
      dependencies,
    );

    expect(result).toBe("skipped-free");
    expect(saveCount).toBe(0);
  });
});
