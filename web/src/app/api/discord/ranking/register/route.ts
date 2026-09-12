import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const applicationId = String(body.applicationId || "").trim();
    const botToken = String(body.botToken || "").trim();
    const guildId = String(body.guildId || "").trim();

    if (!applicationId) {
      return NextResponse.json(
        { success: false, error: "Discord Application ID is required." },
        { status: 400 }
      );
    }

    if (!botToken) {
      return NextResponse.json(
        { success: false, error: "Discord Bot Token is required to register slash commands." },
        { status: 400 }
      );
    }

    const isGuild = Boolean(guildId);
    const url = isGuild
      ? `https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`
      : `https://discord.com/api/v10/applications/${applicationId}/commands`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "ranking",
        description: "Shows who spent the most and bought the most games in the group",
        type: 1,
      }),
    });

    const resData = await response.json();

    if (!response.ok) {
      const errorMsg =
        resData.message || resData.error || `HTTP ${response.status}: Failed to register command with Discord.`;
      return NextResponse.json({ success: false, error: errorMsg }, { status: response.status });
    }

    return NextResponse.json({
      success: true,
      commandId: resData.id,
      commandName: resData.name,
      isGuild,
      guildId: isGuild ? guildId : null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Network or server error registering command.",
      },
      { status: 500 }
    );
  }
}
