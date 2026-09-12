# 🎮 Steam Family Notifier

Posts a message on Discord whenever someone in your Steam Family Sharing
group adds a new game.

Runs entirely in the cloud via **GitHub Actions** (no need to keep any
computer on) and can also run locally on **Windows, macOS, or Linux**,
using Node.js and TypeScript.

No personal data (SteamIDs, API key, webhook) lives in the code —
everything is configured through environment variables / secrets.

🇧🇷 Leia isso em português: [README.pt-BR.md](README.pt-BR.md)

---

## TL;DR — Quick Setup

1. **Fork this repo** (or "Use this template")
   → button at the top of this page

2. **Get a Steam API key**
   → https://steamcommunity.com/dev/apikey (any value works for "Domain Name")

3. **Get each member's SteamID64**
   → paste their profile URL into https://steamid.io/ (profiles must have a public game library)

4. **Create a Discord webhook**
   → Discord channel → Settings → Integrations → Webhooks → New Webhook → copy URL

5. **Add these repository secrets** (Settings → Secrets and variables → Actions → New repository secret)

   | Secret | Value |
   |---|---|
   | `STEAM_API_KEY` | key from step 2 |
   | `DISCORD_WEBHOOK_URL` | URL from step 4 |
   | `STEAM_MEMBERS` | JSON, e.g. `{"7656119...":"Alice","7656119...":"Bob"}` |
   | `MESSAGE_LANGUAGE` | *(optional)* `EN` or `PT` — defaults to `EN` |
   | `STORE_COUNTRY_CODE` | *(optional)* e.g. `br`, `us` — defaults to `br` |

6. **Enable workflow write permissions**
   → Settings → Actions → General → Workflow permissions → **Read and write permissions** → Save
   *(required so the workflow can commit `state.json`/`stats.json` back)*

7. **Test it**
   → Actions → *Steam Family Notifier* → Run workflow. First run only saves a baseline (no messages sent).

8. *(Optional)* **Set up the `/ranking` Discord command**
   → follow [`discord-bot/README.md`](discord-bot/README.md) — needs a Discord Application (Public Key + Bot Token), a free Cloudflare account (API Token + Account ID), and 4 more repo secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `DISCORD_PUBLIC_KEY`, `RANKING_BOT_GH_TOKEN`
   → also edit `discord-bot/wrangler.toml` → `GITHUB_REPO` to your `owner/repo`
   → enable the Worker's `workers.dev` URL, register the `/ranking` command via `register-command.sh`, and set it as the app's Interactions Endpoint URL

Done — the bot checks periodically (every 15 minutes by default) and posts to Discord when someone in the group gets a new game. Full details for every step below.

---

## Option A — Running on GitHub Actions (recommended, "plug and play")

1. Click **"Use this template"** at the top of the repository (or fork
   it) to create your own copy.

2. Generate a **Steam API key** (free, takes a minute):
   https://steamcommunity.com/dev/apikey

3. Get the **SteamID64** of each person in the group. If you have each
   person's profile link, a quick way is pasting it into https://steamid.io/.
   *(Only works for profiles with a public game library.)*

4. Create a **Discord webhook** in the channel where you want the alerts:
   Channel Settings → Integrations → Webhooks → New Webhook → copy the URL.

5. In your GitHub repository, go to
   **Settings → Secrets and variables → Actions → New repository secret**
   and create these secrets:

   | Name                   | Value |
   |-------------------------|-------|
   | `STEAM_API_KEY`         | the key from step 2 |
   | `DISCORD_WEBHOOK_URL`   | the URL from step 4 |
   | `STEAM_MEMBERS`         | a JSON like `{"76561198000000001":"Alice","76561198000000002":"Bob"}` mapping each member's SteamID64 to a display name |
   | `MESSAGE_LANGUAGE`      | *(optional)* `EN` or `PT` — defaults to `EN` if not set |
   | `STORE_COUNTRY_CODE`    | *(optional)* two-letter country code for game prices, e.g. `us` — defaults to `br` |

6. Done. The workflow at `.github/workflows/check-new-games.yml` already
   runs on its own every 15 minutes. To test it without waiting, go to
   **Actions → Steam Family Notifier → Run workflow**.

On the first run the script only saves the current state (it doesn't
notify anything, to avoid flooding the channel with games that already
existed). From the second run on, any new game triggers an alert.

### Adjusting the frequency

To change it, edit the `cron` line in `.github/workflows/check-new-games.yml`
(standard cron syntax, in UTC). GitHub Actions is free for this kind of
use even on private repos, but note that scheduled ("cron") workflows on
low-activity repos aren't guaranteed to run exactly on time — GitHub can
delay or skip runs during high load, especially at popular minutes like
`:00`/`:15`/`:30`/`:45`. If you need reliable timing, consider triggering
the workflow externally via `workflow_dispatch` (e.g. a free service like
cron-job.org calling the GitHub API) instead of relying on `schedule`.

---

## Option B — Running locally (Windows, macOS, or Linux)

Useful for testing before pushing to GitHub, or if you'd rather run it on
your own machine/server instead of GitHub Actions.

```bash
# 1. Clone the repository and enter the folder
git clone <your-fork-url>
cd steam-family-notifier

# 2. Install dependencies (Node.js 20 or newer)
npm ci

# 4. Configure your variables
cp .env.example .env
# edit .env with your STEAM_API_KEY, DISCORD_WEBHOOK_URL, STEAM_MEMBERS, etc.

# 4. Build and run it
npm run build
npm run check-new-games
```

To run it periodically on your own machine, schedule it with **Task
Scheduler** (Windows), **cron** (Linux/macOS), or **launchd** (macOS).

---

## Project structure

```
src/                      -> TypeScript domain, application, ports, adapters, and CLIs
package.json              -> Node.js commands and dependencies
package-lock.json         -> reproducible dependency versions
.env.example              -> template for local environment variables
members.example.json      -> template for the member list format (alternative to STEAM_MEMBERS)
state.json                 -> "database" with the last checked snapshot (committed)
stats.json                  -> gamification totals per member, spent / purchased (committed)
.github/workflows/
  check-new-games.yml        -> the scheduled notifier
   backfill-purchase.yml      -> manual "Backfill Purchase Stats" workflow
discord-bot/                -> optional real-time /ranking Discord command (Cloudflare Worker)
README.md / README.pt-BR.md -> English / Portuguese docs
```

## How it works under the hood

The script calls the Steam Web API's `GetOwnedGames` endpoint for each
configured SteamID. That endpoint returns the list of games available on
the account (including games received via Family Sharing), as long as the
profile's game library is public. On each run, the script compares each
member's current list against the snapshot saved in `state.json`.

The API doesn't directly say whether a new game was purchased or received
through Family Sharing, so the script uses a heuristic: when a new game
shows up on someone's account, it checks whether **another** member of the
group already had that game before this run.

- If yes → assumed shared, message:
  *"🔗 A new game is available on Family Sharing! **X**, shared by **Z**."*
- If nobody else had it and only one member gained access → assumed a
  purchase: *"🎮 **Y** bought a new game: **X**."*
- If nobody had it and several people gained access at once (can't tell
  who bought it) → generic message: *"🎮 A new game appeared in the
  group: **X**."*

If the same game shows up for several members in the same run, the script
sends a **single** message for that game (not one per recipient), since
what matters is the game and who made it available.

Free games are detected and skipped entirely — no Discord message, no
ranking stats (see the Gamification section below for details).

The snapshot is updated and committed back to the repository on every run.

## Message language

Set the `MESSAGE_LANGUAGE` environment variable / secret to `PT` for
Portuguese messages, or `EN` (or leave it unset) for English. Any other
value falls back to English.

## Gamification: spending & purchase rankings

Every time an **unambiguous new purchase** is detected (a single member
gains access to a game nobody else in the group had before), the script
looks up that game's price and adds it to that member's running totals in
`stats.json` — total spent, and total games bought.

### Free games are ignored completely

If the Steam Store marks the title as free-to-play (`is_free`), it's
skipped entirely: no Discord message, no stats update. This is checked
directly against Steam's own flag — a missing price is *not* treated as
"free" (see next section for why that distinction matters).

### Price lookup order (for paid games)

1. The game's own standalone price (`price_overview`) — the normal case.
2. If the game has no standalone listing (only sold as part of a
   bundle/package, no individual SKU) — the cheapest bundle/package price
   that grants it, since that's what the buyer actually paid. The Discord
   message gets a small note: *"(price counted from the bundle/package it
   came in)"*.
3. A best-effort lookup by **searching the Steam Store by name** and using
   the closest match's price. This covers some library-only "wrapper"
   appids with no storefront page. Same bundle note applies. This relies on
   Steam's informal store search endpoint, so it's less precise than a
   direct appid lookup.
4. SteamDB's displayed current price for the app, as a read-only fallback
   when the Steam Store cannot provide one. SteamDB never determines whether
   a game is free: only Steam Store's `is_free` flag does that.
5. Bundle candidates listed by SteamDB, only after the normal app/package
   and Steam Store search paths fail. The script first asks the Steam Store
   for each bundle's price, then uses that bundle's SteamDB price only when
   necessary. The game keeps its original appid in the notification and
   statistics.
6. If none of the above finds a price — the purchase is still announced,
   but flagged as **not counted in the ranking**, and the message tells
   whoever's running the group which command to run to fix it manually
   (see below).

Other cases that are intentionally **not** counted in the ranking:
- Games received through Family Sharing (already counted for the
  original buyer).
- A game appearing for several members at once with no prior owner in
  the group (can't tell who actually bought it).

The lookup region is controlled by the optional `STORE_COUNTRY_CODE`
variable/secret (defaults to `"br"`, e.g. `"us"` for US dollar pricing).

### Fixing an uncounted purchase: the backfill CLI

When a purchase can't be priced automatically, the Discord message says
so and includes the exact `steamid` and `appid` needed to fix it. Two ways
to run the fix:

**Via GitHub Actions (no local install needed):** Actions → *Backfill
Purchase Stats* → Run workflow → fill in `steamid` and `appid` (and
optionally `game_name`, a manual `price`/`currency` override, and whether
to `notify` Discord about the correction). It updates `stats.json` and
commits it back automatically.

**Locally:**
```bash
npm run build
npm run backfill-purchase -- --steamid 76561198000000001 --appid 4659620
# add --notify to also post a Discord message about the correction
# add --price 59.90 --currency BRL to override the price manually,
# for the rare case where even the store-search fallback finds nothing
```

This only touches `stats.json` — the game is presumably already tracked
in `state.json`, so a normal run won't (and shouldn't) treat it as "new"
again.

### Live `/ranking` command

To turn these totals into a live `/ranking` command in Discord, see
[`discord-bot/`](discord-bot/README.md) — a small, free Cloudflare
Worker add-on. Members tied on the same value/count are grouped on the
same line in the ranking (e.g. `🥇 Alice & Bob — R$ 199.90`).

## Limitations

- Depends on each member's Steam profile having a public game library.
- There's no native Steam webhook for this event — the script works by
  periodic polling, so it may take up to one run's interval to detect a
  new game.
- The "shared by Z" attribution is a heuristic based on who in the group
  already had the game, not official Steam data — in rare cases it can
  get the source wrong (e.g. if two members gain access to the same game
  in the same run).
- Price is the store's price at detection time, not necessarily what the
  buyer actually paid (sales, currency changes, etc. aren't tracked).
- The store-search price fallback (step 3 above) relies on an informal,
  undocumented Steam endpoint — reliable in practice, but not guaranteed.

## License

MIT — see [LICENSE](LICENSE).
