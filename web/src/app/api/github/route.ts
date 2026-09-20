import { NextResponse } from "next/server";
import { applyGitHubSetup } from "../../../../../src/application/github-setup";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const targetRepo = String(body.targetRepo || "").trim();
    const templateRepo = String(body.templateRepo || "stefanomantova/steam-family-new-game-notification").trim();
    const dryRun = Boolean(body.dryRun);

    if (!/^[^/]+\/[^/]+$/.test(targetRepo)) {
      return NextResponse.json({ success: false, error: "Target repository must use owner/name format." }, { status: 400 });
    }

    const members = (body.members || {}) as Record<string, string>;
    if (!String(body.steamApiKey || "").trim() || !String(body.discordWebhookUrl || "").trim() || Object.keys(members).length === 0) {
      return NextResponse.json({ success: false, error: "Complete Steam, Discord, and family member setup first." }, { status: 400 });
    }

    const plan = await applyGitHubSetup({
      ...(String(body.githubToken || "").trim() ? { token: String(body.githubToken).trim() } : {}),
      templateRepo,
      targetRepo,
      config: {
        steamApiKey: String(body.steamApiKey).trim(),
        discordWebhookUrl: String(body.discordWebhookUrl).trim(),
        members,
        messageLanguage: body.messageLanguage === "PT" ? "PT" : "EN",
        storeCountryCode: String(body.storeCountryCode || "br").trim().toLowerCase(),
        rankingBotGhToken: String(body.rankingBotGhToken || "").trim(),
      },
      dryRun,
    });

    return NextResponse.json({ success: true, plan });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "GitHub setup failed." }, { status: 500 });
  }
}
