import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const discordWebhookUrl = String(body.discordWebhookUrl || "").trim();

    if (!discordWebhookUrl) {
      return NextResponse.json({ success: false, error: "Discord webhook URL is required." }, { status: 400 });
    }

    if (!/^https:\/\/(?:discord\.com|discordapp\.com)\/api\/webhooks\/[^/]+\/[^/]+/.test(discordWebhookUrl)) {
      return NextResponse.json(
        { success: false, error: "Must be a valid Discord webhook URL (discord.com/api/webhooks/...)." },
        { status: 400 }
      );
    }

    const response = await fetch(discordWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: "🎮 Steam Family Notifier — Test Successful",
            description:
              "Connection verified! When family members acquire new games, announcements will be posted in this channel.",
            color: 0x5865f2,
            timestamp: new Date().toISOString(),
            footer: { text: "Steam Family Notifier Setup" },
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { success: false, error: `Discord returned HTTP ${response.status}: ${errText}` },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to connect to Discord." },
      { status: 500 }
    );
  }
}
