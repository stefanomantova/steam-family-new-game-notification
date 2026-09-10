# AGENTS.md

## Purpose

This repository tracks Steam Family Sharing library changes and posts Discord notifications when a new paid game appears for a member. It also maintains lightweight purchase statistics for the optional `/ranking` Discord command implemented in the Cloudflare Worker under `discord-bot/`.

This is a production automation project, not a generic app template. Agentic work should preserve the repository’s operational behavior and the data model.

## Repository map

- `check_new_games.py` — main polling script. Reads Steam APIs, compares against `state.json`, sends Discord messages, and updates `stats.json`.
- `backfill_purchase.py` — manual repair tool for missing or incorrect purchase totals in `stats.json`.
- `state.json` — persisted snapshot of the last checked Steam libraries. Must be kept in sync with actual library state.
- `stats.json` — cumulative purchase totals by member. This file is generated and updated by the main script.
- `.github/workflows/check-new-games.yml` — scheduled GitHub Actions workflow that runs the checker every 15 minutes.
- `discord-bot/` — optional Cloudflare Worker for the `/ranking` Discord command.
- `README.md` and `README.pt-BR.md` — user-facing setup and behavior documentation.
- `members.example.json` — example member format, not real credentials.

## Required environment variables / secrets

These are required for normal operation:

- `STEAM_API_KEY`
- `DISCORD_WEBHOOK_URL`
- `STEAM_MEMBERS` (JSON: `{"steamid64": "display name"}`)

Optional:

- `MESSAGE_LANGUAGE` (`EN` or `PT`)
- `STORE_COUNTRY_CODE` (e.g. `br`, `us`)

For local development, prefer a local `.env` file with values populated there, and do not commit it or any real Steam IDs to the repo. Use `members.example.json` as the pattern for local non-secret examples only.

## Operational rules

- Do not hardcode personal Steam IDs, webhook URLs, API keys, or Discord tokens in source files.
- Keep secrets in environment variables or GitHub Actions repository secrets.
- Preserve the behavior that free games are ignored entirely: no notification and no ranking stats update.
- Preserve the pricing logic in `fetch_game_details()`: direct appid price first, bundle/package fallback second, store search fallback third, then unknown-price handling.
- New games should still trigger a message even when the price is unknown; they should only be omitted from ranking stats when the price cannot be determined.
- When a game appears for multiple members in the same run, send one consolidated message rather than duplicate notifications.
- Treat `state.json` as the canonical library snapshot for the repository.
- Treat `stats.json` as the canonical purchase totals for ranking data.

## Local development commands

From the repo root:

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
python check_new_games.py
```

For the optional Discord ranking bot:

```bash
cd discord-bot
npm install
npm run dev
```

For direct stats repair:

```bash
python backfill_purchase.py --steamid 76561198000000001 --appid 4659620 --notify
```

## Validation expectations

- Use the smallest relevant validation for the change.
- For Python logic changes, prefer a focused runtime check such as `python -m compileall .` or a direct `python check_new_games.py` run with environment variables configured.
- For worker changes in `discord-bot/`, validate with the local Wrangler dev flow or a minimal static check rather than deploying unless explicitly requested.
- If a change alters behavior, README docs may need updates to reflect new setup or runtime constraints.

## Coding guidance for agents

- Keep patches minimal and targeted.
- Prefer clear, readable Python functions over broad refactors.
- Preserve compatibility with both GitHub Actions and local execution.
- Do not introduce new external dependencies unless the repo clearly needs them.
- If changing message wording, keep existing English/Portuguese translation structure consistent with `MESSAGES` in `check_new_games.py`.
- If changing logic around free games, package pricing, or purchase tracking, verify that `stats.json` semantics remain consistent with the existing heuristics.
- If changing repo automation, also review `.github/workflows/check-new-games.yml` and the relevant docs in `README.md` / `README.pt-BR.md`.

## Contribution expectations

- Prefer editing existing files over creating unrelated new modules.
- Keep example files and docs realistic without including real secrets or data.
- When updating behavior, include the rationale in the change summary so future agentic work follows the same assumptions.
- Avoid broad cleanup or style-only churn in the same patch as a functional change.

## Non-goals

- Do not add support for unrelated Steam features outside the Family Sharing notification flow.
- Do not commit or publish any actual user data, member lists, API keys, Discord tokens, or webhook URLs.
- Do not treat price-less apps as free by default; free detection must come from Steam’s own `is_free` flag.

## Summary for agents

Before making changes, confirm:

1. Whether the work is in the Python notifier or the optional Discord Worker.
2. Which configuration variables are involved.
3. Whether the change affects `state.json`, `stats.json`, pricing logic, or Discord message wording.
4. Whether docs or workflow files must be updated to match the new behavior.

Then make the smallest correct patch, validate it with the relevant command, and keep the repository safe from secrets and real member data.
