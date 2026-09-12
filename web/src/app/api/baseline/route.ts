import { NextResponse } from "next/server";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { parse as parseDotenv } from "dotenv";
import { getProjectRoot } from "@/lib/paths";

const GET_OWNED_GAMES_URL = "https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/";

export async function POST(req: Request) {
  const logs: string[] = [];
  const log = (msg: string) => logs.push(msg);
  let body: Record<string, any> = {};

  try {
    const root = getProjectRoot();
    const envPath = path.resolve(root, ".env");
    const membersPath = path.resolve(root, "members.json");
    const statePath = path.resolve(root, "state.json");
    const statsPath = path.resolve(root, "stats.json");

    let steamApiKey = "";
    let members: Record<string, string> = {};

    if (existsSync(envPath)) {
      const content = await readFile(envPath, "utf8");
      const parsed = parseDotenv(content);
      steamApiKey = parsed.STEAM_API_KEY || "";
      if (parsed.STEAM_MEMBERS) {
        try {
          members = JSON.parse(parsed.STEAM_MEMBERS);
        } catch {}
      }
    }

    if (Object.keys(members).length === 0 && existsSync(membersPath)) {
      members = JSON.parse(await readFile(membersPath, "utf8"));
    }

    // Allow payload override
    try {
      body = await req.json();
      if (body.steamApiKey) steamApiKey = body.steamApiKey;
      if (body.members) members = body.members;
    } catch {}

    if (!steamApiKey) {
      return NextResponse.json({ success: false, error: "Steam API key is required to run baseline.", logs }, { status: 400 });
    }

    const memberEntries = Object.entries(members);
    if (memberEntries.length === 0) {
      return NextResponse.json({ success: false, error: "No family members found to run baseline.", logs }, { status: 400 });
    }

    log(`Starting baseline scan for ${memberEntries.length} family members...`);
    const currentState: Record<string, Record<string, string>> = {};
    let totalGames = 0;

    for (const [steamId, name] of memberEntries) {
      log(`Checking ${name}'s library (${steamId})...`);

      const url = new URL(GET_OWNED_GAMES_URL);
      url.search = new URLSearchParams({
        key: steamApiKey,
        steamid: steamId,
        format: "json",
        include_appinfo: "1",
        include_played_free_games: "1",
      }).toString();

      try {
        const res = await fetch(url.toString());
        if (!res.ok) {
          log(`⚠️ Failed to fetch library for ${name}: HTTP ${res.status}`);
          continue;
        }

        const data = (await res.json()) as {
          response?: { games?: Array<{ appid: number; name?: string }> };
        };

        const games = data.response?.games ?? [];
        log(`✓ Retrieved ${games.length} games for ${name}`);

        const library: Record<string, string> = {};
        for (const game of games) {
          library[String(game.appid)] = game.name ?? `App ${game.appid}`;
        }

        currentState[steamId] = library;
        totalGames += games.length;
      } catch (err) {
        log(`❌ Error fetching ${name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const isDryRun = Boolean(body.dryRun);

    if (isDryRun) {
      log(`[Dry Run] Scanned ${totalGames} games across ${memberEntries.length} members. No files were written to disk.`);
    } else {
      log(`Writing library baseline to state.json (${totalGames} entries)...`);
      await writeFile(statePath, JSON.stringify(currentState, null, 2), "utf8");

      // Initialize stats.json if not present
      if (!existsSync(statsPath)) {
        await writeFile(statsPath, JSON.stringify({ currency: null, members: {} }, null, 2), "utf8");
        log("Initialized stats.json.");
      }
    }

    log(isDryRun ? "🧪 Dry Run baseline test complete!" : "🎉 Baseline check complete! Future runs will now accurately detect new game additions.");

    return NextResponse.json({
      success: true,
      dryRun: isDryRun,
      logs,
      totalGames,
      membersProcessed: memberEntries.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Baseline execution failed.",
        logs,
      },
      { status: 500 }
    );
  }
}
