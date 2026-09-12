import { NextResponse } from "next/server";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { getProjectRoot } from "@/lib/paths";

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
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to save configuration." },
      { status: 500 }
    );
  }
}

