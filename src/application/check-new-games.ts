import { attributeGame, detectNewGames } from "../domain/library-changes.js";
import { renderGameMessage } from "../domain/messages.js";
import type { LibrarySnapshot, Members } from "../domain/models.js";
import { updateStats, type PurchaseStats } from "../domain/stats.js";
import type { Notifier } from "../ports/notifier.js";
import type { StateRepository, StatsRepository } from "../ports/repositories.js";
import type { SteamClient } from "../ports/steam-client.js";
import type { StoreClient } from "../ports/store-client.js";

export interface CheckConfig {
  members: Members;
  storeCountryCode: string;
  messageLanguage: "EN" | "PT";
}

export interface CheckDependencies {
  steam: SteamClient;
  store: StoreClient;
  notifier: Notifier;
  state: StateRepository;
  stats: StatsRepository;
  log?: (message: string) => void;
}

export interface CheckReport {
  detectedGames: number;
  notifiedGames: number;
  stateChanged: boolean;
  statsChanged: boolean;
}

export async function checkNewGames(
  config: CheckConfig,
  dependencies: CheckDependencies,
): Promise<CheckReport> {
  const log = dependencies.log ?? console.log;
  const previousState = await dependencies.state.load();
  const state: LibrarySnapshot = structuredClone(previousState);
  const stats = await dependencies.stats.load();
  stats.members ??= {};

  const currentByMember: LibrarySnapshot = {};
  for (const [steamId, name] of Object.entries(config.members)) {
    log(`Checking ${name}'s library (${steamId})...`);
    try {
      currentByMember[steamId] = await dependencies.steam.fetchOwnedGames(steamId);
    } catch (error) {
      log(`Error fetching ${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const detectedGames = detectNewGames(previousState, currentByMember);
  let notifiedGames = 0;
  let statsChanged = false;

  for (const game of detectedGames) {
    const price = await dependencies.store.fetchGameDetails(
      game.appid,
      game.name,
      config.storeCountryCode,
    );
    if (price.kind === "free") {
      log(`Skipping free game: ${game.name} (appid ${game.appid})`);
      continue;
    }

    const attribution = attributeGame(game, previousState, config.members);
    if (attribution.kind === "purchased" && price.kind === "paid") {
      const buyerName = config.members[attribution.buyerSteamId] ?? attribution.buyerSteamId;
      updateStats(stats, attribution.buyerSteamId, buyerName, price);
      statsChanged = true;
    }

    const message = renderGameMessage(
      game,
      attribution,
      price,
      config.members,
      config.messageLanguage,
    );
    log(message);

    try {
      await dependencies.notifier.send(message);
      notifiedGames += 1;
    } catch (error) {
      log(`Error sending Discord message: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (detectedGames.length === 0) {
    log("No new games found.");
  }

  let stateChanged = false;
  for (const [steamId, currentGames] of Object.entries(currentByMember)) {
    if (JSON.stringify(currentGames) !== JSON.stringify(previousState[steamId] ?? {})) {
      state[steamId] = currentGames;
      stateChanged = true;
    }
  }

  await dependencies.state.save(state);
  await dependencies.stats.save(stats);

  log(stateChanged ? "State updated." : "No state changes.");
  log(statsChanged ? "Stats updated." : "No stats changes.");

  return { detectedGames: detectedGames.length, notifiedGames, stateChanged, statsChanged };
}
