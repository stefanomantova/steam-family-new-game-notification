import path from "node:path";
import { existsSync } from "node:fs";

export function getProjectRoot(): string {
  if (process.env.STEAM_FAMILY_PROJECT_ROOT) {
    return process.env.STEAM_FAMILY_PROJECT_ROOT;
  }
  const cwd = process.cwd();
  // If running inside web/ directory
  if (existsSync(path.resolve(cwd, "..", "package.json")) && existsSync(path.resolve(cwd, "..", "state.json"))) {
    return path.resolve(cwd, "..");
  }
  // If running from repository root
  if (existsSync(path.resolve(cwd, "state.json")) && existsSync(path.resolve(cwd, "package.json"))) {
    return cwd;
  }
  return path.resolve(cwd, "..");
}
