import { describe, expect, it } from "vitest";
import { checkNewGames } from "./check-new-games.js";
import type { Library, LibrarySnapshot } from "../domain/models.js";
import type { PurchaseStats } from "../domain/stats.js";

function dependencies(previousState: LibrarySnapshot, initialStats: PurchaseStats) {
  let savedState = previousState;
  let savedStats = initialStats;
  const messages: string[] = [];

  return {
    dependencies: {
      steam: {
        fetchOwnedGames: async (steamId: string): Promise<Library> => {
          if (steamId === "failed") {
            throw new Error("profile unavailable");
          }
          return steamId === "alice"
            ? { "1": "Old Game", "2": "New Game" }
            : { "1": "Old Game" };
        },
      },
      store: {
        fetchGameDetails: async () => ({
          kind: "paid" as const,
          priceCents: 2500,
          currency: "BRL",
          fromBundle: false,
        }),
        fetchGameName: async (appid: string) => `App ${appid}`,
      },
      notifier: {
        send: async (message: string) => {
          messages.push(message);
        },
      },
      state: {
        load: async () => savedState,
        save: async (state: LibrarySnapshot) => {
          savedState = state;
        },
      },
      stats: {
        load: async () => savedStats,
        save: async (stats: PurchaseStats) => {
          savedStats = stats;
        },
      },
      log: () => undefined,
    },
    getSavedState: () => savedState,
    getSavedStats: () => savedStats,
    messages,
  };
}

describe("checkNewGames", () => {
  it("preserves a non-empty member state when Steam returns an empty library", async () => {
    const initialState: LibrarySnapshot = {
      alice: { "1": "Existing Game" },
    };
    const initialStats: PurchaseStats = { currency: null, members: {} };
    const testContext = dependencies(initialState, initialStats);
    testContext.dependencies.steam.fetchOwnedGames = async (): Promise<Library> => ({});

    await checkNewGames(
      {
        members: { alice: "Alice" },
        storeCountryCode: "br",
        messageLanguage: "EN",
      },
      testContext.dependencies,
    );

    expect(testContext.getSavedState()).toEqual(initialState);
    expect(testContext.messages).toEqual([]);
  });

  it("updates successful members and leaves failed members unchanged", async () => {
    const initialState: LibrarySnapshot = {
      alice: { "1": "Old Game" },
      failed: { "9": "Preserved Game" },
    };
    const initialStats: PurchaseStats = { currency: null, members: {} };
    const testContext = dependencies(initialState, initialStats);

    const report = await checkNewGames(
      {
        members: { alice: "Alice", failed: "Unavailable" },
        storeCountryCode: "br",
        messageLanguage: "EN",
      },
      testContext.dependencies,
    );

    expect(report).toEqual({
      detectedGames: 1,
      notifiedGames: 1,
      stateChanged: true,
      statsChanged: true,
    });
    expect(testContext.getSavedState()).toEqual({
      alice: { "1": "Old Game", "2": "New Game" },
      failed: { "9": "Preserved Game" },
    });
    expect(testContext.getSavedStats().members.alice).toEqual({
      name: "Alice",
      total_spent: 25,
      total_purchased: 1,
    });
    expect(testContext.messages).toEqual(["🎮 **Alice** bought a new game: **New Game**"]);
  });
});
