# 🎮 Steam Family Notifier

Get a Discord message every time someone in your Steam Family Sharing group adds a new game — automatically, in the cloud, no coding needed.

🇧🇷 Leia isso em português: [README.pt-BR.md](README.pt-BR.md)

---

## Part 1 — Setup Guide

### What you'll need
- A [GitHub account](https://github.com) (free)
- A Steam account with an API key (free, takes 1 minute)
- A Discord channel where you want the alerts

---

### Step 1 — Get your own copy of this project

Click **"Use this template"** at the top of this page, then **"Create a new repository"**. Give it any name you like. This creates your own private copy where your settings live.

---

### Step 2 — Get a Steam API Key

Go to https://steamcommunity.com/dev/apikey. Log in with your Steam account and register any domain name (it doesn't matter what you put there). Copy the key shown on the page.

---

### Step 3 — Create a Discord Webhook

In Discord, open the channel where you want the notifications. Click **Edit Channel → Integrations → Webhooks → New Webhook**. Give it a name (e.g. "Game Notifier") and copy the URL.

---

### Step 4 — Use the Setup Wizard (Recommended)

The easiest way to configure everything is through the browser-based wizard:

```bash
npm install && npm run setup:ui
```

Then open **http://localhost:3000** in your browser. The wizard walks you through:

1. **Credentials** — Paste your Steam API key and Discord Webhook URL. Test the connection live.
2. **Family Members** — Add each group member by pasting their Steam profile URL. The wizard fetches their avatar and name automatically.
3. **Preferences** — Pick your notification language (English or Portuguese) and Steam store region for game prices.
4. **Ranking Bot** *(Optional)* — Enable the `/ranking` Discord command powered by a free Cloudflare Worker.
5. **Deploy & Finish** — Save everything and copy the exact GitHub secrets needed, all pre-filled and ready to paste.

> **No Node.js installed?** You can also set everything up manually — see the manual setup below.

### No-install Windows option

Windows users can download the portable package from the repository's **Actions → Build Windows Portable Package → Artifacts**. It includes its own Node runtime, so Node.js and NPM do not need to be installed separately.

Run `run-setup.cmd` to open the local setup wizard, then use its **Dry Run** option to validate the configuration and preview generated files without writing them. Use `run-check.cmd` for a manual check after configuration.

The portable package is a local helper; it does not replace the private GitHub repository used for 15-minute scheduling and state persistence. A future release can wrap the same entry point as a single-file executable, but the portable package is intentionally the first low-risk distribution format.

---

### Step 4 (Alternative) — Manual Setup

If you'd prefer not to run the wizard, you can add the secrets directly in GitHub:

Go to your repository → **Settings → Secrets and variables → Actions → New repository secret** and add:

| Secret | What to put |
|---|---|
| `STEAM_API_KEY` | The key from Step 2 |
| `DISCORD_WEBHOOK_URL` | The webhook URL from Step 3 |
| `STEAM_MEMBERS` | `{"SteamID64":"Display Name", ...}` — look up SteamID64s at [steamid.io](https://steamid.io) |
| `MESSAGE_LANGUAGE` | `EN` or `PT` *(optional, defaults to EN)* |
| `STORE_COUNTRY_CODE` | e.g. `us`, `br` *(optional, defaults to br)* |

Then go to **Settings → Actions → General → Workflow permissions** and enable **Read and write permissions**.

---

### Step 5 — Run it for the first time

Go to **Actions → Steam Family Notifier → Run workflow**.

> The first run takes a snapshot of everyone's libraries. No messages are sent. From the next run on, any newly added game will trigger a notification.

The bot checks for new games every 15 minutes automatically.

---

### (Optional) Enable the `/ranking` Discord Command

Want members to be able to type `/ranking` in Discord and see who spent the most and bought the most games? This is a free optional add-on.

The setup wizard (Step 4 above) has a dedicated **Ranking Bot** step that guides you through the whole process — including registering the Discord slash command with one click and verifying your Cloudflare Worker is running. You'll need:

- A free Discord Application (created at [discord.com/developers](https://discord.com/developers))
- A free [Cloudflare account](https://cloudflare.com)

Everything else is handled through the wizard or GitHub Actions automatically.

---

## Part 2 — Technical Reference

### How it works

The script calls Steam's `GetOwnedGames` API for each member on every run and compares it against the last snapshot (`state.json`, committed to the repo). New app IDs are the "new games."

**Shared vs. purchased heuristic**: Steam doesn't expose whether a game was purchased or received via Family Sharing. The script infers intent:
- If another group member already had the game before → *shared from them*
- If only one member gained access and nobody else had it → *purchased*
- If multiple members gained access simultaneously → *generic group message* (ambiguous)

**Free game detection**: The Steam Store's `is_free` flag is the only signal. A missing price is **not** treated as free — that distinction matters for the ranking stats.

---

### Price Lookup (for ranking stats)

When a purchase is detected, the game's price is resolved in this order:

1. Direct app `price_overview` from the Steam Store API
2. Cheapest bundle/package that includes the app (for games with no individual SKU)
3. Steam Store name-search fallback (covers library-only wrapper appids)
4. SteamDB displayed price (read-only fallback)
5. SteamDB bundle candidates
6. If nothing works → purchase is announced but **not counted in ranking stats**, and the Discord message includes the exact command to fix it manually

Region is controlled by `STORE_COUNTRY_CODE` (defaults to `br`).

---

### Fixing a missing stat entry

When a price can't be resolved automatically, run the backfill:

**Via GitHub Actions** (no install needed): Actions → *Backfill Purchase Stats* → Run workflow, fill in `steamid` and `appid`.

**Locally:**
```bash
npm run build
npm run backfill-purchase -- --steamid 76561198000000001 --appid 123456
# --notify to post a Discord correction message
# --price 29.99 --currency USD to override the price manually
```

---

### Architecture Overview

| Layer | Technology |
|---|---|
| Scheduled notifier | GitHub Actions (cron, every 15 min) |
| State persistence | `state.json` + `stats.json` committed to the repo |
| Setup wizard | Next.js 14 (runs locally only, not deployed) |
| `/ranking` command | Cloudflare Worker (serverless, free tier) |
| Steam data | Steam Web API (`GetOwnedGames`, `GetAppDetails`) |
| Prices | Steam Store API → SteamDB fallback |

The domain logic lives in `src/application/`. Adapters for Steam, Discord, and the JSON file repositories are in `src/adapters/`. The GitHub Actions workflow calls the compiled CLI in `dist/cli/`.

---

### Project Structure

```
check_new_games.py          → legacy Python notifier (still works)
src/                        → TypeScript rewrite (application, adapters, CLIs)
web/                        → Next.js setup wizard (local only)
discord-bot/                → optional Cloudflare Worker for /ranking
state.json                  → committed library snapshot (the "database")
stats.json                  → committed purchase totals for /ranking
.github/workflows/
  check-new-games.yml       → main scheduled workflow
  deploy-ranking-bot.yml    → deploys the Cloudflare Worker on push
  backfill-purchase.yml     → manual stat repair workflow
```

---

### Limitations

- Requires each member's Steam profile game library to be **public**.
- Polling-based: up to one interval (15 min) of delay before a game is detected.
- Shared-by attribution is a heuristic — can misattribute in edge cases where two members gain the same game in the same run.
- Prices reflect the Steam Store at detection time, not what the buyer actually paid (sales, regional pricing changes, etc. aren't tracked).

---

## License

MIT — see [LICENSE](LICENSE).

