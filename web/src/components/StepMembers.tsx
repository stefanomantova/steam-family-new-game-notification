"use client";

import React, { useState } from "react";
import type { SteamPlayerSummary } from "@/lib/steam";

export interface MemberRecord {
  steamId: string;
  name: string;
  avatarUrl?: string;
  isProfilePublic?: boolean;
  gameCount?: number;
}

interface StepMembersProps {
  steamApiKey: string;
  members: Record<string, MemberRecord>;
  onAddMember: (member: MemberRecord) => void;
  onRemoveMember: (steamId: string) => void;
  onUpdateMemberName: (steamId: string, newName: string) => void;
  onToast: (msg: string) => void;
}

export function StepMembers({
  steamApiKey,
  members,
  onAddMember,
  onRemoveMember,
  onUpdateMemberName,
  onToast,
}: StepMembersProps) {
  const [inputVal, setInputVal] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const memberList = Object.values(members);

  const handleAdd = async () => {
    const trimmed = inputVal.trim();
    if (!trimmed) {
      setFeedback({ type: "error", text: "Please enter a Steam profile link, vanity URL, or SteamID64." });
      return;
    }

    if (!steamApiKey.trim()) {
      setFeedback({
        type: "error",
        text: "Steam API key is missing. Please go back to Step 1 and provide an API key.",
      });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/steam/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steamApiKey, input: trimmed }),
      });
      const data = await res.json();

      if (!data.success || !data.player) {
        setFeedback({ type: "error", text: data.error || "Failed to find Steam member." });
        return;
      }

      const player: SteamPlayerSummary = data.player;

      if (members[player.steamId]) {
        setFeedback({ type: "warning", text: `Member "${player.personaName}" is already added!` });
        return;
      }

      onAddMember({
        steamId: player.steamId,
        name: player.personaName,
        avatarUrl: player.avatarUrl,
        isProfilePublic: player.isProfilePublic,
        gameCount: player.gameCount,
      });

      setInputVal("");
      onToast(`Added ${player.personaName} to family tracker!`);

      if (!player.isProfilePublic) {
        setFeedback({
          type: "warning",
          text: `Added ${player.personaName}, but their Steam profile/game library is private. Make sure they set "Game details: Public" in Steam Privacy settings!`,
        });
      }
    } catch {
      setFeedback({ type: "error", text: "Failed to connect to Steam resolver." });
    } finally {
      setLoading(false);
    }
  };

  const startEditName = (m: MemberRecord) => {
    setEditingId(m.steamId);
    setEditName(m.name);
  };

  const saveEditName = (steamId: string) => {
    if (editName.trim()) {
      onUpdateMemberName(steamId, editName.trim());
      onToast(`Updated member name to "${editName.trim()}"`);
    }
    setEditingId(null);
  };

  return (
    <section>
      <div className="step-title-area">
        <h2>Family Members</h2>
        <p>Add everyone in your Steam Family. You can paste Steam profile links, custom vanity URLs, or 17-digit SteamIDs.</p>
      </div>

      <div className="form-group">
        <label className="field-label">Add Family Member</label>
        <p className="field-desc">
          Paste any of: <code>https://steamcommunity.com/id/username</code>, <code>profiles/76561198...</code>, or custom vanity name.
        </p>
        <div className="input-row">
          <div className="input-wrapper">
            <input
              type="text"
              placeholder="e.g. https://steamcommunity.com/id/nickname or 76561198012345678"
              value={inputVal}
              onChange={(e) => {
                setInputVal(e.target.value);
                setFeedback(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
            />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleAdd}
            disabled={loading || !inputVal.trim()}
          >
            {loading && <span className="spinner" />}
            <span>+ Add Member</span>
          </button>
        </div>

        {feedback && (
          <div className={`feedback-box ${feedback.type}`}>
            {feedback.text}
          </div>
        )}
      </div>

      {/* Member Cards Grid */}
      <div style={{ marginTop: "32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>
            Configured Members ({memberList.length})
          </span>
          <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
            Tip: Steam library must be Public to track new games.
          </span>
        </div>

        {memberList.length === 0 ? (
          <div style={{
            textAlign: "center",
            padding: "40px 20px",
            border: "1px dashed var(--border-color)",
            borderRadius: "var(--radius-md)",
            background: "rgba(255,255,255,0.01)"
          }}>
            <div style={{ fontSize: "2.4rem", marginBottom: "10px" }}>🎮</div>
            <h3 style={{ fontSize: "1.1rem", marginBottom: "6px" }}>No members added yet</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
              Add family members using the input above to track their library changes.
            </p>
          </div>
        ) : (
          <div className="member-list">
            {memberList.map((m) => (
              <div key={m.steamId} className="member-card">
                <img
                  src={m.avatarUrl || "https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg"}
                  alt={m.name}
                  className="member-avatar"
                />
                <div className="member-meta">
                  {editingId === m.steamId ? (
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        style={{ padding: "4px 8px", fontSize: "0.85rem" }}
                        autoFocus
                      />
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => saveEditName(m.steamId)}
                        title="Save name"
                      >
                        ✓
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span className="member-name" title={m.name}>{m.name}</span>
                      <button
                        type="button"
                        onClick={() => startEditName(m)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "0.75rem" }}
                        title="Edit display name"
                      >
                        ✏️
                      </button>
                    </div>
                  )}
                  <div className="member-id">{m.steamId}</div>
                  {m.isProfilePublic !== false ? (
                    <span className="member-privacy-badge public">
                      🟢 Public {m.gameCount !== undefined ? `(${m.gameCount} games)` : ""}
                    </span>
                  ) : (
                    <span
                      className="member-privacy-badge private"
                      title="Steam Game details must be set to Public for the bot to see games"
                    >
                      ⚠️ Game Details Private
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="btn-remove-member"
                  onClick={() => onRemoveMember(m.steamId)}
                  title="Remove member"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
