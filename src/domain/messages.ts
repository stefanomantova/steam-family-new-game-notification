import type { Attribution, DetectedGame } from "./models.js";
import type { PriceResult } from "./pricing.js";

export type MessageLanguage = "EN" | "PT";

const messages = {
  EN: {
    shared: "🔗 A new game is available on Family Sharing! **{game}**, shared by **{source}**.",
    purchased: "🎮 **{buyer}** bought a new game: **{game}**",
    bundleNote: "(price counted from the bundle/package it came in)",
    purchasedPriceUnknown:
      "🎮 **{buyer}** bought a new game: **{game}** (price unknown, not counted in the ranking)",
    purchasedAmbiguous:
      "🎮 A new game appeared in the group: **{game}** (not counted in the ranking, can't tell who bought it)",
  },
  PT: {
    shared: "🔗 Um jogo novo está disponível no Family Sharing! **{game}**, compartilhado por **{source}**.",
    purchased: "🎮 **{buyer}** comprou um jogo novo: **{game}**",
    bundleNote: "(preço contabilizado a partir do bundle/pacote em que veio)",
    purchasedPriceUnknown:
      "🎮 **{buyer}** comprou um jogo novo: **{game}** (preço desconhecido, não contabilizado no ranking)",
    purchasedAmbiguous:
      "🎮 Um jogo novo apareceu no grupo: **{game}** (não contabilizado no ranking, não dá pra saber quem comprou)",
  },
} as const;

function replace(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? `{${key}}`);
}

export function normalizeMessageLanguage(value: string | undefined): MessageLanguage {
  const normalized = value?.trim().toUpperCase();
  return normalized === "PT" ? "PT" : "EN";
}

export function renderGameMessage(
  game: DetectedGame,
  attribution: Attribution,
  price: PriceResult,
  members: Record<string, string>,
  language: MessageLanguage,
): string {
  const text = messages[language];

  if (attribution.kind === "shared") {
    return replace(text.shared, { game: game.name, source: attribution.sourceName });
  }

  if (attribution.kind === "ambiguous") {
    return replace(text.purchasedAmbiguous, { game: game.name });
  }

  const buyer = members[attribution.buyerSteamId] ?? attribution.buyerSteamId;
  if (price.kind === "unknown") {
    return replace(text.purchasedPriceUnknown, { buyer, game: game.name });
  }

  let message = replace(text.purchased, { buyer, game: game.name });
  if (price.kind === "paid" && price.fromBundle) {
    message += ` ${text.bundleNote}`;
  }
  return message;
}
