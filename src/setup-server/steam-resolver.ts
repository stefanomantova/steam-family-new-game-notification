import { fetchJson } from "../adapters/http.js";

export interface SteamPlayerSummary {
  steamId: string;
  personaName: string;
  avatarUrl: string;
  isProfilePublic: boolean;
  gameCount?: number;
}

export interface ExtractedIdentifier {
  type: "steamid" | "vanity" | "invalid";
  value: string;
}

const VANITY_URL_API = "https://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/";
const PLAYER_SUMMARIES_API = "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/";
const OWNED_GAMES_API = "https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/";

export function extractSteamIdentifier(input: string): ExtractedIdentifier {
  const trimmed = input.trim();
  if (!trimmed) {
    return { type: "invalid", value: "" };
  }

  // Check direct 17-digit SteamID64
  if (/^\d{17}$/.test(trimmed)) {
    return { type: "steamid", value: trimmed };
  }

  // Check steamcommunity.com/profiles/<steamid64>
  const profileMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?steamcommunity\.com\/profiles\/(\d{17})\/?/i);
  if (profileMatch?.[1]) {
    return { type: "steamid", value: profileMatch[1] };
  }

  // Check steamcommunity.com/id/<customURL>
  const vanityMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?steamcommunity\.com\/id\/([a-zA-Z0-9_-]+)\/?/i);
  if (vanityMatch?.[1]) {
    return { type: "vanity", value: vanityMatch[1] };
  }

  // Clean raw username/custom URL (not a URL, alphanumeric/underscore/dash)
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed) && !trimmed.startsWith("http")) {
    return { type: "vanity", value: trimmed };
  }

  return { type: "invalid", value: trimmed };
}

export async function resolveToSteamId(apiKey: string, input: string): Promise<string> {
  const extracted = extractSteamIdentifier(input);
  if (extracted.type === "steamid") {
    return extracted.value;
  }
  if (extracted.type === "invalid") {
    throw new Error(`Invalid Steam identifier or URL: "${input}"`);
  }

  const url = new URL(VANITY_URL_API);
  url.search = new URLSearchParams({
    key: apiKey.trim(),
    vanityurl: extracted.value,
  }).toString();

  interface ResolveResponse {
    response?: {
      steamid?: string;
      success?: number;
      message?: string;
    };
  }

  const data = await fetchJson<ResolveResponse>(url.toString());
  if (data.response?.success !== 1 || !data.response?.steamid) {
    throw new Error(data.response?.message || `Could not resolve Steam custom URL "${extracted.value}".`);
  }

  return data.response.steamid;
}

export async function fetchPlayerSummary(apiKey: string, steamId: string): Promise<SteamPlayerSummary> {
  const url = new URL(PLAYER_SUMMARIES_API);
  url.search = new URLSearchParams({
    key: apiKey.trim(),
    steamids: steamId,
  }).toString();

  interface PlayerSummariesResponse {
    response?: {
      players?: Array<{
        steamid: string;
        personaname?: string;
        avatarfull?: string;
        avatar?: string;
        communityvisibilitystate?: number;
      }>;
    };
  }

  const data = await fetchJson<PlayerSummariesResponse>(url.toString());
  const player = data.response?.players?.[0];
  if (!player) {
    throw new Error(`Steam profile not found for ID ${steamId}.`);
  }

  const isProfilePublic = player.communityvisibilitystate === 3;
  let gameCount: number | undefined;

  // Check game count if profile is public
  if (isProfilePublic) {
    try {
      const gamesUrl = new URL(OWNED_GAMES_API);
      gamesUrl.search = new URLSearchParams({
        key: apiKey.trim(),
        steamid: steamId,
        format: "json",
      }).toString();

      interface OwnedGamesSummary {
        response?: {
          game_count?: number;
        };
      }

      const gamesData = await fetchJson<OwnedGamesSummary>(gamesUrl.toString());
      gameCount = gamesData.response?.game_count;
    } catch {
      // Non-fatal if owned games check fails
    }
  }

  return {
    steamId: player.steamid,
    personaName: player.personaname || `Player ${steamId}`,
    avatarUrl: player.avatarfull || player.avatar || "https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg",
    isProfilePublic,
    ...(gameCount === undefined ? {} : { gameCount }),
  };
}

export async function verifySteamApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  const key = apiKey.trim();
  if (!key) {
    return { valid: false, error: "Steam API key is empty." };
  }

  try {
    const url = new URL(VANITY_URL_API);
    url.search = new URLSearchParams({
      key,
      vanityurl: "valve",
    }).toString();

    await fetchJson(url.toString());
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Failed to verify Steam API key.",
    };
  }
}
