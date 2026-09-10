import type {
  Attribution,
  DetectedGame,
  LibrarySnapshot,
  Members,
  SteamId,
} from "./models.js";

export function detectNewGames(
  previous: LibrarySnapshot,
  currentByMember: LibrarySnapshot,
): DetectedGame[] {
  const grouped = new Map<string, DetectedGame>();

  for (const [steamId, currentGames] of Object.entries(currentByMember)) {
    const previousGames = previous[steamId] ?? {};

    // An empty previous library is a baseline, matching the Python behavior.
    if (Object.keys(previousGames).length === 0) {
      continue;
    }

    for (const [appid, name] of Object.entries(currentGames)) {
      if (Object.prototype.hasOwnProperty.call(previousGames, appid)) {
        continue;
      }

      const detected = grouped.get(appid);
      if (detected) {
        detected.recipientSteamIds.push(steamId);
      } else {
        grouped.set(appid, {
          appid,
          name,
          recipientSteamIds: [steamId],
        });
      }
    }
  }

  return [...grouped.values()];
}

export function attributeGame(
  game: DetectedGame,
  previous: LibrarySnapshot,
  members: Members,
): Attribution {
  const recipientIds = new Set(game.recipientSteamIds);

  for (const [steamId, previousGames] of Object.entries(previous)) {
    if (!recipientIds.has(steamId) && Object.prototype.hasOwnProperty.call(previousGames, game.appid)) {
      return {
        kind: "shared",
        sourceName: members[steamId] ?? steamId,
      };
    }
  }

  if (game.recipientSteamIds.length === 1) {
    return {
      kind: "purchased",
      buyerSteamId: game.recipientSteamIds[0] as SteamId,
    };
  }

  return { kind: "ambiguous" };
}
