"use client";

import React, { useState } from "react";

export interface StepRankingBotProps {
  enableRankingBot: boolean;
  onChangeEnableRankingBot: (enabled: boolean) => void;
  discordAppId: string;
  onChangeDiscordAppId: (val: string) => void;
  discordBotToken: string;
  onChangeDiscordBotToken: (val: string) => void;
  discordPublicKey: string;
  onChangeDiscordPublicKey: (val: string) => void;
  discordGuildId: string;
  onChangeDiscordGuildId: (val: string) => void;
  githubRepo: string;
  onChangeGithubRepo: (val: string) => void;
  cloudflareAccountId: string;
  onChangeCloudflareAccountId: (val: string) => void;
  cloudflareApiToken: string;
  onChangeCloudflareApiToken: (val: string) => void;
  rankingBotGhToken: string;
  onChangeRankingBotGhToken: (val: string) => void;
  workerUrl: string;
  onChangeWorkerUrl: (val: string) => void;
  onToast: (msg: string) => void;
}

export function StepRankingBot({
  enableRankingBot,
  onChangeEnableRankingBot,
  discordAppId,
  onChangeDiscordAppId,
  discordBotToken,
  onChangeDiscordBotToken,
  discordPublicKey,
  onChangeDiscordPublicKey,
  discordGuildId,
  onChangeDiscordGuildId,
  githubRepo,
  onChangeGithubRepo,
  cloudflareAccountId,
  onChangeCloudflareAccountId,
  cloudflareApiToken,
  onChangeCloudflareApiToken,
  rankingBotGhToken,
  onChangeRankingBotGhToken,
  workerUrl,
  onChangeWorkerUrl,
  onToast,
}: StepRankingBotProps) {
  const [showToken, setShowToken] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registerResult, setRegisterResult] = useState<{
    success: boolean;
    text: string;
  } | null>(null);

  const [testingWorker, setTestingWorker] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    text: string;
  } | null>(null);

  const handleRegisterCommand = async () => {
    if (!discordAppId.trim() || !discordBotToken.trim()) {
      onToast("Please enter Application ID and Bot Token first.");
      return;
    }

    setRegistering(true);
    setRegisterResult(null);

    try {
      const res = await fetch("/api/discord/ranking/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: discordAppId,
          botToken: discordBotToken,
          guildId: discordGuildId,
        }),
      });

      const data = await res.json();
      if (data.success) {
        const msg = data.isGuild
          ? `✓ Command /ranking registered instantly for server ${data.guildId}!`
          : `✓ Command /ranking registered globally! (Discord global commands can take up to ~1hr to appear).`;
        setRegisterResult({ success: true, text: msg });
        onToast("Slash command registered!");
      } else {
        setRegisterResult({
          success: false,
          text: `❌ Error registering command: ${data.error}`,
        });
      }
    } catch {
      setRegisterResult({
        success: false,
        text: "❌ Network error registering slash command.",
      });
    } finally {
      setRegistering(false);
    }
  };

  const handleTestWorker = async () => {
    if (!workerUrl.trim()) {
      onToast("Please enter your Cloudflare Worker URL first.");
      return;
    }

    setTestingWorker(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/discord/ranking/test-endpoint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerUrl }),
      });

      const data = await res.json();
      if (data.success) {
        setTestResult({
          success: true,
          text: `✓ ${data.message} (Target: ${data.workerUrl})`,
        });
        onToast("Worker URL verified successfully!");
      } else {
        setTestResult({
          success: false,
          text: `❌ ${data.error}`,
        });
      }
    } catch {
      setTestResult({
        success: false,
        text: "❌ Could not connect to Worker URL.",
      });
    } finally {
      setTestingWorker(false);
    }
  };

  const discordAuthUrl = discordAppId.trim()
    ? `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(
        discordAppId.trim()
      )}&scope=applications.commands`
    : null;

  return (
    <section>
      <div className="step-title-area">
        <h2>Discord Ranking Bot (/ranking)</h2>
        <p>
          Optional serverless add-on: let members run <code>/ranking</code> in Discord to see top spenders and most games bought.
        </p>
      </div>

      {/* Main Enable Toggle Banner */}
      <div className={`ranking-toggle-banner ${enableRankingBot ? "active" : ""}`}>
        <div className="ranking-toggle-text">
          <div className="ranking-toggle-title">
            <span className="trophy-icon">🏆</span>
            <span>Enable /ranking Slash Command (Cloudflare Worker)</span>
            {enableRankingBot ? (
              <span className="badge-chip active">ENABLED</span>
            ) : (
              <span className="badge-chip">OPTIONAL</span>
            )}
          </div>
          <p className="ranking-toggle-desc">
            Runs on a free Cloudflare Worker to respond live in Discord. Pulled from your tracked <code>stats.json</code>.
          </p>
        </div>

        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={enableRankingBot}
            onChange={(e) => onChangeEnableRankingBot(e.target.checked)}
          />
          <span className="toggle-slider" />
        </label>
      </div>

      {!enableRankingBot ? (
        <div className="ranking-disabled-card">
          <div className="ranking-disabled-icon">ℹ️</div>
          <div className="ranking-disabled-content">
            <h4>Ranking Bot is currently disabled</h4>
            <p>
              You don&apos;t need to configure this to receive new game notifications in your Discord channel. You can click <b>Next</b> to proceed directly to Deployment, or turn on the toggle above anytime.
            </p>
          </div>
        </div>
      ) : (
        <div className="ranking-workflow-container">
          {/* Card 1: Discord App & Slash Command Registration */}
          <div className="ranking-card">
            <div className="ranking-card-header">
              <span className="step-num-pill">Step 1</span>
              <h3>1. Discord Developer Application</h3>
            </div>
            <p className="ranking-card-desc">
              Create a Discord Application to enable slash commands in your server.
              <a
                href="https://discord.com/developers/applications"
                target="_blank"
                rel="noreferrer"
                className="external-link"
              >
                Open Discord Developer Portal ↗
              </a>
            </p>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">
                  Application ID <span className="req">*</span>
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. 123456789012345678"
                  value={discordAppId}
                  onChange={(e) => onChangeDiscordAppId(e.target.value)}
                />
                <span className="input-hint">Found under Application &gt; General Information</span>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Public Key <span className="req">*</span>
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. 9a8b7c6d5e4f3a2b1c..."
                  value={discordPublicKey}
                  onChange={(e) => onChangeDiscordPublicKey(e.target.value)}
                />
                <span className="input-hint">Used by Cloudflare Worker to verify Discord requests</span>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Bot Token <span className="req">*</span>
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showToken ? "text" : "password"}
                    className="input"
                    placeholder="Bot token from Discord Developer Portal"
                    value={discordBotToken}
                    onChange={(e) => onChangeDiscordBotToken(e.target.value)}
                    style={{ paddingRight: "70px" }}
                  />
                  <button
                    type="button"
                    className="btn-text-toggle"
                    onClick={() => setShowToken(!showToken)}
                  >
                    {showToken ? "Hide" : "Show"}
                  </button>
                </div>
                <span className="input-hint">Found under Bot tab &gt; Reset Token / View Token</span>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Guild / Server ID <span className="opt">(Optional)</span>
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. 987654321098765432"
                  value={discordGuildId}
                  onChange={(e) => onChangeDiscordGuildId(e.target.value)}
                />
                <span className="input-hint">Instant testing in 1 server (skips 1hr global cache)</span>
              </div>
            </div>

            {/* Action Bar for Command Registration */}
            <div className="action-row" style={{ marginTop: "18px" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleRegisterCommand}
                disabled={registering}
              >
                {registering && <span className="spinner" />}
                <span>⚡ 1-Click Register /ranking Command</span>
              </button>

              {discordAuthUrl && (
                <a
                  href={discordAuthUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary"
                  style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <span>🔗 Add Bot to Server (OAuth2) ↗</span>
                </a>
              )}
            </div>

            {registerResult && (
              <div className={`feedback-box ${registerResult.success ? "success" : "error"}`}>
                {registerResult.text}
              </div>
            )}
          </div>

          {/* Card 2: Cloudflare & GitHub Credentials */}
          <div className="ranking-card">
            <div className="ranking-card-header">
              <span className="step-num-pill">Step 2</span>
              <h3>2. Cloudflare &amp; GitHub Credentials</h3>
            </div>
            <p className="ranking-card-desc">
              The worker reads <code>stats.json</code> from your GitHub repo to serve rankings.
            </p>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">
                  GitHub Repository (owner/repo) <span className="req">*</span>
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="username/steam-family-notifier"
                  value={githubRepo}
                  onChange={(e) => onChangeGithubRepo(e.target.value)}
                />
                <span className="input-hint">Auto-detected from git config or wrangler.toml</span>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Cloudflare Account ID <span className="opt">(Optional for deployment)</span>
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Found in Cloudflare dashboard URL/sidebar"
                  value={cloudflareAccountId}
                  onChange={(e) => onChangeCloudflareAccountId(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Cloudflare API Token <span className="opt">(Optional for GitHub Actions deploy)</span>
                </label>
                <input
                  type="password"
                  className="input"
                  placeholder="Bearer token with Worker edit permissions"
                  value={cloudflareApiToken}
                  onChange={(e) => onChangeCloudflareApiToken(e.target.value)}
                />
                <span className="input-hint">
                  <a
                    href="https://dash.cloudflare.com/profile/api-tokens"
                    target="_blank"
                    rel="noreferrer"
                    className="external-link"
                  >
                    Create Cloudflare API Token ↗
                  </a>
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">
                  GitHub Fine-Grained Token (RANKING_BOT_GH_TOKEN)
                </label>
                <input
                  type="password"
                  className="input"
                  placeholder="PAT with Contents: Read-Only"
                  value={rankingBotGhToken}
                  onChange={(e) => onChangeRankingBotGhToken(e.target.value)}
                />
                <span className="input-hint">
                  <a
                    href="https://github.com/settings/tokens?type=beta"
                    target="_blank"
                    rel="noreferrer"
                    className="external-link"
                  >
                    Generate Fine-Grained Token ↗
                  </a>
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Worker Deployment & Interactions Verification */}
          <div className="ranking-card">
            <div className="ranking-card-header">
              <span className="step-num-pill">Step 3</span>
              <h3>3. Deploy Worker &amp; Verify Interactions Endpoint</h3>
            </div>

            <div style={{ background: "rgba(255,255,255,0.02)", padding: "14px", borderRadius: "var(--radius-md)", marginBottom: "16px" }}>
              <h4 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: "6px" }}>🚀 How to Deploy:</h4>
              <ul style={{ fontSize: "0.85rem", color: "var(--text-secondary)", paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "4px" }}>
                <li><b>GitHub Actions (Automatic):</b> When you add the secrets in Step 5, the <code>deploy-ranking-bot.yml</code> workflow deploys the worker automatically!</li>
                <li><b>Wrangler CLI (Local):</b> Run <code>cd discord-bot &amp; npx wrangler deploy</code> in your terminal.</li>
              </ul>
            </div>

            <div className="form-group">
              <label className="form-label">
                Cloudflare Worker URL <span className="req">*</span>
              </label>
              <div style={{ display: "flex", gap: "10px" }}>
                <input
                  type="text"
                  className="input"
                  placeholder="https://steam-family-ranking-bot.subdomain.workers.dev"
                  value={workerUrl}
                  onChange={(e) => onChangeWorkerUrl(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleTestWorker}
                  disabled={testingWorker}
                >
                  {testingWorker && <span className="spinner" />}
                  <span>🧪 Test Worker Endpoint</span>
                </button>
              </div>
              <span className="input-hint">
                Printed when <code>wrangler deploy</code> runs or found in Cloudflare Workers Dashboard.
              </span>
            </div>

            {testResult && (
              <div className={`feedback-box ${testResult.success ? "success" : "error"}`}>
                {testResult.text}
              </div>
            )}

            <div className="notice-box info" style={{ marginTop: "16px" }}>
              <b>📌 Final Step in Discord Portal:</b> Copy your Worker URL above and paste it into Discord Developer Portal &gt; General Information &gt; <b>Interactions Endpoint URL</b> &gt; Save Changes. Discord will verify the endpoint immediately.
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
