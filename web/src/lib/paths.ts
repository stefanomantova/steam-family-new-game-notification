import path from "node:path";
import { existsSync } from "node:fs";

export function getProjectRoot(): string {
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
