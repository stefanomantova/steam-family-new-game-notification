"""
Steam Family Notifier
----------------------
Checks each group member's Steam game library (via the Steam Web API)
and posts a message on Discord when a new PAID game shows up. Free
games are intentionally ignored — no notification, no ranking stats.
Also tracks lightweight gamification stats (total spent / total games
bought) for unambiguous purchase events, used by the optional /ranking
Discord command (see discord-bot/).

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
STORE_COUNTRY_CODE = (os.environ.get("STORE_COUNTRY_CODE") or "br").strip().lower()

GET_OWNED_GAMES_URL = "https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/"
STORE_APPDETAILS_URL = "https://store.steampowered.com/api/appdetails"
STORE_SEARCH_URL = "https://store.steampowered.com/api/storesearch/"

# Used only for the bundle/package price fallback (see fetch_game_details),
# since Steam's package pricing doesn't come with an explicit currency
# label the way price_overview does. Covers common storefronts; add more
# as needed.
COUNTRY_CURRENCY = {
    "br": "BRL", "us": "USD", "gb": "GBP", "ca": "CAD", "au": "AUD",
    "de": "EUR", "fr": "EUR", "es": "EUR", "it": "EUR", "nl": "EUR",
    "pt": "EUR", "jp": "JPY", "ar": "ARS", "mx": "MXN",
}

MESSAGES = {
    "EN": {
        "shared": "🔗 A new game is available on Family Sharing! **{game}**, shared by **{source}**.",
        "purchased": "🎮 **{buyer}** bought a new game: **{game}**",
        "purchased_unshareable": "🎮 **{buyer}** bought a new game: **{game}** (not eligible for Family Sharing, not counted in the ranking)",
        "bundle_note": "(price counted from the bundle/package it came in)",
        "retroactive_note": "(retroactively added)",
        "purchased_price_unknown": "🎮 **{buyer}** bought a new game: **{game}** (price unknown, not counted in the ranking)",
        "purchased_ambiguous": "🎮 A new game appeared in the group: **{game}** (not counted in the ranking, can't tell who bought it)",
        "purchased_ambiguous_unshareable": "🎮 A new game appeared in the group: **{game}** (not eligible for Family Sharing, not counted in the ranking)",
    },
    "PT": {
        "shared": "🔗 Um jogo novo está disponível no Family Sharing! **{game}**, compartilhado por **{source}**.",
        "purchased": "🎮 **{buyer}** comprou um jogo novo: **{game}**",
        "purchased_unshareable": "🎮 **{buyer}** comprou um jogo novo: **{game}** (não compatível com Family Sharing, não contabilizado no ranking)",
        "bundle_note": "(preço contabilizado a partir do bundle/pacote em que veio)",
        "retroactive_note": "(adicionado retroativamente)",
        "purchased_price_unknown": "🎮 **{buyer}** comprou um jogo novo: **{game}** (preço desconhecido, não contabilizado no ranking)",
        "purchased_ambiguous": "🎮 Um jogo novo apareceu no grupo: **{game}** (não contabilizado no ranking, não dá pra saber quem comprou)",
        "purchased_ambiguous_unshareable": "🎮 Um jogo novo apareceu no grupo: **{game}** (não compatível com Family Sharing, não contabilizado no ranking)",
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


def fetch_price_via_search(game_name: str, country_code: str):
    """Last-resort price lookup: searches the Steam Store by name and
    uses the closest-matching result's price. Used when an appid has no
    storefront page of its own at all (appdetails returns success:false
    with no data whatsoever — happens for some bundle-wrapper appids
    that only exist as a library entry, never as a browsable app page).

    This relies on Steam's public (but informal/undocumented) store
    search endpoint, so it's inherently less precise than a direct
    appid lookup — name matching isn't guaranteed exact. Returns
    (price, currency), or (None, None) if nothing usable was found.
    """
    if not game_name:
        return None, None
    try:
        params = {"term": game_name, "cc": country_code, "l": "english"}
        resp = requests.get(STORE_SEARCH_URL, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        items = data.get("items") or []
        if not items:
            return None, None

        normalized = game_name.strip().lower()
        exact_match = next(
            (item for item in items if item.get("name", "").strip().lower() == normalized),
            None,
        )
        chosen = exact_match or items[0]

        price_info = chosen.get("price")
        if not price_info:
            return None, None  # free, or price hidden/unavailable for this region

        price = price_info.get("final", 0) / 100
        currency = price_info.get("currency")
        return price, currency
    except Exception as e:
        print(f"Error searching the store for '{game_name}': {e}")
        return None, None


def fetch_game_details(appid: str, country_code: str, game_name: str = None):
    """Returns (is_free, price, currency, from_bundle) for the given
    appid on the Steam Store.

    - is_free: taken directly from the store's own "is_free" flag —
      the authoritative signal for free-to-play titles. We do NOT
      infer "free" just from a missing price_overview, because some
      PAID games have no individual price_overview (e.g. titles only
      sold as part of a bundle, with no standalone SKU) — treating
      those as free would incorrectly skip a real purchase.
    - price: the CURRENT listed price. For a game with its own
      standalone listing, this is that price. For a game only sold as
      part of a bundle/package (no individual price_overview), this
      falls back to the cheapest bundle/package price that grants it.
      If the appid has no storefront page at all (appdetails returns
      success:false), falls back further to a store-search-by-name
      lookup when `game_name` is provided. None if no price could be
      determined at all — the caller should treat that as "price
      unknown", not as free and not as R$0.
    - currency: the store's currency code for that price (e.g. "BRL")
      when available. For the bundle-price fallback, it's inferred
      from `country_code` via a small lookup table (None for uncommon
      country codes).
    - from_bundle: True if `price` came from the bundle/package or
      store-search fallback rather than the game's own standalone
      price_overview — used to add a transparency note in the Discord
      message.

    On any error, defaults to (False, None, None, False) — treated as
    a paid game with an unknown price, so an API hiccup never silently
    swallows a real purchase notification.
    """
    params = {"appids": appid, "cc": country_code}  # no filters: need package_groups too
    try:
        resp = requests.get(STORE_APPDETAILS_URL, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        entry = data.get(str(appid), {})
        if not entry.get("success"):
            # No storefront page for this appid at all — last resort:
            # search by name (only possible if the caller knows it,
            # e.g. from GetOwnedGames, since we have no data to read a
            # name from here).
            price, currency = fetch_price_via_search(game_name, country_code)
            if price is not None:
                return False, price, currency, True
            return False, None, None, False

        details = entry.get("data", {})
        is_free = bool(details.get("is_free", False))
        if is_free:
            return True, 0.0, None, False

        price_overview = details.get("price_overview")
        if price_overview:
            price = price_overview.get("final", 0) / 100
            currency = price_overview.get("currency")
            return False, price, currency, False

        # Paid game with no standalone price_overview — common for
        # titles only sold as part of a bundle/package. Fall back to
        # the cheapest bundle/package price that includes this game,
        # since that's what the buyer actually paid to get it.
        sub_prices = []
        for group in details.get("package_groups") or []:
            for sub in group.get("subs", []):
                cents = sub.get("price_in_cents_with_discount")
                if cents:
                    sub_prices.append(cents)

        if sub_prices:
            price = min(sub_prices) / 100
            currency = COUNTRY_CURRENCY.get(country_code)
            return False, price, currency, True

        # Still nothing — try the store-search-by-name fallback here too.
        price, currency = fetch_price_via_search(game_name, country_code)
        if price is not None:
            return False, price, currency, True

        return False, None, None, False
    except Exception as e:
        print(f"Error fetching store details for appid {appid}: {e}")
        return False, None, None, False


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

        # Free games are intentionally ignored entirely: no Discord
        # message, no ranking stats. Paid games with an unknown price
        # (e.g. bundle-exclusive titles) still get notified, just not
        # counted towards the ranking.
        is_free, price, currency, from_bundle = fetch_game_details(appid, STORE_COUNTRY_CODE, game_name)
        if is_free:
            print(f"Skipping free game: {game_name} (appid {appid})")
            continue

        recipient_ids = set(recipients.keys())
        source_name = find_source_member(appid, recipient_ids, previous_state, members)
        texts = MESSAGES[lang]

        if source_name:
            # Shared with the group: already counted for the original
            # buyer back when they first got it, so no stats update here.
            message = texts["shared"].format(game=game_name, source=source_name)
        elif len(recipient_ids) == 1:
            buyer_steamid = next(iter(recipient_ids))
            buyer_name = members.get(buyer_steamid, buyer_steamid)
            if price is None:
                # Truly no price could be determined (not even a
                # bundle/package price) — still notify, but don't guess
                # a number for the ranking.
                message = texts["purchased_price_unknown"].format(buyer=buyer_name, game=game_name)
            else:
                update_stats(stats, buyer_steamid, buyer_name, price, currency)
                stats_changed = True
                message = texts["purchased"].format(buyer=buyer_name, game=game_name)
                if from_bundle:
                    message += " " + texts["bundle_note"]
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

    # Always (re)write both files, even with no changes, so they're
    # guaranteed to exist on disk for the workflow's `git add` step
    # (important on the very first runs, before either file has ever
    # been committed to the repository).
    save_json_file(STATE_FILE, state)
    save_json_file(STATS_FILE, stats)
    print("State updated." if state_changed else "No state changes.")
    print("Stats updated." if stats_changed else "No stats changes.")


if __name__ == "__main__":
    main()
