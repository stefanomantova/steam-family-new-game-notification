"use client";

import React, { useState } from "react";
import type { MemberRecord } from "./StepMembers";

interface StepDeployProps {
  steamApiKey: string;
  discordWebhookUrl: string;
  members: Record<string, MemberRecord>;
  messageLanguage: "EN" | "PT";
  storeCountryCode: string;
  enableRankingBot?: boolean;
  discordAppId?: string;
  discordPublicKey?: string;
  cloudflareAccountId?: string;
  cloudflareApiToken?: string;
  rankingBotGhToken?: string;
  workerUrl?: string;
  githubRepo?: string;
  onToast: (msg: string) => void;
  managementMode?: boolean;
  language?: "EN" | "PT";
}

export function StepDeploy({
  steamApiKey,
  discordWebhookUrl,
  members,
  messageLanguage,
  storeCountryCode,
  enableRankingBot = false,
  discordAppId = "",
  discordPublicKey = "",
  cloudflareAccountId = "",
  cloudflareApiToken = "",
  rankingBotGhToken = "",
  workerUrl = "",
  githubRepo = "",
  onToast,
  managementMode = false,
  language = "EN",
}: StepDeployProps) {
  const pt = language === "PT";
  const [activeTab, setActiveTab] = useState<"local" | "github">("local");
  const [isDryRun, setIsDryRun] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null);
  const [previewEnv, setPreviewEnv] = useState<string | null>(null);
  const [previewMembers, setPreviewMembers] = useState<string | null>(null);

  const [runningBaseline, setRunningBaseline] = useState(false);
  const [baselineLogs, setBaselineLogs] = useState<string[]>([]);

  const memberMap: Record<string, string> = {};
  for (const [id, m] of Object.entries(members)) {
    memberMap[id] = m.name;
  }

  const handleSave = async () => {
    setSaving(true);
    setSaveFeedback(null);
    setPreviewEnv(null);
    setPreviewMembers(null);

    try {
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          steamApiKey,
          discordWebhookUrl,
          members: memberMap,
          messageLanguage,
          storeCountryCode,
          enableRankingBot,
          discordAppId,
          discordPublicKey,
          cloudflareAccountId,
          cloudflareApiToken,
          rankingBotGhToken,
          workerUrl,
          githubRepo,
          dryRun: isDryRun,
          management: managementMode,
          appUrl: window.location.origin,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.dryRun) {
          setSaveFeedback({
            type: "warning",
            text: "🧪 Dry Run Complete: Configuration is 100% valid! No files were modified on disk.",
          });
          setPreviewEnv(data.envContent);
          setPreviewMembers(data.membersContent);
          onToast("Dry Run test passed!");
        } else {
          setSaved(true);
          setSaveFeedback({ type: "success", text: "✓ Configuration saved to .env, members.json, and wrangler.toml!" });
          onToast("Saved local configuration!");
        }
      } else {
        setSaveFeedback({
          type: "error",
          text: `❌ ${data.errors ? data.errors.join("; ") : data.error || "Failed to save configuration"}`,
        });
      }
    } catch {
      setSaveFeedback({ type: "error", text: "Network error while saving." });
    } finally {
      setSaving(false);
    }
  };

  const handleRunBaseline = async () => {
    setRunningBaseline(true);
    setBaselineLogs([isDryRun ? "Starting baseline test (DRY RUN)..." : "Starting baseline snapshot..."]);

    try {
      const res = await fetch("/api/baseline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          steamApiKey,
          members: memberMap,
          storeCountryCode,
          messageLanguage,
          dryRun: isDryRun,
        }),
      });
      const data = await res.json();
      if (data.logs) {
        setBaselineLogs(data.logs);
      }
      if (data.success) {
        onToast(isDryRun ? "Dry Run baseline test completed!" : `Baseline initialized with ${data.totalGames} games!`);
      }
    } catch (err) {
      setBaselineLogs((prev) => [...prev, `❌ Error: ${err instanceof Error ? err.message : "Failed to run baseline"}`]);
    } finally {
      setRunningBaseline(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    onToast(`Copied ${label} to clipboard!`);
  };

  const ghCliLines = [
    `gh secret set STEAM_API_KEY -b "${steamApiKey}"`,
    `gh secret set DISCORD_WEBHOOK_URL -b "${discordWebhookUrl}"`,
    `gh secret set STEAM_MEMBERS -b '${JSON.stringify(memberMap)}'`,
    `gh secret set MESSAGE_LANGUAGE -b "${messageLanguage}"`,
    `gh secret set STORE_COUNTRY_CODE -b "${storeCountryCode}"`,
  ];

  if (enableRankingBot) {
    if (cloudflareApiToken) ghCliLines.push(`gh secret set CLOUDFLARE_API_TOKEN -b "${cloudflareApiToken}"`);
    if (cloudflareAccountId) ghCliLines.push(`gh secret set CLOUDFLARE_ACCOUNT_ID -b "${cloudflareAccountId}"`);
    if (discordPublicKey) ghCliLines.push(`gh secret set DISCORD_PUBLIC_KEY -b "${discordPublicKey}"`);
    if (rankingBotGhToken) ghCliLines.push(`gh secret set RANKING_BOT_GH_TOKEN -b "${rankingBotGhToken}"`);
  }

  const ghCliScript = ghCliLines.join("\n");

  return (
    <section>
      <div className="step-title-area">
        <h2>{pt ? "Salvar e implantar" : "Save & Deploy"}</h2>
        <p>{pt ? "Salve sua configuração neste projeto e use o GitHub Actions ou execute localmente." : "Save your configuration to this project and deploy to GitHub Actions or run locally."}</p>
      </div>

      {/* Summary Stat Bar */}
      <div className="summary-bar">
        <div className="summary-stat">
          <span className="summary-stat-label">Members</span>
          <span className="summary-stat-val">{Object.keys(members).length}</span>
        </div>
        <div className="summary-stat">
          <span className="summary-stat-label">Language</span>
          <span className="summary-stat-val">{messageLanguage}</span>
        </div>
        <div className="summary-stat">
          <span className="summary-stat-label">Store Country</span>
          <span className="summary-stat-val">{storeCountryCode.toUpperCase()}</span>
        </div>
      </div>

      {/* Dry Run Toggle Switch Banner */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: isDryRun ? "rgba(245, 158, 11, 0.12)" : "rgba(255, 255, 255, 0.03)",
        border: `1px solid ${isDryRun ? "rgba(245, 158, 11, 0.4)" : "var(--border-color)"}`,
        borderRadius: "var(--radius-md)",
        padding: "14px 18px",
        marginBottom: "24px",
        transition: "all 0.25s ease",
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.95rem", color: isDryRun ? "#fbbf24" : "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>🧪 Dry Run Mode</span>
            {isDryRun && <span style={{ fontSize: "0.72rem", background: "rgba(245, 158, 11, 0.25)", padding: "2px 8px", borderRadius: "10px", fontWeight: 700 }}>ACTIVE</span>}
          </div>
          <div style={{ fontSize: "0.83rem", color: "var(--text-muted)", marginTop: "2px" }}>
            Test validation and preview output without writing any files (.env, members.json, state.json) to disk.
          </div>
        </div>
        <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={isDryRun}
            onChange={(e) => {
              setIsDryRun(e.target.checked);
              setSaveFeedback(null);
              setPreviewEnv(null);
              setPreviewMembers(null);
            }}
            style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "#f59e0b" }}
          />
          <span style={{ fontSize: "0.88rem", fontWeight: 600, color: isDryRun ? "#fbbf24" : "var(--text-secondary)" }}>
            {isDryRun ? "ON" : "OFF"}
          </span>
        </label>
      </div>

      {/* Save Box */}
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid var(--border-color)",
        borderRadius: "var(--radius-md)",
        padding: "20px",
        marginBottom: "32px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px" }}>
          <div>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "4px" }}>
              💾 1. {isDryRun ? "Test Save Configuration (Dry Run)" : "Save Local Configuration"}
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
              {isDryRun
                ? "Validates setup and previews generated content without modifying files on disk."
                : "Writes your settings to .env and members.json in the project root."}
            </p>
          </div>
          <button
            type="button"
            className={`btn ${isDryRun ? "btn-secondary" : "btn-success"}`}
            onClick={handleSave}
            disabled={saving}
          >
            {saving && <span className="spinner" />}
            <span>
              {isDryRun
                ? "🧪 Test Save (Dry Run)"
                : saved
                ? "✓ Saved (Click to Re-save)"
                : "Save Configuration"}
            </span>
          </button>
        </div>

        {saveFeedback && (
          <div className={`feedback-box ${saveFeedback.type}`}>
            {saveFeedback.text}
          </div>
        )}

        {/* Dry Run File Previews */}
        {previewEnv && previewMembers && (
          <div style={{ marginTop: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#38bdf8", marginBottom: "4px" }}>
                Preview: .env (Not written to disk)
              </div>
              <pre style={{
                background: "#06090e",
                padding: "10px",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.78rem",
                color: "#cbd5e1",
                overflowX: "auto",
                border: "1px solid var(--border-color)"
              }}>
                {previewEnv}
              </pre>
            </div>
            <div>
              <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#38bdf8", marginBottom: "4px" }}>
                Preview: members.json (Not written to disk)
              </div>
              <pre style={{
                background: "#06090e",
                padding: "10px",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.78rem",
                color: "#cbd5e1",
                overflowX: "auto",
                border: "1px solid var(--border-color)"
              }}>
                {previewMembers}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Tabs for Local vs GitHub */}
      <div>
        <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "12px" }}>
          🚀 2. Choose How to Run
        </h3>
        <div style={{ display: "flex", gap: "10px", marginBottom: "18px" }}>
          <button
            type="button"
            className={`btn ${activeTab === "local" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveTab("local")}
          >
            Option A: Run Locally / Baseline Check
          </button>
          <button
            type="button"
            className={`btn ${activeTab === "github" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveTab("github")}
          >
            Option B: Deploy to GitHub Actions
          </button>
        </div>

        {/* Tab A: Local */}
        {activeTab === "local" && (
          <div style={{
            background: "rgba(23, 33, 46, 0.6)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius-md)",
            padding: "20px",
          }}>
            <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "14px" }}>
              Before the automated checker runs periodically, initialize the <b>baseline check</b>. This snapshots everyone&apos;s existing libraries into <code>state.json</code> so existing games won&apos;t spam notifications.
            </p>

            <button
              type="button"
              className={`btn ${isDryRun ? "btn-secondary" : "btn-primary"}`}
              onClick={handleRunBaseline}
              disabled={runningBaseline}
            >
              {runningBaseline && <span className="spinner" />}
              <span>{isDryRun ? "🧪 Run Baseline Test (Dry Run)" : "⚡ Run Baseline Check Now"}</span>
            </button>

            {baselineLogs.length > 0 && (
              <div className="terminal-card">
                <div className="terminal-header">
                  <div className="terminal-dot red" />
                  <div className="terminal-dot yellow" />
                  <div className="terminal-dot green" />
                  <span className="terminal-title">
                    {isDryRun ? "Baseline Execution Log (DRY RUN — State not saved)" : "Baseline Execution Log"}
                  </span>
                </div>
                <div className="terminal-content">
                  {baselineLogs.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab B: GitHub Actions */}
        {activeTab === "github" && (
          <div style={{
            background: "rgba(23, 33, 46, 0.6)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius-md)",
            padding: "20px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                Paste these into your GitHub Repository under <b>Settings &gt; Secrets and variables &gt; Actions</b>:
              </p>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => copyToClipboard(ghCliScript, "GitHub CLI script")}
                style={{ fontSize: "0.8rem", padding: "8px 14px" }}
              >
                📋 Copy GitHub CLI Script
              </button>
            </div>

            <div className="secrets-list">
              <div className="secret-item">
                <span className="secret-key">STEAM_API_KEY</span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: "4px 10px", fontSize: "0.78rem" }}
                  onClick={() => copyToClipboard(steamApiKey, "STEAM_API_KEY")}
                >
                  Copy
                </button>
              </div>

              <div className="secret-item">
                <span className="secret-key">DISCORD_WEBHOOK_URL</span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: "4px 10px", fontSize: "0.78rem" }}
                  onClick={() => copyToClipboard(discordWebhookUrl, "DISCORD_WEBHOOK_URL")}
                >
                  Copy
                </button>
              </div>

              <div className="secret-item">
                <span className="secret-key">STEAM_MEMBERS</span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: "4px 10px", fontSize: "0.78rem" }}
                  onClick={() => copyToClipboard(JSON.stringify(memberMap), "STEAM_MEMBERS")}
                >
                  Copy
                </button>
              </div>

              <div className="secret-item">
                <span className="secret-key">MESSAGE_LANGUAGE</span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: "4px 10px", fontSize: "0.78rem" }}
                  onClick={() => copyToClipboard(messageLanguage, "MESSAGE_LANGUAGE")}
                >
                  Copy
                </button>
              </div>

              <div className="secret-item">
                <span className="secret-key">STORE_COUNTRY_CODE</span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: "4px 10px", fontSize: "0.78rem" }}
                  onClick={() => copyToClipboard(storeCountryCode, "STORE_COUNTRY_CODE")}
                >
                  Copy
                </button>
              </div>

              {enableRankingBot && (
                <>
                  <div className="secret-item">
                    <span className="secret-key" style={{ color: "#fbbf24" }}>CLOUDFLARE_API_TOKEN</span>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: "4px 10px", fontSize: "0.78rem" }}
                      onClick={() => copyToClipboard(cloudflareApiToken, "CLOUDFLARE_API_TOKEN")}
                    >
                      Copy
                    </button>
                  </div>

                  <div className="secret-item">
                    <span className="secret-key" style={{ color: "#fbbf24" }}>CLOUDFLARE_ACCOUNT_ID</span>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: "4px 10px", fontSize: "0.78rem" }}
                      onClick={() => copyToClipboard(cloudflareAccountId, "CLOUDFLARE_ACCOUNT_ID")}
                    >
                      Copy
                    </button>
                  </div>

                  <div className="secret-item">
                    <span className="secret-key" style={{ color: "#fbbf24" }}>DISCORD_PUBLIC_KEY</span>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: "4px 10px", fontSize: "0.78rem" }}
                      onClick={() => copyToClipboard(discordPublicKey, "DISCORD_PUBLIC_KEY")}
                    >
                      Copy
                    </button>
                  </div>

                  <div className="secret-item">
                    <span className="secret-key" style={{ color: "#fbbf24" }}>RANKING_BOT_GH_TOKEN</span>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: "4px 10px", fontSize: "0.78rem" }}
                      onClick={() => copyToClipboard(rankingBotGhToken, "RANKING_BOT_GH_TOKEN")}
                    >
                      Copy
                    </button>
                  </div>
                </>
              )}
            </div>

            <div style={{
              marginTop: "20px",
              padding: "12px 16px",
              background: "rgba(245, 158, 11, 0.1)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.85rem",
              color: "#fbbf24",
            }}>
              <b>⚠️ Important GitHub Setting:</b> Ensure your repository has <b>&quot;Read and write permissions&quot;</b> enabled under <b>Settings &gt; Actions &gt; General &gt; Workflow permissions</b> so the GitHub Actions bot can push updated <code>state.json</code> and <code>stats.json</code> files.
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
