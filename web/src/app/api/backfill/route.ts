import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse as parseDotenv } from "dotenv";
import { getProjectRoot } from "@/lib/paths";
import { backfillPurchase } from "../../../../../src/application/backfill-purchase";
import { JsonStatsRepository } from "../../../../../src/adapters/json-repositories";
import { SteamStoreClient } from "../../../../../src/adapters/steam-store-client";
import { DiscordWebhookNotifier } from "../../../../../src/adapters/discord-webhook-notifier";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const root = getProjectRoot();
    const env = existsSync(path.join(root, ".env")) ? parseDotenv(readFileSync(path.join(root, ".env"), "utf8")) : {};
    const members = existsSync(path.join(root, "members.json")) ? JSON.parse(readFileSync(path.join(root, "members.json"), "utf8")) : {};
    const steamId = String(body.steamId || "").trim();
    const appid = String(body.appid || "").trim();
    if (!/^\d{17}$/.test(steamId) || !/^\d+$/.test(appid)) {
      return NextResponse.json({ success: false, error: "SteamID64 and AppID are required." }, { status: 400 });
    }
    const result = await backfillPurchase(
      { members, storeCountryCode: env.STORE_COUNTRY_CODE || "br", messageLanguage: env.MESSAGE_LANGUAGE === "PT" ? "PT" : "EN" },
      { steamId, appid, gameName: body.gameName ? String(body.gameName) : undefined, manualPrice: body.manualPrice === "" || body.manualPrice == null ? undefined : Number(body.manualPrice), manualCurrency: body.manualCurrency ? String(body.manualCurrency) : undefined, notify: Boolean(body.notify), dryRun: Boolean(body.dryRun) },
      {
        store: new SteamStoreClient(),
        stats: new JsonStatsRepository(path.join(root, "stats.json")),
        ...(Boolean(body.notify) && env.DISCORD_WEBHOOK_URL ? { notifier: new DiscordWebhookNotifier(env.DISCORD_WEBHOOK_URL) } : {}),
      },
    );
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Backfill failed." }, { status: 500 });
  }
}
