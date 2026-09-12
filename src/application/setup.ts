import type { Members } from "../domain/models.js";
import type { MessageLanguage } from "../domain/messages.js";

export interface SetupInput {
  steamApiKey: string;
  discordWebhookUrl: string;
  members: Members;
  messageLanguage: MessageLanguage;
  storeCountryCode: string;
}

export function validateSetupInput(input: SetupInput): string[] {
  const errors: string[] = [];

  if (!input.steamApiKey.trim()) {
    errors.push("STEAM_API_KEY is required.");
  }

  if (!isDiscordWebhookUrl(input.discordWebhookUrl)) {
    errors.push("DISCORD_WEBHOOK_URL must be a Discord webhook URL.");
  }

  const memberEntries = Object.entries(input.members);
  if (memberEntries.length === 0) {
    errors.push("At least one Steam member is required.");
  }

  for (const [steamId, name] of memberEntries) {
    if (!/^\d{17}$/.test(steamId)) {
      errors.push(`SteamID64 must contain exactly 17 digits: ${steamId}`);
    }
    if (!name.trim()) {
      errors.push(`Member name is required for SteamID64 ${steamId}.`);
    }
  }

  if (input.messageLanguage !== "EN" && input.messageLanguage !== "PT") {
    errors.push("MESSAGE_LANGUAGE must be EN or PT.");
  }

  if (!/^[a-z]{2}$/i.test(input.storeCountryCode.trim())) {
    errors.push("STORE_COUNTRY_CODE must be a two-letter country code.");
  }

  return errors;
}

export function renderEnvFile(input: SetupInput): string {
  return [
    `STEAM_API_KEY=${dotenvValue(input.steamApiKey)}`,
    `DISCORD_WEBHOOK_URL=${dotenvValue(input.discordWebhookUrl)}`,
    "MEMBERS_FILE=members.json",
    `MESSAGE_LANGUAGE=${input.messageLanguage}`,
    `STORE_COUNTRY_CODE=${input.storeCountryCode.trim().toLowerCase()}`,
    "",
  ].join("\n");
}

export function renderMembersFile(members: Members): string {
  return `${JSON.stringify(members, null, 2)}\n`;
}

export function renderSetupSummary(input: SetupInput): string {
  const memberCount = Object.keys(input.members).length;
  return [
    "Setup is ready.",
    `- Members: ${memberCount}`,
    `- Language: ${input.messageLanguage}`,
    `- Store country: ${input.storeCountryCode.trim().toLowerCase()}`,
    "- Files: .env and members.json",
    "",
    "Next steps:",
    "1. Run `npm run build && npm run check-new-games` to initialize the baseline.",
    "2. Copy the values from .env into your repository's GitHub Actions secrets.",
    "3. Enable Actions read/write permissions so state.json and stats.json can be committed.",
  ].join("\n");
}

function isDiscordWebhookUrl(value: string): boolean {
  return /^https:\/\/(?:discord\.com|discordapp\.com)\/api\/webhooks\/[^/]+\/[^/]+/.test(value.trim());
}

function dotenvValue(value: string): string {
  if (/^[A-Za-z0-9_./:-]+$/.test(value)) {
    return value;
  }
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}