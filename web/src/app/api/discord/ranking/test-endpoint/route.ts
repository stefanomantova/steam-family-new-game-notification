import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let workerUrl = String(body.workerUrl || "").trim();

    if (!workerUrl) {
      return NextResponse.json(
        { success: false, error: "Cloudflare Worker URL is required." },
        { status: 400 }
      );
    }

    if (!workerUrl.startsWith("http://") && !workerUrl.startsWith("https://")) {
      workerUrl = `https://${workerUrl}`;
    }

    try {
      new URL(workerUrl);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid URL format. Example: https://steam-family-ranking-bot.subdomain.workers.dev" },
        { status: 400 }
      );
    }

    const response = await fetch(workerUrl, {
      method: "GET",
      headers: {
        "User-Agent": "SteamFamilyNotifier-SetupWizard/1.0",
      },
    });

    const text = await response.text();

    if (response.ok && text.includes("Steam Family Notifier ranking bot is running")) {
      return NextResponse.json({
        success: true,
        status: response.status,
        message: "Worker is online and verified!",
        workerUrl,
      });
    }

    if (response.ok) {
      return NextResponse.json({
        success: true,
        status: response.status,
        message: `Worker responded with HTTP ${response.status}, but return text was: "${text.slice(0, 100)}". It appears to be running!`,
        workerUrl,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: `Worker returned HTTP ${response.status}: ${text.slice(0, 200)}`,
      },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to reach Cloudflare Worker URL.",
      },
      { status: 500 }
    );
  }
}
