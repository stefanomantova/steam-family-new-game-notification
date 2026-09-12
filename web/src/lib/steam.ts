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

  // 17-digit SteamID64
  if (/^\d{17}$/.test(trimmed)) {
    return { type: "steamid", value: trimmed };
  }

  // steamcommunity.com/profiles/<steamid64>
  const profileMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?steamcommunity\.com\/profiles\/(\d{17})\/?/i);
  if (profileMatch?.[1]) {
    return { type: "steamid", value: profileMatch[1] };
  }

  // steamcommunity.com/id/<customURL>
  const vanityMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?steamcommunity\.com\/id\/([a-zA-Z0-9_-]+)\/?/i);
  if (vanityMatch?.[1]) {
    return { type: "vanity", value: vanityMatch[1] };
  }

  // raw username/custom vanity
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

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Steam API error: HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    response?: {
      steamid?: string;
      success?: number;
      message?: string;
    };
  };

  if (data.response?.success !== 1 || !data.response?.steamid) {
    throw new Error(data.response?.message || `Could not resolve custom URL "${extracted.value}". Check the username.`);
  }

  return data.response.steamid;
}

export async function fetchPlayerSummary(apiKey: string, steamId: string): Promise<SteamPlayerSummary> {
  const url = new URL(PLAYER_SUMMARIES_API);
  url.search = new URLSearchParams({
    key: apiKey.trim(),
    steamids: steamId,
  }).toString();

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Steam API error: HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    response?: {
      players?: Array<{
        steamid: string;
        personaname?: string;
        avatarfull?: string;
        avatar?: string;
        communityvisibilitystate?: number;
      }>;
    };
  };

  const player = data.response?.players?.[0];
  if (!player) {
    throw new Error(`Steam profile not found for ID ${steamId}.`);
  }

  const isProfilePublic = player.communityvisibilitystate === 3;
  let gameCount: number | undefined;

  if (isProfilePublic) {
    try {
      const gamesUrl = new URL(OWNED_GAMES_API);
      gamesUrl.search = new URLSearchParams({
        key: apiKey.trim(),
        steamid: steamId,
        format: "json",
      }).toString();

      const gamesRes = await fetch(gamesUrl.toString());
      if (gamesRes.ok) {
        const gamesData = (await gamesRes.json()) as { response?: { game_count?: number } };
        gameCount = gamesData.response?.game_count;
      }
    } catch {
      // Non-fatal
    }
  }

  return {
    steamId: player.steamid,
    personaName: player.personaname || `Player ${steamId}`,
    avatarUrl: player.avatarfull || player.avatar || "https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg",
    isProfilePublic,
    gameCount,
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

    const res = await fetch(url.toString());
    if (res.status === 403) {
      return { valid: false, error: "Invalid Steam API key (HTTP 403 Forbidden)." };
    }
    if (!res.ok) {
      return { valid: false, error: `Steam API returned HTTP ${res.status}` };
    }
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Failed to connect to Steam Web API.",
    };
  }
}
