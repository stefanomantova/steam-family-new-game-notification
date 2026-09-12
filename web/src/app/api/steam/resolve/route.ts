import { NextResponse } from "next/server";
import { fetchPlayerSummary, resolveToSteamId } from "@/lib/steam";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const steamApiKey = String(body.steamApiKey || "").trim();
    const input = String(body.input || "").trim();

    if (!steamApiKey) {
      return NextResponse.json({ success: false, error: "Steam API key is required." }, { status: 400 });
    }
    if (!input) {
      return NextResponse.json({ success: false, error: "Member identifier or URL is required." }, { status: 400 });
    }

    const steamId = await resolveToSteamId(steamApiKey, input);
    const player = await fetchPlayerSummary(steamApiKey, steamId);

    return NextResponse.json({ success: true, player });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to resolve member." },
      { status: 400 }
    );
  }
}
