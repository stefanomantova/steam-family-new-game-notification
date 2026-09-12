import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse as parseDotenv } from "dotenv";
import { getProjectRoot } from "@/lib/paths";

function detectGithubRepo(root: string): string {
  // 1. Try reading .git/config
  const gitConfigPath = path.resolve(root, ".git", "config");
  if (existsSync(gitConfigPath)) {
    try {
      const content = readFileSync(gitConfigPath, "utf8");
      const match = content.match(/github\.com[:/]([^\s/]+\/[^\s/.]+)(?:\.git)?/i);
      if (match && match[1]) {
        return match[1];
      }
    } catch {}
  }

  // 2. Try reading discord-bot/wrangler.toml
  const wranglerPath = path.resolve(root, "discord-bot", "wrangler.toml");
  if (existsSync(wranglerPath)) {
    try {
      const content = readFileSync(wranglerPath, "utf8");
      const match = content.match(/GITHUB_REPO\s*=\s*"([^"]+)"/);
      if (match && match[1]) {
        return match[1];
      }
    } catch {}
  }

  return "";
}

export async function GET() {
  const root = getProjectRoot();
  const envPath = path.resolve(root, ".env");
  const membersPath = path.resolve(root, "members.json");

  let steamApiKey = "";
  let discordWebhookUrl = "";
  let messageLanguage = "EN";
  let storeCountryCode = "br";
  let members: Record<string, string> = {};

  // Ranking bot variables
  let enableRankingBot = false;
  let discordAppId = "";
  let discordPublicKey = "";
  let cloudflareAccountId = "";
  let cloudflareApiToken = "";
  let rankingBotGhToken = "";
  let workerUrl = "";
  let githubRepo = detectGithubRepo(root);

  if (existsSync(envPath)) {
    try {
      const content = readFileSync(envPath, "utf8");
      const parsed = parseDotenv(content);
      steamApiKey = parsed.STEAM_API_KEY || "";
      discordWebhookUrl = parsed.DISCORD_WEBHOOK_URL || "";
      messageLanguage = parsed.MESSAGE_LANGUAGE?.toUpperCase() === "PT" ? "PT" : "EN";
      storeCountryCode = parsed.STORE_COUNTRY_CODE?.toLowerCase() || "br";
      if (parsed.STEAM_MEMBERS) {
        try {
          members = JSON.parse(parsed.STEAM_MEMBERS);
        } catch {}
      }

      enableRankingBot = parsed.RANKING_BOT_ENABLED === "true";
      if (parsed.DISCORD_APP_ID) discordAppId = parsed.DISCORD_APP_ID;
      if (parsed.DISCORD_PUBLIC_KEY) discordPublicKey = parsed.DISCORD_PUBLIC_KEY;
      if (parsed.CLOUDFLARE_ACCOUNT_ID) cloudflareAccountId = parsed.CLOUDFLARE_ACCOUNT_ID;
      if (parsed.CLOUDFLARE_API_TOKEN) cloudflareApiToken = parsed.CLOUDFLARE_API_TOKEN;
      if (parsed.RANKING_BOT_GH_TOKEN) rankingBotGhToken = parsed.RANKING_BOT_GH_TOKEN;
      if (parsed.WORKER_URL) workerUrl = parsed.WORKER_URL;
      if (parsed.GITHUB_REPO) githubRepo = parsed.GITHUB_REPO;
    } catch {}
  }

  if (Object.keys(members).length === 0 && existsSync(membersPath)) {
    try {
      const content = readFileSync(membersPath, "utf8");
      members = JSON.parse(content);
    } catch {}
  }

  const hasExistingConfig = Boolean(steamApiKey || discordWebhookUrl || Object.keys(members).length > 0);

  return NextResponse.json({
    hasExistingConfig,
    config: {
      steamApiKey,
      discordWebhookUrl,
      messageLanguage,
      storeCountryCode,
      members,
      // Ranking bot settings
      enableRankingBot,
      discordAppId,
      discordPublicKey,
      cloudflareAccountId,
      cloudflareApiToken,
      rankingBotGhToken,
      workerUrl,
      githubRepo,
    },
  });
}

