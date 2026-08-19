# 🎮 Steam Family Notifier

Posts a message on Discord whenever someone in your Steam Family Sharing
group adds a new game.

Runs entirely in the cloud via **GitHub Actions** (no need to keep any
computer on) and can also run locally on **Windows, macOS, or Linux**,
since it's plain Python.

No personal data (SteamIDs, API key, webhook) lives in the code —
everything is configured through environment variables / secrets.

🇧🇷 Leia isso em português: [README.pt-BR.md](README.pt-BR.md)

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

6. Done. The workflow at `.github/workflows/check-new-games.yml` already
   runs on its own every hour (`cron: "0 * * * *"`). To test it without
   waiting, go to **Actions → Steam Family Notifier → Run workflow**.

On the first run the script only saves the current state (it doesn't
notify anything, to avoid flooding the channel with games that already
existed). From the second run on, any new game triggers an alert.

### Adjusting the frequency

The default is every hour. To change it, edit the `cron` line in
`.github/workflows/check-new-games.yml` (standard cron syntax, in UTC).
Examples: `*/15 * * * *` (every 15 min), `0 */6 * * *` (every 6h).
GitHub Actions is free for this kind of use even on private repos
(uses very few minutes per month at this frequency).

---

## Option B — Running locally (Windows, macOS, or Linux)

Useful for testing before pushing to GitHub, or if you'd rather run it on
your own machine/server instead of GitHub Actions.

```bash
# 1. Clone the repository and enter the folder
git clone <your-fork-url>
cd steam-family-notifier

# 2. Create a virtual environment (optional, but recommended)
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure your variables
cp .env.example .env
# edit .env with your STEAM_API_KEY, DISCORD_WEBHOOK_URL, STEAM_MEMBERS, etc.

# 5. Run it
python check_new_games.py
```

To run it periodically on your own machine, schedule it with **Task
Scheduler** (Windows), **cron** (Linux/macOS), or **launchd** (macOS).

---

## Project structure

```
check_new_games.py      -> main script
requirements.txt        -> dependencies
.env.example              -> template for local environment variables
members.example.json      -> template for the member list format (alternative to STEAM_MEMBERS)
state.json                 -> "database" with the last checked snapshot (committed)
stats.json                  -> gamification totals per member, spent / purchased (committed)
.github/workflows/         -> GitHub Actions automation
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

The snapshot is updated and committed back to the repository on every run.

## Message language

Set the `MESSAGE_LANGUAGE` environment variable / secret to `PT` for
Portuguese messages, or `EN` (or leave it unset) for English. Any other
value falls back to English.

## Gamification: spending & purchase rankings

Every time an **unambiguous new purchase** is detected (a single member
gains access to a game nobody else in the group had before), the script
looks up that game's current price on the Steam Store and adds it to that
member's running totals in `stats.json` — total spent, and total games
bought.

- Games received through Family Sharing don't count again (they were
  already counted for the original buyer).
- If a game appears for several members at once with no prior owner in
  the group, it's skipped for stats purposes (can't tell who actually
  bought it).
- The price used is the store's **current** listing at detection time,
  not necessarily what the buyer paid (sales, currency changes, etc.
  aren't tracked).
- The lookup region is controlled by the optional `STORE_COUNTRY_CODE`
  variable/secret (defaults to `"br"`, e.g. `"us"` for US dollar pricing).

To turn these totals into a live `/ranking` command in Discord, see
[`discord-bot/`](discord-bot/README.md) — a small, free Cloudflare
Worker add-on.

## Limitations

- Depends on each member's Steam profile having a public game library.
- There's no native Steam webhook for this event — the script works by
  periodic polling, so it may take up to one run's interval to detect a
  new game.
- The "shared by Z" attribution is a heuristic based on who in the group
  already had the game, not official Steam data — in rare cases it can
  get the source wrong (e.g. if two members gain access to the same game
  in the same run).

## License

MIT — see [LICENSE](LICENSE).