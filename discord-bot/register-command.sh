#!/usr/bin/env bash
# Registers the /ranking slash command with Discord. Run this once
# (and again any time you change the command's name/description).
#
# Usage:
#   DISCORD_APP_ID=... DISCORD_BOT_TOKEN=... ./register-command.sh
#
# Optional: set GUILD_ID to register the command for a single server
# only (shows up instantly, good for testing). Without it, the command
# is registered globally (can take up to ~1 hour to show up everywhere).
#
#   DISCORD_APP_ID=... DISCORD_BOT_TOKEN=... GUILD_ID=... ./register-command.sh

set -euo pipefail

if [[ -z "${DISCORD_APP_ID:-}" || -z "${DISCORD_BOT_TOKEN:-}" ]]; then
  echo "Set DISCORD_APP_ID and DISCORD_BOT_TOKEN environment variables first." >&2
  exit 1
fi

if [[ -n "${GUILD_ID:-}" ]]; then
  URL="https://discord.com/api/v10/applications/${DISCORD_APP_ID}/guilds/${GUILD_ID}/commands"
else
  URL="https://discord.com/api/v10/applications/${DISCORD_APP_ID}/commands"
fi

curl -sS -X POST "$URL" \
  -H "Authorization: Bot ${DISCORD_BOT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ranking",
    "description": "Shows who spent the most and bought the most games in the group",
    "type": 1
  }'

echo
echo "Done. Global commands can take up to an hour to appear; guild commands show up instantly."
