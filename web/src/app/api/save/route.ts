import { NextResponse } from "next/server";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { getProjectRoot } from "@/lib/paths";

type Library = Record<string, string>;

async function fetchLibrary(steamApiKey: string, steamId: string): Promise<Library> {
  const url = new URL("https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/");
  url.search = new URLSearchParams({ key: steamApiKey, steamid: steamId, format: "json", include_appinfo: "1", include_played_free_games: "1" }).toString();
  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`Steam returned HTTP ${response.status} for ${steamId}.`);
  const data = (await response.json()) as { response?: { games?: Array<{ appid: number; name?: string }> } };
  return Object.fromEntries((data.response?.games ?? []).map((game) => [String(game.appid), game.name ?? `App ${game.appid}`]));
}

async function sendWebhook(url: string, content: string): Promise<void> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
  if (!response.ok) throw new Error(`Discord returned HTTP ${response.status}.`);
}

function dotenvValue(value: string): string {
  if (/^[A-Za-z0-9_./:-]+$/.test(value)) {
    return value;
  }
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const steamApiKey = String(body.steamApiKey || "").trim();
    const discordWebhookUrl = String(body.discordWebhookUrl || "").trim();
    const members = (body.members || {}) as Record<string, string>;
    const messageLanguage = body.messageLanguage === "PT" ? "PT" : "EN";
    const storeCountryCode = String(body.storeCountryCode || "br").trim().toLowerCase();

    // Ranking bot fields
    const enableRankingBot = Boolean(body.enableRankingBot);
    const discordAppId = String(body.discordAppId || "").trim();
    const discordPublicKey = String(body.discordPublicKey || "").trim();
    const cloudflareAccountId = String(body.cloudflareAccountId || "").trim();
    const cloudflareApiToken = String(body.cloudflareApiToken || "").trim();
    const rankingBotGhToken = String(body.rankingBotGhToken || "").trim();
    const workerUrl = String(body.workerUrl || "").trim();
    const githubRepo = String(body.githubRepo || "").trim();

    const errors: string[] = [];

    if (!steamApiKey) {
      errors.push("STEAM_API_KEY is required.");
    }

    if (!/^https:\/\/(?:discord\.com|discordapp\.com)\/api\/webhooks\/[^/]+\/[^/]+/.test(discordWebhookUrl)) {
      errors.push("DISCORD_WEBHOOK_URL must be a valid Discord webhook URL.");
    }

    const memberEntries = Object.entries(members);
    if (memberEntries.length === 0) {
      errors.push("At least one Steam family member is required.");
    }

    for (const [steamId, name] of memberEntries) {
      if (!/^\d{17}$/.test(steamId)) {
        errors.push(`SteamID64 must be 17 digits: ${steamId}`);
      }
      if (!String(name || "").trim()) {
        errors.push(`Display name is required for member ${steamId}`);
      }
    }

    if (!/^[a-z]{2}$/.test(storeCountryCode)) {
      errors.push("Store country code must be a 2-letter code (e.g. br, us).");
    }

    if (errors.length > 0) {
      return NextResponse.json({ success: false, errors }, { status: 400 });
    }

    const root = getProjectRoot();
    const envPath = path.resolve(root, ".env");
    const membersPath = path.resolve(root, "members.json");
    const wranglerPath = path.resolve(root, "discord-bot", "wrangler.toml");

    const isDryRun = Boolean(body.dryRun);
    const isManagement = Boolean(body.management);

    const previousMembers = existsSync(membersPath) ? JSON.parse(await readFile(membersPath, "utf8")) as Record<string, string> : {};
    const addedIds = isManagement ? memberEntries.map(([id]) => id).filter((id) => !previousMembers[id]) : [];
    const removedIds = isManagement ? Object.keys(previousMembers).filter((id) => !members[id]) : [];
    const notifications: string[] = [];

    const envLines = [
      `STEAM_API_KEY=${dotenvValue(steamApiKey)}`,
      `DISCORD_WEBHOOK_URL=${dotenvValue(discordWebhookUrl)}`,
      "MEMBERS_FILE=members.json",
      `MESSAGE_LANGUAGE=${messageLanguage}`,
      `STORE_COUNTRY_CODE=${storeCountryCode}`,
    ];

    if (enableRankingBot) {
      envLines.push(`RANKING_BOT_ENABLED=true`);
      if (discordAppId) envLines.push(`DISCORD_APP_ID=${dotenvValue(discordAppId)}`);
      if (discordPublicKey) envLines.push(`DISCORD_PUBLIC_KEY=${dotenvValue(discordPublicKey)}`);
      if (cloudflareAccountId) envLines.push(`CLOUDFLARE_ACCOUNT_ID=${dotenvValue(cloudflareAccountId)}`);
      if (cloudflareApiToken) envLines.push(`CLOUDFLARE_API_TOKEN=${dotenvValue(cloudflareApiToken)}`);
      if (rankingBotGhToken) envLines.push(`RANKING_BOT_GH_TOKEN=${dotenvValue(rankingBotGhToken)}`);
      if (workerUrl) envLines.push(`WORKER_URL=${dotenvValue(workerUrl)}`);
      if (githubRepo) envLines.push(`GITHUB_REPO=${dotenvValue(githubRepo)}`);
    }

    envLines.push("");
    const envContent = envLines.join("\n");
    const membersContent = `${JSON.stringify(members, null, 2)}\n`;

    if (!isDryRun) {
      await writeFile(envPath, envContent, "utf8");
      await writeFile(membersPath, membersContent, "utf8");

      if (isManagement && (addedIds.length || removedIds.length)) {
        const statePath = path.resolve(root, "state.json");
        const state: Record<string, Library> = existsSync(statePath) ? JSON.parse(await readFile(statePath, "utf8")) : {};
        const oldUnion = new Set(Object.keys(state).filter((id) => !addedIds.includes(id)).flatMap((id) => Object.keys(state[id] ?? {})));
        const diffId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const diff: Record<string, unknown> = { id: diffId, createdAt: new Date().toISOString(), members: [] };
        const diffMembers: Array<{ name: string; games: Array<{ appid: string; name: string }> }> = [];

        for (const id of addedIds) {
          const library = await fetchLibrary(steamApiKey, id);
          state[id] = library;
          const games = Object.entries(library).filter(([appid]) => !oldUnion.has(appid)).map(([appid, name]) => ({ appid, name }));
          diffMembers.push({ name: members[id], games });
        }
        for (const id of removedIds) delete state[id];
        await writeFile(statePath, JSON.stringify(state, null, 2), "utf8");

        if (addedIds.length) {
          const diffsPath = path.resolve(root, "member-diffs.json");
          const diffs = existsSync(diffsPath) ? JSON.parse(await readFile(diffsPath, "utf8")) : {};
          (diff as { members: unknown[] }).members = diffMembers;
          diffs[diffId] = diff;
          await writeFile(diffsPath, JSON.stringify(diffs, null, 2), "utf8");
          const link = `${String(body.appUrl || process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/family/${diffId}`;
          for (const member of diffMembers) {
            notifications.push(messageLanguage === "PT"
              ? `🎮 ${member.name} entrou na família! Clica aqui pra ter acesso aos jogos novos que ele trouxe! ${link}`
              : `🎮 ${member.name} joined the family! Click here to see the new games they brought! ${link}`);
          }
        }
        for (const id of removedIds) {
          notifications.push(messageLanguage === "PT"
            ? `👋 Membro ${previousMembers[id]} foi removido e não compartilha mais sua biblioteca!`
            : `👋 Member ${previousMembers[id]} was removed and no longer shares their library!`);
        }
        if (notifications.length) await sendWebhook(discordWebhookUrl, notifications.join("\n"));
      }

      // Update wrangler.toml GITHUB_REPO if githubRepo is specified
      if (githubRepo && existsSync(wranglerPath)) {
        try {
          let wranglerContent = await readFile(wranglerPath, "utf8");
          if (wranglerContent.includes("GITHUB_REPO")) {
            wranglerContent = wranglerContent.replace(
              /GITHUB_REPO\s*=\s*"[^"]*"/,
              `GITHUB_REPO = "${githubRepo}"`
            );
            await writeFile(wranglerPath, wranglerContent, "utf8");
          }
        } catch {}
      }
    }

    return NextResponse.json({
      success: true,
      dryRun: isDryRun,
      envContent,
      membersContent,
      summary: {
        memberCount: memberEntries.length,
        language: messageLanguage,
        country: storeCountryCode,
        rankingBotEnabled: enableRankingBot,
        githubRepo,
        envPath,
        membersPath,
        notifications,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to save configuration." },
      { status: 500 }
    );
  }
}
