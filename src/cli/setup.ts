import { access, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  renderEnvFile,
  renderMembersFile,
  renderSetupSummary,
  validateSetupInput,
  type SetupInput,
} from "../application/setup.js";

const dryRun = process.argv.includes("--dry-run");
console.log("Tip: You can also use the visual Web UI wizard by running: npm run setup:ui\n");
const readline = createInterface({ input, output });

try {
  const setup = await collectSetupInput();
  const errors = validateSetupInput(setup);
  if (errors.length > 0) {
    throw new Error(`Setup could not continue:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  }

  if (dryRun) {
    console.log(renderSetupSummary(setup));
    console.log("\nDry run: no files were written.");
  } else {
    await writeNewFile(".env", renderEnvFile(setup));
    await writeNewFile("members.json", renderMembersFile(setup.members));
    console.log(renderSetupSummary(setup));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  readline.close();
}

async function collectSetupInput(): Promise<SetupInput> {
  const steamApiKey = await readline.question("Steam API key: ");
  const discordWebhookUrl = await readline.question("Discord webhook URL: ");
  const messageLanguage = (await readline.question("Message language [EN]: ")).trim().toUpperCase() || "EN";
  const storeCountryCode = (await readline.question("Store country code [br]: ")).trim().toLowerCase() || "br";

  console.log("Enter one member per line as SteamID64=Display Name. Submit an empty line when finished.");
  const members: Record<string, string> = {};
  while (true) {
    const line = (await readline.question("> ")).trim();
    if (!line) {
      break;
    }
    const separator = line.indexOf("=");
    if (separator < 1) {
      console.log("Use the format SteamID64=Display Name.");
      continue;
    }
    members[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }

  return {
    steamApiKey,
    discordWebhookUrl,
    members,
    messageLanguage: messageLanguage as SetupInput["messageLanguage"],
    storeCountryCode,
  };
}

async function writeNewFile(path: string, contents: string): Promise<void> {
  try {
    await access(path, constants.F_OK);
    throw new Error(`${path} already exists. Remove it manually if you want setup to replace it.`);
  } catch (error) {
    if (error instanceof Error && !("code" in error)) {
      throw error;
    }
  }

  await writeFile(path, contents, { encoding: "utf8", flag: "wx" });
}