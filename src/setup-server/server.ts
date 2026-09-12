import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";
import { parse as parseDotenv } from "dotenv";
import {
  renderEnvFile,
  renderMembersFile,
  renderSetupSummary,
  validateSetupInput,
  type SetupInput,
} from "../application/setup.js";
import {
  fetchPlayerSummary,
  resolveToSteamId,
  verifySteamApiKey,
} from "./steam-resolver.js";
import { SteamApiClient } from "../adapters/steam-api-client.js";
import { SteamStoreClient } from "../adapters/steam-store-client.js";
import { DiscordWebhookNotifier } from "../adapters/discord-webhook-notifier.js";
import { JsonStateRepository, JsonStatsRepository } from "../adapters/json-repositories.js";
import { checkNewGames } from "../application/check-new-games.js";
import { applyGitHubSetup } from "../application/github-setup.js";

const DEFAULT_PORT = 3847;

export interface ServerOptions {
  port?: number;
  openBrowser?: boolean;
}

export function startSetupServer(options: ServerOptions = {}): Promise<{ port: number; close: () => Promise<void> }> {
  const port = options.port ?? DEFAULT_PORT;
  const openBrowser = options.openBrowser ?? true;

  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        await handleRequest(req, res);
      } catch (error) {
        console.error("Server error handling request:", error);
        jsonResponse(res, 500, { error: error instanceof Error ? error.message : String(error) });
      }
    });

    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        console.error(`Port ${port} is already in use. Trying port ${port + 1}...`);
        server.listen(port + 1);
      } else {
        reject(err);
      }
    });

    server.listen(port, () => {
      const actualPort = (server.address() as { port: number }).port;
      const url = `http://localhost:${actualPort}`;
      console.log(`\n======================================================`);
      console.log(`🎮 Steam Family Notifier Setup Wizard`);
      console.log(`👉 Open in your browser: ${url}`);
      console.log(`Press Ctrl+C in terminal to quit at any time.`);
      console.log(`======================================================\n`);

      if (openBrowser) {
        openInBrowser(url);
      }

      resolve({
        port: actualPort,
        close: () =>
          new Promise<void>((resClose) => {
            server.close(() => resClose());
          }),
      });
    });
  });
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const parsedUrl = new URL(req.url ?? "/", "http://localhost");
  const pathname = parsedUrl.pathname;
  const method = req.method?.toUpperCase() ?? "GET";

  // CORS headers for local operations
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Static Assets
  if (method === "GET") {
    if (pathname === "/" || pathname === "/index.html") {
      return serveStaticFile(res, "index.html", "text/html; charset=utf-8");
    }
    if (pathname === "/style.css") {
      return serveStaticFile(res, "style.css", "text/css; charset=utf-8");
    }
    if (pathname === "/app.js") {
      return serveStaticFile(res, "app.js", "application/javascript; charset=utf-8");
    }

    // API: Load existing configuration
    if (pathname === "/api/config") {
      const existing = loadExistingConfig();
      jsonResponse(res, 200, existing);
      return;
    }
  }

  // API Endpoints
  if (method === "POST") {
    const body = await parseJsonBody(req);

    if (pathname === "/api/verify/steam") {
      const steamApiKey = String(body.steamApiKey || "").trim();
      const result = await verifySteamApiKey(steamApiKey);
      jsonResponse(res, 200, result);
      return;
    }

    if (pathname === "/api/resolve/member") {
      const steamApiKey = String(body.steamApiKey || "").trim();
      const input = String(body.input || "").trim();
      if (!steamApiKey) {
        jsonResponse(res, 400, { success: false, error: "Steam API key is required to resolve members." });
        return;
      }
      if (!input) {
        jsonResponse(res, 400, { success: false, error: "Member identifier or URL is required." });
        return;
      }

      try {
        const steamId = await resolveToSteamId(steamApiKey, input);
        const player = await fetchPlayerSummary(steamApiKey, steamId);
        jsonResponse(res, 200, { success: true, player });
      } catch (error) {
        jsonResponse(res, 400, {
          success: false,
          error: error instanceof Error ? error.message : "Failed to resolve member.",
        });
      }
      return;
    }

    if (pathname === "/api/test/discord") {
      const discordWebhookUrl = String(body.discordWebhookUrl || "").trim();
      if (!discordWebhookUrl) {
        jsonResponse(res, 400, { success: false, error: "Discord webhook URL is required." });
        return;
      }

      try {
        const response = await fetch(discordWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            embeds: [
              {
                title: "🎮 Steam Family Notifier - Test Succeeded",
                description:
                  "Your Discord webhook is configured properly! When family members acquire new games, you will be notified in this channel.",
                color: 0x5865f2,
                timestamp: new Date().toISOString(),
                footer: { text: "Steam Family Notifier Setup" },
              },
            ],
          }),
        });

        if (!response.ok) {
          throw new Error(`Discord returned HTTP ${response.status}: ${await response.text()}`);
        }

        jsonResponse(res, 200, { success: true });
      } catch (error) {
        jsonResponse(res, 400, {
          success: false,
          error: error instanceof Error ? error.message : "Failed to send Discord test message.",
        });
      }
      return;
    }

    if (pathname === "/api/github") {
      try {
        const config = (body.config || {}) as Record<string, any>;
        const plan = await applyGitHubSetup({
          ...(String(body.githubToken || "").trim() ? { token: String(body.githubToken).trim() } : {}),
          templateRepo: String(body.templateRepo || "stefanomantova/steam-family-new-game-notification"),
          targetRepo: String(body.targetRepo || ""),
          config: {
            steamApiKey: String(config.steamApiKey || ""),
            discordWebhookUrl: String(config.discordWebhookUrl || ""),
            members: (config.members || {}) as Record<string, string>,
            messageLanguage: config.messageLanguage === "PT" ? "PT" : "EN",
            storeCountryCode: String(config.storeCountryCode || "br").toLowerCase(),
          },
          dryRun: Boolean(body.dryRun),
        });
        jsonResponse(res, 200, { success: true, plan });
      } catch (error) {
        jsonResponse(res, 400, { success: false, error: error instanceof Error ? error.message : "GitHub setup failed." });
      }
      return;
    }

    if (pathname === "/api/save") {
      const input: SetupInput = {
        steamApiKey: String(body.steamApiKey || "").trim(),
        discordWebhookUrl: String(body.discordWebhookUrl || "").trim(),
        members: (body.members || {}) as Record<string, string>,
        messageLanguage: body.messageLanguage === "PT" ? "PT" : "EN",
        storeCountryCode: String(body.storeCountryCode || "br").trim().toLowerCase(),
      };

      const errors = validateSetupInput(input);
      if (errors.length > 0) {
        jsonResponse(res, 400, { success: false, errors });
        return;
      }

      const envPath = path.resolve(process.cwd(), ".env");
      const membersPath = path.resolve(process.cwd(), "members.json");

      await writeFile(envPath, renderEnvFile(input), "utf8");
      await writeFile(membersPath, renderMembersFile(input.members), "utf8");

      jsonResponse(res, 200, {
        success: true,
        summary: renderSetupSummary(input),
      });
      return;
    }

    if (pathname === "/api/run-baseline") {
      const logs: string[] = [];
      const log = (msg: string) => {
        logs.push(msg);
        console.log(`[Baseline] ${msg}`);
      };

      try {
        const envPath = path.resolve(process.cwd(), ".env");
        const membersPath = path.resolve(process.cwd(), "members.json");
        const envContent = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
        const envVars = parseDotenv(envContent);

        const steamApiKey = body.steamApiKey || envVars.STEAM_API_KEY;
        const discordWebhookUrl = body.discordWebhookUrl || envVars.DISCORD_WEBHOOK_URL;
        let members = body.members;

        if (!members && existsSync(membersPath)) {
          members = JSON.parse(readFileSync(membersPath, "utf8"));
        }

        if (!steamApiKey || !discordWebhookUrl || !members) {
          throw new Error("Cannot run baseline: Configuration is incomplete.");
        }

        const report = await checkNewGames(
          {
            members,
            storeCountryCode: body.storeCountryCode || envVars.STORE_COUNTRY_CODE || "br",
            messageLanguage: body.messageLanguage || envVars.MESSAGE_LANGUAGE || "EN",
          },
          {
            steam: new SteamApiClient(steamApiKey),
            store: new SteamStoreClient(),
            notifier: new DiscordWebhookNotifier(discordWebhookUrl),
            state: new JsonStateRepository(path.resolve(process.cwd(), "state.json")),
            stats: new JsonStatsRepository(path.resolve(process.cwd(), "stats.json")),
            log,
          },
        );

        jsonResponse(res, 200, { success: true, logs, report });
      } catch (error) {
        jsonResponse(res, 500, {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          logs,
        });
      }
      return;
    }

    if (pathname === "/api/shutdown") {
      jsonResponse(res, 200, { success: true, message: "Setup completed. Server shutting down." });
      setTimeout(() => process.exit(0), 500);
      return;
    }
  }

  jsonResponse(res, 404, { error: "Not found" });
}

function loadExistingConfig() {
  const envPath = path.resolve(process.cwd(), ".env");
  const membersPath = path.resolve(process.cwd(), "members.json");

  let steamApiKey = "";
  let discordWebhookUrl = "";
  let messageLanguage = "EN";
  let storeCountryCode = "br";
  let members: Record<string, string> = {};

  if (existsSync(envPath)) {
    try {
      const content = readFileSync(envPath, "utf8");
      const parsed = parseDotenv(content);
      steamApiKey = parsed.STEAM_API_KEY || "";
      discordWebhookUrl = parsed.DISCORD_WEBHOOK_URL || "";
      messageLanguage = parsed.MESSAGE_LANGUAGE?.toUpperCase() === "PT" ? "PT" : "EN";
      storeCountryCode = parsed.STORE_COUNTRY_CODE?.toLowerCase() || "br";
      if (parsed.STEAM_MEMBERS) {
        try {
          members = JSON.parse(parsed.STEAM_MEMBERS);
        } catch {}
      }
    } catch {}
  }

  if (Object.keys(members).length === 0 && existsSync(membersPath)) {
    try {
      const content = readFileSync(membersPath, "utf8");
      members = JSON.parse(content);
    } catch {}
  }

  const hasExistingConfig = Boolean(steamApiKey || discordWebhookUrl || Object.keys(members).length > 0);

  return {
    hasExistingConfig,
    config: {
      steamApiKey,
      discordWebhookUrl,
      messageLanguage,
      storeCountryCode,
      members,
    },
  };
}

function getUiDir(): string {
  const cwdUi = path.resolve(process.cwd(), "src/setup-server/ui");
  if (existsSync(cwdUi)) {
    return cwdUi;
  }
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const relativeUi = path.resolve(currentDir, "ui");
  if (existsSync(relativeUi)) {
    return relativeUi;
  }
  return cwdUi;
}

async function serveStaticFile(res: ServerResponse, filename: string, contentType: string): Promise<void> {
  const filePath = path.join(getUiDir(), filename);
  try {
    const data = await readFile(filePath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  } catch (err) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end(`File not found: ${filename}`);
  }
}

function jsonResponse(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

async function parseJsonBody(req: IncomingMessage): Promise<Record<string, any>> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function openInBrowser(url: string): void {
  const platform = process.platform;
  let command = "";
  if (platform === "win32") {
    command = `start "" "${url}"`;
  } else if (platform === "darwin") {
    command = `open "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }

  exec(command, (err) => {
    if (err) {
      console.log(`Could not automatically open browser. Please navigate to: ${url}`);
    }
  });
}
