import { readFile } from "node:fs/promises";
import { config as loadDotenv } from "dotenv";
import type { Members } from "../domain/models.js";
import type { MessageLanguage } from "../domain/messages.js";

loadDotenv();

export interface AppConfig {
  steamApiKey: string;
  discordWebhookUrl: string;
  members: Members;
  stateFile: string;
  statsFile: string;
  membersFile: string;
  storeCountryCode: string;
  messageLanguage: MessageLanguage;
}

export interface SharedConfig {
  members: Members;
  statsFile: string;
  storeCountryCode: string;
  messageLanguage: MessageLanguage;
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Set the ${name} environment variable.`);
  }
  return value;
}

async function loadJsonFile<T>(path: string, fallback: T): Promise<T> {
  try {
    const contents = await readFile(path, "utf8");
    return JSON.parse(contents) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

export async function loadMembers(membersFile: string): Promise<Members> {
  const raw = process.env.STEAM_MEMBERS?.trim();
  if (raw) {
    try {
      return JSON.parse(raw) as Members;
    } catch (error) {
      throw new Error(`STEAM_MEMBERS is not valid JSON: ${(error as Error).message}`);
    }
  }

  return loadJsonFile<Members>(membersFile, {});
}

export async function loadSharedConfig(): Promise<SharedConfig> {
  const membersFile = process.env.MEMBERS_FILE?.trim() || "members.json";
  return {
    members: await loadMembers(membersFile),
    statsFile: process.env.STATS_FILE?.trim() || "stats.json",
    storeCountryCode: process.env.STORE_COUNTRY_CODE?.trim().toLowerCase() || "br",
    messageLanguage: normalizeMessageLanguage(process.env.MESSAGE_LANGUAGE),
  };
}

export async function loadConfig(): Promise<AppConfig> {
  const membersFile = process.env.MEMBERS_FILE?.trim() || "members.json";
  const shared = await loadSharedConfig();

  return {
    steamApiKey: requiredEnvironment("STEAM_API_KEY"),
    discordWebhookUrl: requiredEnvironment("DISCORD_WEBHOOK_URL"),
    members: shared.members,
    stateFile: process.env.STATE_FILE?.trim() || "state.json",
    statsFile: shared.statsFile,
    membersFile,
    storeCountryCode: shared.storeCountryCode,
    messageLanguage: shared.messageLanguage,
  };
}

function normalizeMessageLanguage(value: string | undefined): MessageLanguage {
  return value?.trim().toUpperCase() === "PT" ? "PT" : "EN";
}
