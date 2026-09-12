"use client";

import React, { useState } from "react";

interface StepCredentialsProps {
  steamApiKey: string;
  onChangeSteamApiKey: (val: string) => void;
  discordWebhookUrl: string;
  onChangeDiscordWebhookUrl: (val: string) => void;
  onToast: (msg: string) => void;
}

export function StepCredentials({
  steamApiKey,
  onChangeSteamApiKey,
  discordWebhookUrl,
  onChangeDiscordWebhookUrl,
  onToast,
}: StepCredentialsProps) {
  const [showKey, setShowKey] = useState(false);
  const [verifyingSteam, setVerifyingSteam] = useState(false);
  const [testingDiscord, setTestingDiscord] = useState(false);

  const [steamFeedback, setSteamFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [discordFeedback, setDiscordFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleVerifySteam = async () => {
    if (!steamApiKey.trim()) {
      setSteamFeedback({ type: "error", text: "Please enter your Steam API key first." });
      return;
    }
    setVerifyingSteam(true);
    setSteamFeedback(null);
    try {
      const res = await fetch("/api/steam/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steamApiKey }),
      });
      const data = await res.json();
      if (data.valid) {
        setSteamFeedback({ type: "success", text: "✓ Steam API key is valid and connected!" });
        onToast("Steam API Key verified!");
      } else {
        setSteamFeedback({ type: "error", text: `❌ ${data.error || "Invalid API key"}` });
      }
    } catch (err) {
      setSteamFeedback({ type: "error", text: "Failed to verify key. Check your internet connection." });
    } finally {
      setVerifyingSteam(false);
    }
  };

  const handleTestDiscord = async () => {
    if (!discordWebhookUrl.trim()) {
      setDiscordFeedback({ type: "error", text: "Please enter your Discord webhook URL first." });
      return;
    }
    setTestingDiscord(true);
    setDiscordFeedback(null);
    try {
      const res = await fetch("/api/discord", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discordWebhookUrl }),
      });
      const data = await res.json();
      if (data.success) {
        setDiscordFeedback({ type: "success", text: "✓ Test ping sent! Check your Discord channel." });
        onToast("Discord test ping sent!");
      } else {
        setDiscordFeedback({ type: "error", text: `❌ ${data.error || "Failed to send message"}` });
      }
    } catch {
      setDiscordFeedback({ type: "error", text: "Failed to connect to Discord." });
    } finally {
      setTestingDiscord(false);
    }
  };

  return (
    <section>
      <div className="step-title-area">
        <h2>API Credentials & Webhooks</h2>
        <p>Connect your Steam account to inspect family libraries and configure your Discord channel for announcements.</p>
      </div>

      {/* Steam API Key */}
      <div className="form-group">
        <div className="label-row">
          <label htmlFor="steam-api-key" className="field-label">Steam Web API Key</label>
          <a
            href="https://steamcommunity.com/dev/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="link-helper"
          >
            Get API Key ↗
          </a>
        </div>
        <p className="field-desc">Used to query library games securely. We never store personal passwords or credentials.</p>
        <div className="input-row">
          <div className="input-wrapper">
            <input
              id="steam-api-key"
              type={showKey ? "text" : "password"}
              placeholder="Paste your 32-character Steam Web API Key"
              value={steamApiKey}
              onChange={(e) => {
                onChangeSteamApiKey(e.target.value);
                setSteamFeedback(null);
              }}
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={() => setShowKey(!showKey)}
            title={showKey ? "Hide key" : "Show key"}
          >
            {showKey ? "🙈" : "👁️"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleVerifySteam}
            disabled={verifyingSteam || !steamApiKey.trim()}
          >
            {verifyingSteam && <span className="spinner" />}
            <span>Test Key</span>
          </button>
        </div>
        {steamFeedback && (
          <div className={`feedback-box ${steamFeedback.type}`}>
            {steamFeedback.text}
          </div>
        )}
      </div>

      {/* Discord Webhook URL */}
      <div className="form-group" style={{ marginTop: "32px" }}>
        <div className="label-row">
          <label htmlFor="discord-webhook-url" className="field-label">Discord Webhook URL</label>
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Discord Channel Settings &gt; Integrations &gt; Webhooks</span>
        </div>
        <p className="field-desc">The channel where the bot will post notifications when family members get new games.</p>
        <div className="input-row">
          <div className="input-wrapper">
            <input
              id="discord-webhook-url"
              type="url"
              placeholder="https://discord.com/api/webhooks/..."
              value={discordWebhookUrl}
              onChange={(e) => {
                onChangeDiscordWebhookUrl(e.target.value);
                setDiscordFeedback(null);
              }}
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleTestDiscord}
            disabled={testingDiscord || !discordWebhookUrl.trim()}
          >
            {testingDiscord && <span className="spinner" />}
            <span>Send Test Ping</span>
          </button>
        </div>
        {discordFeedback && (
          <div className={`feedback-box ${discordFeedback.type}`}>
            {discordFeedback.text}
          </div>
        )}
      </div>
    </section>
  );
}
