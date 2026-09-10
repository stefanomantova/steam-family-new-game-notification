import { renderGameMessage } from "../domain/messages.js";
import type { PriceResult } from "../domain/pricing.js";
import { updateStats, type PurchaseStats } from "../domain/stats.js";
import type { Notifier } from "../ports/notifier.js";
import type { StatsRepository } from "../ports/repositories.js";
import type { StoreClient } from "../ports/store-client.js";

export interface BackfillInput {
  steamId: string;
  appid: string;
  gameName?: string;
  manualPrice?: number;
  manualCurrency?: string;
  notify: boolean;
}

export interface BackfillConfig {
  members: Record<string, string>;
  storeCountryCode: string;
  messageLanguage: "EN" | "PT";
}

export interface BackfillDependencies {
  store: StoreClient;
  stats: StatsRepository;
  notifier?: Notifier;
  log?: (message: string) => void;
}

export async function backfillPurchase(
  config: BackfillConfig,
  input: BackfillInput,
  dependencies: BackfillDependencies,
): Promise<"added" | "skipped-free" | "skipped-unknown"> {
  const log = dependencies.log ?? console.log;
  const buyerName = config.members[input.steamId] ?? input.steamId;
  const gameName = input.gameName ?? (await dependencies.store.fetchGameName(input.appid, config.storeCountryCode));

  let price: PriceResult;
  if (input.manualPrice !== undefined) {
    price = {
      kind: "paid",
      priceCents: Math.round(input.manualPrice * 100),
      ...(input.manualCurrency ? { currency: input.manualCurrency } : {}),
      fromBundle: false,
    };
  } else {
    price = await dependencies.store.fetchGameDetails(
      input.appid,
      gameName,
      config.storeCountryCode,
    );
  }

  if (price.kind === "free") {
    log("This appid is marked as free by the Steam Store - nothing to backfill.");
    return "skipped-free";
  }
  if (price.kind === "unknown") {
    log("Could not determine a price for this appid automatically. Nothing was added.");
    return "skipped-unknown";
  }

  const stats: PurchaseStats = await dependencies.stats.load();
  stats.members ??= {};
  updateStats(stats, input.steamId, buyerName, price);
  await dependencies.stats.save(stats);

  const currencyLabel = price.currency ? ` ${price.currency}` : "";
  log(`Added '${gameName}' (${(price.priceCents / 100).toFixed(2)}${currencyLabel}) to ${buyerName}'s stats.`);
  if (price.fromBundle) {
    log("(price came from a bundle/package, not a standalone listing)");
  }

  if (input.notify && dependencies.notifier) {
    const message = `${renderGameMessage(
      { appid: input.appid, name: gameName, recipientSteamIds: [input.steamId] },
      { kind: "purchased", buyerSteamId: input.steamId },
      price,
      config.members,
      config.messageLanguage,
    )} ${config.messageLanguage === "PT" ? "(adicionado retroativamente)" : "(retroactively added)"}`;
    await dependencies.notifier.send(message);
    log("Discord notification sent.");
  }

  return "added";
}
