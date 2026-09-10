import { loadConfig } from "../config/environment.js";
import { DiscordWebhookNotifier } from "../adapters/discord-webhook-notifier.js";
import { JsonStateRepository, JsonStatsRepository } from "../adapters/json-repositories.js";
import { SteamApiClient } from "../adapters/steam-api-client.js";
import { SteamStoreClient } from "../adapters/steam-store-client.js";
import { checkNewGames } from "../application/check-new-games.js";

try {
  const config = await loadConfig();
  await checkNewGames(config, {
    steam: new SteamApiClient(config.steamApiKey),
    store: new SteamStoreClient(),
    notifier: new DiscordWebhookNotifier(config.discordWebhookUrl),
    state: new JsonStateRepository(config.stateFile),
    stats: new JsonStatsRepository(config.statsFile),
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
