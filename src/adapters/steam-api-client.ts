import type { Library, SteamId } from "../domain/models.js";
import type { SteamClient } from "../ports/steam-client.js";
import { fetchJson } from "./http.js";

const GET_OWNED_GAMES_URL = "https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/";

interface OwnedGamesResponse {
  response?: {
    games?: Array<{ appid: number; name?: string }>;
  };
}

export class SteamApiClient implements SteamClient {
  public constructor(private readonly apiKey: string) {}

  public async fetchOwnedGames(steamId: SteamId): Promise<Library> {
    const url = new URL(GET_OWNED_GAMES_URL);
    url.search = new URLSearchParams({
      key: this.apiKey,
      steamid: steamId,
      format: "json",
      include_appinfo: "1",
      include_played_free_games: "1",
    }).toString();

    const data = await fetchJson<OwnedGamesResponse>(url.toString());
    const games = data.response?.games ?? [];

    return Object.fromEntries(
      games.map((game) => [String(game.appid), game.name ?? `App ${game.appid}`]),
    );
  }
}
