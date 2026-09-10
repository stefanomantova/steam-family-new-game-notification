import { DiscordWebhookNotifier } from "../adapters/discord-webhook-notifier.js";
import { JsonStatsRepository } from "../adapters/json-repositories.js";
import { SteamStoreClient } from "../adapters/steam-store-client.js";
import { backfillPurchase } from "../application/backfill-purchase.js";
import { loadSharedConfig } from "../config/environment.js";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasArgument(name: string): boolean {
  return process.argv.includes(name);
}

try {
  const steamId = argument("--steamid");
  const appid = argument("--appid");
  if (!steamId || !appid) {
    throw new Error("Usage: backfill-purchase --steamid <id> --appid <appid> [options]");
  }

  const config = await loadSharedConfig();
  const manualPriceValue = argument("--price");
  const manualPrice = manualPriceValue === undefined ? undefined : Number(manualPriceValue);
  if (manualPriceValue !== undefined && !Number.isFinite(manualPrice)) {
    throw new Error("--price must be a valid number.");
  }

  const notify = hasArgument("--notify");
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL?.trim();
  if (notify && !webhookUrl) {
    throw new Error("Set DISCORD_WEBHOOK_URL when using --notify.");
  }

  const gameName = argument("--game-name");
  const manualCurrency = argument("--currency");
  await backfillPurchase(
    config,
    {
      steamId,
      appid,
      ...(gameName ? { gameName } : {}),
      ...(manualPrice !== undefined ? { manualPrice } : {}),
      ...(manualCurrency ? { manualCurrency } : {}),
      notify,
    },
    {
      store: new SteamStoreClient(),
      stats: new JsonStatsRepository(config.statsFile),
      ...(notify && webhookUrl ? { notifier: new DiscordWebhookNotifier(webhookUrl) } : {}),
    },
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
