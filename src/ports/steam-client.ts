import type { Library, SteamId } from "../domain/models.js";

export interface SteamClient {
  fetchOwnedGames(steamId: SteamId): Promise<Library>;
}
