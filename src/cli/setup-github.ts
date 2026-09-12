import { applyGitHubSetup } from "../application/github-setup.js";
import { loadConfig } from "../config/environment.js";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const dryRun = process.argv.includes("--dry-run");
const templateRepo = argument("--template") || "stefanomantova/steam-family-new-game-notification";
const targetRepo = argument("--repo");

try {
  if (!targetRepo) throw new Error("Usage: setup-github --repo <owner/name> [--template <owner/name>] [--dry-run]");
  const config = await loadConfig();
  const plan = await applyGitHubSetup({
    ...(process.env.GITHUB_TOKEN ? { token: process.env.GITHUB_TOKEN } : {}),
    templateRepo,
    targetRepo,
    config,
    dryRun,
  });
  console.log(JSON.stringify(plan, null, 2));
  console.log(dryRun ? "Dry run complete. No GitHub changes were made." : "GitHub setup complete.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
