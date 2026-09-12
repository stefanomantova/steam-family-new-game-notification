import { NextResponse } from "next/server";
import { verifySteamApiKey } from "@/lib/steam";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const steamApiKey = String(body.steamApiKey || "").trim();
    if (!steamApiKey) {
      return NextResponse.json({ valid: false, error: "Steam API key is required." }, { status: 400 });
    }

    const result = await verifySteamApiKey(steamApiKey);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { valid: false, error: error instanceof Error ? error.message : "Internal error verifying key" },
      { status: 500 }
    );
  }
}
