"""
Backfill a purchase into stats.json
------------------------------------
One-off manual fix for a purchase that check_new_games.py didn't count
correctly at the time (e.g. it hit the free-vs-paid detection bug fixed
later, or any other edge case). Reuses the exact same price-lookup logic
as the main script, so the number ends up consistent with what a normal
run would have recorded.

This does NOT touch state.json — the game is presumably already in the
member's tracked library, so a normal run won't (and shouldn't) treat it
as "new" again. This script only fixes stats.json.

Usage:
  python backfill_purchase.py --steamid 76561198000000001 --appid 4659620
  python backfill_purchase.py --steamid 76561198000000001 --appid 4659620 --notify

Run from the same folder as check_new_games.py (it imports from it), with
the same environment variables available (a local .env works, same as
for check_new_games.py). STEAM_API_KEY isn't needed for this script.
"""

import argparse
import os

from check_new_games import (
    MESSAGES,
    STATS_FILE,
    STORE_APPDETAILS_URL,
    STORE_COUNTRY_CODE,
    fetch_game_details,
    get_message_language,
    load_json_file,
    load_members,
    save_json_file,
    send_discord_message,
    update_stats,
)

import requests


def fetch_game_name(appid: str, country_code: str) -> str:
    """Best-effort lookup of the game's display name from the Steam Store."""
    try:
        params = {"appids": appid, "cc": country_code, "filters": "basic"}
        resp = requests.get(STORE_APPDETAILS_URL, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        entry = data.get(str(appid), {})
        if entry.get("success"):
            return entry.get("data", {}).get("name", f"App {appid}")
    except Exception as e:
        print(f"Could not fetch the game name automatically: {e}")
    return f"App {appid}"


def main():
    parser = argparse.ArgumentParser(description="Backfill a purchase into stats.json")
    parser.add_argument("--steamid", required=True, help="The buyer's SteamID64")
    parser.add_argument("--appid", required=True, help="The game's Steam appid")
    parser.add_argument(
        "--game-name",
        help="Override the game name shown (fetched from the Steam Store if omitted)",
    )
    parser.add_argument(
        "--notify",
        action="store_true",
        help="Also post a Discord message about this backfilled purchase",
    )
    args = parser.parse_args()

    members = load_members()
    buyer_name = members.get(args.steamid, args.steamid)

    is_free, price, currency, from_bundle = fetch_game_details(args.appid, STORE_COUNTRY_CODE)
    if is_free:
        print("This appid is marked as free by the Steam Store — nothing to backfill.")
        return
    if price is None:
        print(
            "Could not determine a price for this appid (not even a bundle/package "
            "price). Nothing was added — you may need to set the price manually by "
            "editing stats.json directly."
        )
        return

    game_name = args.game_name or fetch_game_name(args.appid, STORE_COUNTRY_CODE)

    stats = load_json_file(STATS_FILE, {"currency": None, "members": {}})
    stats.setdefault("members", {})
    update_stats(stats, args.steamid, buyer_name, price, currency)
    save_json_file(STATS_FILE, stats)

    currency_label = f" {currency}" if currency else ""
    print(f"Added '{game_name}' ({price:.2f}{currency_label}) to {buyer_name}'s stats.")
    if from_bundle:
        print("(price came from a bundle/package, not a standalone listing)")

    if args.notify:
        webhook_url = os.environ.get("DISCORD_WEBHOOK_URL")
        if not webhook_url:
            print("DISCORD_WEBHOOK_URL not set — skipping Discord notification.")
            return
        lang = get_message_language()
        texts = MESSAGES[lang]
        message = texts["purchased"].format(buyer=buyer_name, game=game_name)
        if from_bundle:
            message += " " + texts["bundle_note"]
        message += " " + texts["retroactive_note"]
        send_discord_message(webhook_url, message)
        print("Discord notification sent.")


if __name__ == "__main__":
    main()
