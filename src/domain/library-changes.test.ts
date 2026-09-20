import { describe, expect, it } from "vitest";
import { attributeGame, detectNewGames } from "./library-changes.js";
import type { LibrarySnapshot } from "./models.js";

const members = {
  alice: "Alice",
  bob: "Bob",
  carol: "Carol",
};

describe("detectNewGames", () => {
  it("does not notify for a member's first observed library", () => {
    const previous: LibrarySnapshot = {};
    const current: LibrarySnapshot = {
      alice: { "10": "Existing Game" },
    };

    expect(detectNewGames(previous, current)).toEqual([]);
  });

  it("groups one newly available app across multiple recipients", () => {
    const previous: LibrarySnapshot = {
      alice: { "1": "Old Game" },
      bob: { "1": "Old Game" },
    };
    const current: LibrarySnapshot = {
      alice: { "1": "Old Game", "2": "New Game" },
      bob: { "1": "Old Game", "2": "New Game" },
    };

    expect(detectNewGames(previous, current)).toEqual([
      {
        appid: "2",
        name: "New Game",
        recipientSteamIds: ["alice", "bob"],
      },
    ]);
  });

  it("does not treat an unchanged app as new", () => {
    const snapshot: LibrarySnapshot = {
      alice: { "1": "Existing Game" },
    };

    expect(detectNewGames(snapshot, snapshot)).toEqual([]);
  });
});

describe("attributeGame", () => {
  it("attributes a game to an existing owner outside the recipients", () => {
    const previous: LibrarySnapshot = {
      alice: { "2": "Shared Game" },
      bob: { "1": "Old Game" },
    };
    const game = {
      appid: "2",
      name: "Shared Game",
      recipientSteamIds: ["bob"],
    };

    expect(attributeGame(game, previous, members)).toEqual({
      kind: "shared",
      sourceName: "Alice",
    });
  });

  it("identifies an unambiguous purchase", () => {
    const game = {
      appid: "2",
      name: "New Game",
      recipientSteamIds: ["alice"],
    };

    expect(attributeGame(game, {}, members)).toEqual({
      kind: "purchased",
      buyerSteamId: "alice",
    });
  });

  it("keeps simultaneous new recipients ambiguous", () => {
    const game = {
      appid: "2",
      name: "New Game",
      recipientSteamIds: ["alice", "bob"],
    };

    expect(attributeGame(game, {}, members)).toEqual({ kind: "ambiguous" });
  });

  it("attributes an unshareable game as a purchase even if an existing member had it", () => {
    const previous: LibrarySnapshot = {
      alice: { "2": "Unshareable Game" },
      bob: { "1": "Old Game" },
    };
    const game = {
      appid: "2",
      name: "Unshareable Game",
      recipientSteamIds: ["bob"],
    };

    expect(attributeGame(game, previous, members, false)).toEqual({
      kind: "purchased",
      buyerSteamId: "bob",
    });
  });
});
