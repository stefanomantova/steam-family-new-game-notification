import { describe, expect, it } from "vitest";
import {
  renderEnvFile,
  renderMembersFile,
  renderSetupSummary,
  validateSetupInput,
  type SetupInput,
} from "./setup.js";

const validSetup: SetupInput = {
  steamApiKey: "steam-key",
  discordWebhookUrl: "https://discord.com/api/webhooks/123/token",
  members: { "76561198000000001": "Alice" },
  messageLanguage: "EN",
  storeCountryCode: "br",
};

describe("setup configuration", () => {
  it("accepts valid input and renders local configuration files", () => {
    expect(validateSetupInput(validSetup)).toEqual([]);
    expect(renderEnvFile(validSetup)).toContain("MEMBERS_FILE=members.json");
    expect(renderEnvFile(validSetup)).toContain("DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/123/token");
    expect(renderMembersFile(validSetup.members)).toContain('"76561198000000001": "Alice"');
  });

  it("rejects incomplete and malformed input", () => {
    const errors = validateSetupInput({
      ...validSetup,
      steamApiKey: "",
      discordWebhookUrl: "https://example.com/webhook",
      members: { invalid: "" },
      messageLanguage: "FR" as SetupInput["messageLanguage"],
      storeCountryCode: "brazil",
    });

    expect(errors).toEqual([
      "STEAM_API_KEY is required.",
      "DISCORD_WEBHOOK_URL must be a Discord webhook URL.",
      "SteamID64 must contain exactly 17 digits: invalid",
      "Member name is required for SteamID64 invalid.",
      "MESSAGE_LANGUAGE must be EN or PT.",
      "STORE_COUNTRY_CODE must be a two-letter country code.",
    ]);
  });

  it("quotes values that need dotenv escaping", () => {
    const env = renderEnvFile({
      ...validSetup,
      steamApiKey: "key with spaces",
    });

    expect(env).toContain('STEAM_API_KEY="key with spaces"');
  });

  it("does not expose secrets in the setup summary", () => {
    const summary = renderSetupSummary(validSetup);

    expect(summary).not.toContain(validSetup.steamApiKey);
    expect(summary).not.toContain(validSetup.discordWebhookUrl);
    expect(summary).toContain("Members: 1");
  });
});