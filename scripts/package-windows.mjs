import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = resolve(projectRoot, "dist-windows");
const appRoot = join(outputRoot, "SteamFamilyNotifier");

await rm(outputRoot, { recursive: true, force: true });
await mkdir(appRoot, { recursive: true });

await cp(resolve(projectRoot, "dist"), join(appRoot, "dist"), { recursive: true });
await cp(resolve(projectRoot, "src", "setup-server", "ui"), join(appRoot, "src", "setup-server", "ui"), { recursive: true });
await cp(resolve(projectRoot, "node_modules", "dotenv"), join(appRoot, "node_modules", "dotenv"), { recursive: true });
await cp(resolve(projectRoot, "node_modules", "tweetnacl"), join(appRoot, "node_modules", "tweetnacl"), { recursive: true });
await cp(process.execPath, join(appRoot, "node.exe"));
await writeFile(join(appRoot, "package.json"), JSON.stringify({ type: "module" }, null, 2) + "\n", "utf8");

await writeFile(join(appRoot, "run-setup.cmd"), [
  "@echo off",
  "cd /d \"%~dp0\"",
  "node.exe dist\\cli\\setup.js",
  "",
].join("\r\n"), "utf8");

await writeFile(join(appRoot, "run-github-setup.cmd"), [
  "@echo off",
  "cd /d \"%~dp0\"",
  "node.exe dist\\cli\\setup-github.js %*",
  "",
].join("\r\n"), "utf8");

await writeFile(join(appRoot, "run-check.cmd"), [
  "@echo off",
  "cd /d \"%~dp0\"",
  "node.exe dist\\cli\\check-new-games.js",
  "",
].join("\r\n"), "utf8");

await writeFile(join(appRoot, "README.txt"), [
  "Steam Family Notifier - portable Windows package",
  "",
  "1. Run run-setup.cmd and complete the browser wizard.",
  "2. Use the dry-run option to validate configuration without writing files.",
  "3. Run run-check.cmd for a manual check.",
  "",
  "This package does not include credentials. Keep .env and members.json private.",
  "For 24/7 cloud polling, use the GitHub Actions workflow in your private repository.",
  "",
].join("\r\n"), "utf8");

console.log(`Windows package created at ${appRoot}`);
