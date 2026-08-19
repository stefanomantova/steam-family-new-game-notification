"""
Steam Family Notifier
----------------------
Checks each group member's Steam game library (via the Steam Web API)
and posts a message on Discord when a new game shows up. Also tracks
lightweight gamification stats (total spent / total games bought) for
unambiguous purchase events, used by the optional /ranking Discord
command (see discord-bot/).

Pure Python (requests + optional dotenv) -> runs the same way on
Windows, macOS and Linux, either locally or on GitHub Actions.

Configured entirely through environment variables (no personal data
needs to be committed to the repository):

- STEAM_API_KEY       (required) your Steam Web API key
                       https://steamcommunity.com/dev/apikey
- DISCORD_WEBHOOK_URL (required) the Discord channel webhook URL
- STEAM_MEMBERS       (recommended) JSON: {"steamid64": "name", ...}
                       If not set, the script falls back to reading
                       a local members.json file.
- MESSAGE_LANGUAGE    (optional) "EN" or "PT" for the Discord message
                       language. Defaults to "EN" for any other value.
- STORE_COUNTRY_CODE  (optional) two-letter country code used to look
                       up game prices on the Steam Store (e.g. "br",
                       "us"). Defaults to "br".

Optional files:
- .env            environment variables for running locally (see .env.example)
- members.json    local alternative to STEAM_MEMBERS (don't commit real data)
- state.json      "database" with the last checked snapshot
                   (this one SHOULD be committed to the repository)
- stats.json      gamification totals per member (spent / purchased)
                   (this one SHOULD be committed to the repository)
"""

import json
import os
import sys
from pathlib import Path

import requests

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

STATE_FILE = Path(os.environ.get("STATE_FILE", "state.json"))
STATS_FILE = Path(os.environ.get("STATS_FILE", "stats.json"))
MEMBERS_FILE = Path(os.environ.get("MEMBERS_FILE", "members.json"))
STORE_COUNTRY_CODE = os.environ.get("STORE_COUNTRY_CODE", "br").strip().lower()

GET_OWNED_GAMES_URL = "https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/"
STORE_APPDETAILS_URL = "https://store.steampowered.com/api/appdetails"

MESSAGES = {
    "EN": {
        "shared": "🔗 A new game is available on Family Sharing! **{game}**, shared by **{source}**.",
        "purchased": "🎮 **{buyer}** bought a new game: **{game}**",
        "purchased_ambiguous": "🎮 A new game appeared in the group: **{game}** (not counted in the ranking, can't tell who bought it)",
    },
    "PT": {
        "shared": "🔗 Um jogo novo está disponível no Family Sharing! **{game}**, compartilhado por **{source}**.",
        "purchased": "🎮 **{buyer}** comprou um jogo novo: **{game}**",
        "purchased_ambiguous": "🎮 Um jogo novo apareceu no grupo: **{game}** (não contabilizado no ranking, não dá pra saber quem comprou)",
    },
}


def get_message_language() -> str:
    lang = os.environ.get("MESSAGE_LANGUAGE", "EN").strip().upper()
    return lang if lang in MESSAGES else "EN"


def load_json_file(path: Path, default):
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return default


def save_json_file(path: Path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def load_members() -> dict:
    """Loads the member list. Priority:
    1. STEAM_MEMBERS environment variable (JSON: {"steamid": "name", ...})
    2. Local members.json file
    """
    raw = os.environ.get("STEAM_MEMBERS")
    if raw:
        try:
            return json.loads(raw)
        except json.JSONDecodeError as e:
            print(f"STEAM_MEMBERS is not valid JSON: {e}")
            sys.exit(1)
    return load_json_file(MEMBERS_FILE, {})


def fetch_owned_games(steamid: str, api_key: str) -> dict:
    """Returns {appid: game_name} for the games available on that
    account (own library + games shared via Family Sharing, as long
    as the profile's game library is public)."""
    params = {
        "key": api_key,
        "steamid": steamid,
        "format": "json",
        "include_appinfo": 1,
        "include_played_free_games": 1,
    }
    resp = requests.get(GET_OWNED_GAMES_URL, params=params, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    games = data.get("response", {}).get("games", [])
    return {str(g["appid"]): g.get("name", f"App {g['appid']}") for g in games}


def fetch_game_price(appid: str, country_code: str):
    """Returns (price, currency) for the given appid in the Steam Store,
    using the store's current listed price. Returns (0.0, None) for free
    games, games with no listed price in that region, or on any error.
    This is the CURRENT price, not necessarily what the buyer actually
    paid (sales, regional pricing changes, etc. are not accounted for)."""
    params = {"appids": appid, "cc": country_code, "filters": "price_overview"}
    try:
        resp = requests.get(STORE_APPDETAILS_URL, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        entry = data.get(str(appid), {})
        if not entry.get("success"):
            return 0.0, None
        price_overview = entry.get("data", {}).get("price_overview")
        if not price_overview:
            return 0.0, None  # free game, or no price listed in this region
        price = price_overview.get("final", 0) / 100
        currency = price_overview.get("currency")
        return price, currency
    except Exception as e:
        print(f"Error fetching price for appid {appid}: {e}")
        return 0.0, None


def send_discord_message(webhook_url: str, content: str):
    resp = requests.post(webhook_url, json={"content": content}, timeout=30)
    resp.raise_for_status()


def find_source_member(appid: str, recipient_steamids: set, previous_state: dict, members: dict):
    """Checks whether some member NOT among the current recipients already
    had this appid before this run. If so, the game most likely became
    available to the recipients through Family Sharing (not a fresh
    purchase). Returns that member's name, or None if nobody in the group
    had the game before (in which case we treat it as a new purchase)."""
    for other_steamid, other_previous_games in previous_state.items():
        if other_steamid in recipient_steamids:
            continue
        if appid in other_previous_games:
            return members.get(other_steamid, other_steamid)
    return None


def update_stats(stats: dict, steamid: str, name: str, price: float, currency):
    """Adds one purchase event to a member's running totals."""
    if currency and not stats.get("currency"):
        stats["currency"] = currency
    member_stats = stats["members"].setdefault(
        steamid, {"name": name, "total_spent": 0.0, "total_purchased": 0}
    )
    member_stats["name"] = name  # keep the display name fresh
    member_stats["total_spent"] = round(member_stats["total_spent"] + price, 2)
    member_stats["total_purchased"] += 1


def main():
    api_key = os.environ.get("STEAM_API_KEY")
    webhook_url = os.environ.get("DISCORD_WEBHOOK_URL")
    lang = get_message_language()

    if not api_key:
        print("Set the STEAM_API_KEY environment variable.")
        sys.exit(1)
    if not webhook_url:
        print("Set the DISCORD_WEBHOOK_URL environment variable.")
        sys.exit(1)

    members = load_members()
    if not members:
        print(
            "No members configured. Set the STEAM_MEMBERS environment "
            "variable (JSON) or create a local members.json file."
        )
        sys.exit(1)

    state = load_json_file(STATE_FILE, {})
    previous_state = json.loads(json.dumps(state))  # snapshot before any update
    state_changed = False

    stats = load_json_file(STATS_FILE, {"currency": None, "members": {}})
    stats.setdefault("members", {})
    stats_changed = False

    # First pass: fetch every member's current library before comparing,
    # so we can cross-reference between members in the second pass.
    current_by_member = {}
    for steamid, name in members.items():
        print(f"Checking {name}'s library ({steamid})...")
        try:
            current_by_member[steamid] = fetch_owned_games(steamid, api_key)
        except Exception as e:
            print(f"Error fetching {name}: {e}")

    # Second pass: group by GAME (not by member), so we don't send a
    # duplicate message when the same game shows up for several members
    # at once (common when someone enables sharing for a title with the
    # whole group).
    new_appid_to_recipients = {}  # appid -> {steamid: game_name}
    for steamid, current_games in current_by_member.items():
        previous_games = previous_state.get(steamid, {})
        if not previous_games:
            # first time we see this member: just store their initial state
            continue
        for appid in set(current_games) - set(previous_games):
            new_appid_to_recipients.setdefault(appid, {})[steamid] = current_games[appid]

    for appid, recipients in new_appid_to_recipients.items():
        game_name = next(iter(recipients.values()))
        recipient_ids = set(recipients.keys())
        source_name = find_source_member(appid, recipient_ids, previous_state, members)
        texts = MESSAGES[lang]

        if source_name:
            # Shared with the group: already counted for the original
            # buyer back when they first got it, so no stats update here.
            message = texts["shared"].format(game=game_name, source=source_name)
        elif len(recipient_ids) == 1:
            # Unambiguous new purchase: look up the current store price
            # and add it to that member's running totals.
            buyer_steamid = next(iter(recipient_ids))
            buyer_name = members.get(buyer_steamid, buyer_steamid)
            price, currency = fetch_game_price(appid, STORE_COUNTRY_CODE)
            update_stats(stats, buyer_steamid, buyer_name, price, currency)
            stats_changed = True
            message = texts["purchased"].format(buyer=buyer_name, game=game_name)
        else:
            # Appeared from scratch for multiple members at once, with no
            # prior owner in the group: likely a purchase with sharing
            # already enabled, but we can't reliably tell who bought it,
            # so it's not counted towards anyone's ranking totals.
            message = texts["purchased_ambiguous"].format(game=game_name)

        print(message)
        try:
            send_discord_message(webhook_url, message)
        except Exception as e:
            print(f"Error sending Discord message: {e}")

    if not new_appid_to_recipients:
        print("No new games found.")

    # Update the saved state with each member's current library.
    for steamid, current_games in current_by_member.items():
        if current_games != previous_state.get(steamid, {}):
            state[steamid] = current_games
            state_changed = True

    if state_changed:
        save_json_file(STATE_FILE, state)
        print("State updated.")
    else:
        print("No state changes to save.")

    if stats_changed:
        save_json_file(STATS_FILE, stats)
        print("Stats updated.")


if __name__ == "__main__":
    main()
