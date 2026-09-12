import nacl from "tweetnacl";
import type { Members } from "../domain/models.js";

const API_ROOT = "https://api.github.com";

export interface GitHubSetupConfig {
  steamApiKey: string;
  discordWebhookUrl: string;
  members: Members;
  messageLanguage: string;
  storeCountryCode: string;
}

export interface GitHubSetupOptions {
  token?: string;
  templateRepo: string;
  targetRepo: string;
  config: GitHubSetupConfig;
  dryRun: boolean;
}

export interface GitHubSetupPlan {
  templateRepo: string;
  targetRepo: string;
  privateRepository: boolean;
  actions: string[];
  secrets: string[];
  dryRun: boolean;
}

export function createGitHubSetupPlan(options: GitHubSetupOptions): GitHubSetupPlan {
  if (options.templateRepo.trim().toLowerCase() === options.targetRepo.trim().toLowerCase()) {
    throw new Error("Template and target repositories must be different.");
  }
  const secrets = ["STEAM_API_KEY", "DISCORD_WEBHOOK_URL", "STEAM_MEMBERS", "MESSAGE_LANGUAGE", "STORE_COUNTRY_CODE"];
  return {
    templateRepo: options.templateRepo,
    targetRepo: options.targetRepo,
    privateRepository: true,
    actions: [
      `Create private repository ${options.targetRepo} from template ${options.templateRepo} if it does not exist`,
      `Set Actions workflow permissions for ${options.targetRepo} to read and write`,
      `Upload ${secrets.length} encrypted Actions secrets`,
    ],
    secrets,
    dryRun: options.dryRun,
  };
}

export async function applyGitHubSetup(options: GitHubSetupOptions): Promise<GitHubSetupPlan> {
  const plan = createGitHubSetupPlan(options);
  if (options.dryRun) return plan;
  if (!options.token?.trim()) throw new Error("GITHUB_TOKEN is required unless --dry-run is used.");

  const [owner, name] = splitRepo(options.targetRepo);
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${options.token.trim()}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
  const existing = await githubRequest<{ full_name: string; private: boolean }>(`/repos/${owner}/${name}`, { headers }, true);
  if (existing && !existing.private) {
    throw new Error(`Refusing to upload secrets to public repository ${options.targetRepo}. Make it private first.`);
  }
  if (!existing) {
    const [templateOwner, templateName] = splitRepo(options.templateRepo);
    await githubRequest(`/repos/${templateOwner}/${templateName}/generate`, {
      method: "POST",
      headers,
      body: JSON.stringify({ owner, name, private: true, include_all_branches: false }),
    });
  }

  await githubRequest(`/repos/${owner}/${name}/actions/permissions/workflow`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ default_workflow_permissions: "write", can_approve_pull_request_reviews: false }),
  });
  const publicKey = await githubRequest<{ key_id: string; key: string }>(`/repos/${owner}/${name}/actions/secrets/public-key`, { headers });
  if (!publicKey) throw new Error("GitHub did not return an Actions secrets public key.");
  for (const [secretName, value] of Object.entries(secretValues(options.config))) {
    await githubRequest(`/repos/${owner}/${name}/actions/secrets/${secretName}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ encrypted_value: encryptSecret(value, publicKey.key), key_id: publicKey.key_id }),
    });
  }
  return plan;
}

function secretValues(config: GitHubSetupConfig): Record<string, string> {
  return {
    STEAM_API_KEY: config.steamApiKey,
    DISCORD_WEBHOOK_URL: config.discordWebhookUrl,
    STEAM_MEMBERS: JSON.stringify(config.members),
    MESSAGE_LANGUAGE: config.messageLanguage,
    STORE_COUNTRY_CODE: config.storeCountryCode,
  };
}

function encryptSecret(value: string, publicKeyBase64: string): string {
  const publicKey = Uint8Array.from(Buffer.from(publicKeyBase64, "base64"));
  const ephemeral = nacl.box.keyPair();
  const ciphertext = nacl.box(new TextEncoder().encode(value), nacl.randomBytes(nacl.box.nonceLength), publicKey, ephemeral.secretKey);
  const sealed = new Uint8Array(ephemeral.publicKey.length + ciphertext.length);
  sealed.set(ephemeral.publicKey);
  sealed.set(ciphertext, ephemeral.publicKey.length);
  return Buffer.from(sealed).toString("base64");
}

function splitRepo(value: string): [string, string] {
  const match = /^([^/]+)\/([^/]+)$/.exec(value.trim());
  if (!match) throw new Error(`Repository must use owner/name format: ${value}`);
  return [match[1]!, match[2]!];
}

async function githubRequest<T = unknown>(path: string, init: RequestInit, allowNotFound = false): Promise<T | undefined> {
  const response = await fetch(`${API_ROOT}${path}`, init);
  if (allowNotFound && response.status === 404) return undefined;
  if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}: ${await response.text()}`);
  if (response.status === 204) return undefined;
  return await response.json() as T;
}
