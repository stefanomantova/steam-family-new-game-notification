import { describe, expect, it } from "vitest";
import { normalizeMessageLanguage, renderGameMessage } from "./messages.js";
import type { DetectedGame } from "./models.js";

const game: DetectedGame = {
  appid: "42",
  name: "New Game",
  recipientSteamIds: ["alice"],
};

describe("message rendering", () => {
  it("falls back to English for unsupported languages", () => {
    expect(normalizeMessageLanguage("es")).toBe("EN");
    expect(normalizeMessageLanguage(" pt ")).toBe("PT");
  });

  it("renders a shared game without pricing text", () => {
    expect(
      renderGameMessage(
        game,
        { kind: "shared", sourceName: "Bob" },
        { kind: "paid", priceCents: 1000, fromBundle: false },
        { alice: "Alice" },
        "EN",
      ),
    ).toBe("🔗 A new game is available on Family Sharing! **New Game**, shared by **Bob**.");
  });

  it("renders a shared unshareable game without claiming Family Sharing eligibility", () => {
    expect(
      renderGameMessage(
        game,
        { kind: "shared", sourceName: "Bob" },
        { kind: "paid", priceCents: 1000, fromBundle: false },
        { alice: "Alice" },
        "EN",
        false,
      ),
    ).toBe(
      "🎮 **Bob** bought a new game: **New Game** (not eligible for Family Sharing, not counted in the ranking)",
    );
  });

  it("renders unknown-price purchases without inventing a value", () => {
    expect(
      renderGameMessage(game, { kind: "purchased", buyerSteamId: "alice" }, { kind: "unknown" }, { alice: "Alice" }, "EN"),
    ).toContain("price unknown, not counted in the ranking");
  });

  it("adds the bundle note for a priced bundle purchase", () => {
    expect(
      renderGameMessage(
        game,
        { kind: "purchased", buyerSteamId: "alice" },
        { kind: "paid", priceCents: 1000, fromBundle: true },
        { alice: "Alice" },
        "PT",
      ),
    ).toContain("preço contabilizado a partir do bundle/pacote");
  });

  it("renders unshareable purchases with unshareable notice in PT and EN", () => {
    expect(
      renderGameMessage(
        game,
        { kind: "purchased", buyerSteamId: "alice" },
        { kind: "paid", priceCents: 1000, fromBundle: false },
        { alice: "Alice" },
        "PT",
        false,
      ),
    ).toContain("não compatível com Family Sharing, não contabilizado no ranking");

    expect(
      renderGameMessage(
        game,
        { kind: "purchased", buyerSteamId: "alice" },
        { kind: "paid", priceCents: 1000, fromBundle: false },
        { alice: "Alice" },
        "EN",
        false,
      ),
    ).toContain("not eligible for Family Sharing, not counted in the ranking");
  });
});
