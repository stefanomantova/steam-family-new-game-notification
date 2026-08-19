# Steam Family Notifier — `/ranking` Discord command

An optional add-on: a real-time `/ranking` slash command that shows who
spent the most and who bought the most games in the group, based on the
`stats.json` tracked by the main script.

Runs as a small **Cloudflare Worker** — free forever tier, no server to
keep running. It has no state of its own: every time someone runs
`/ranking`, it fetches `stats.json` straight from your GitHub repository
and replies with the current numbers.

🇧🇷 Leia isso em português: [README.pt-BR.md](README.pt-BR.md)

## How it works

Discord slash commands can work two ways: a bot that stays connected
24/7 (gateway), or an **HTTP Interactions Endpoint**, where Discord sends
a request to your server only when the command is actually used. This
project uses the second approach — much lighter, and a perfect fit for a
serverless free tier.

## Setup

### 1. Create a Discord Application

1. Go to https://discord.com/developers/applications → **New Application**.
2. In **General Information**, copy the **Application ID** and the
   **Public Key** — you'll need both.
3. Go to the **Bot** tab, click **Add Bot** (or **Reset Token**), and
   copy the **Bot Token**. This token is only used once, to register the
   command — the Worker itself never needs it.

### 2. Deploy the Worker

Requires [Node.js](https://nodejs.org) and the Cloudflare account (free)
you'll deploy to.

```bash
cd discord-bot
npm install

# Log in to your Cloudflare account (opens a browser window)
npx wrangler login

# Set the two secrets (you'll be prompted to paste each value)
npx wrangler secret put DISCORD_PUBLIC_KEY
npx wrangler secret put GITHUB_TOKEN

npm run deploy
```

`GITHUB_TOKEN` should be a GitHub **fine-grained personal access token**
(Settings → Developer settings → Personal access tokens → Fine-grained
tokens) scoped to just this one repository, with **Contents: Read-only**
permission. That's enough to fetch `stats.json`, even from a private repo.

Before deploying, edit `wrangler.toml` and set `GITHUB_REPO` to your
actual `owner/repo` (and `GITHUB_BRANCH` / `GITHUB_STATS_PATH` if you
changed the defaults).

`wrangler deploy` prints your Worker's URL
(`https://steam-family-ranking-bot.<your-subdomain>.workers.dev`) — copy it.

### 3. Point Discord at your Worker

Back in the Discord Developer Portal, on your application's **General
Information** page, paste your Worker's URL into **Interactions Endpoint
URL** and save. Discord will send a test request immediately — if the
Worker is deployed correctly, it verifies instantly.

### 4. Register the `/ranking` command

Run once from the `discord-bot/` folder:

```bash
DISCORD_APP_ID=<your application id> \
DISCORD_BOT_TOKEN=<your bot token> \
GUILD_ID=<your Discord server id, optional but recommended for instant testing> \
./register-command.sh
```

Without `GUILD_ID` the command registers globally, which can take up to
an hour to show up. With `GUILD_ID` it appears instantly, but only in
that one server — good for testing before going global.

### 5. Add the command to your server

Open this URL in your browser (replace `<APP_ID>`), pick your server,
and authorize it:

```
https://discord.com/oauth2/authorize?client_id=<APP_ID>&scope=applications.commands
```

This only grants the `applications.commands` scope — no bot user joins
the server, no extra permissions are requested.

### 6. Try it

Type `/ranking` in your server. You should get a message with the top
spenders and the most-games-bought ranking, pulled live from `stats.json`.

## Notes

- If `stats.json` has no data yet (nobody bought anything since you set
  up stats tracking), the command replies saying so.
- Prices come from the Steam Store's **current** listing at the moment a
  purchase was detected — not necessarily what the buyer actually paid
  (sales, currency changes, etc. aren't accounted for).
- Only unambiguous purchases are counted — see the main
  [README](../README.md#how-it-works-under-the-hood) for details on what
  counts as "shared" vs "purchased".
