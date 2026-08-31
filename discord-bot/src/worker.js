/**
 * Steam Family Notifier - /ranking Discord command
 * -------------------------------------------------
 * Cloudflare Worker that handles Discord's HTTP Interactions Endpoint.
 * It has no persistent state of its own: on every /ranking invocation
 * it fetches stats.json straight from the GitHub repository (via the
 * GitHub Contents API, so it works for private repos too) and replies
 * with the current rankings.
 *
 * Required secrets (set with `wrangler secret put <NAME>`):
 * - DISCORD_PUBLIC_KEY  Application's public key (Discord Developer Portal
 *                        -> General Information -> Public Key)
 * - GITHUB_TOKEN         A GitHub token with read access to the repo
 *                        (a fine-grained PAT scoped to just this repo,
 *                        read-only, "Contents" permission, is enough)
 *
 * Required vars (set in wrangler.toml, not secret):
 * - GITHUB_REPO          "owner/repo", e.g. "yourname/steam-family-notifier"
 * - GITHUB_STATS_PATH    Path to stats.json in the repo (default: "stats.json")
 * - GITHUB_BRANCH        Branch to read from (default: "main")
 */

import { verifyKey } from "discord-interactions";

const RANKING_COMMAND_NAME = "ranking";
const MEDALS = ["🥇", "🥈", "🥉"];

async function fetchStats(env) {
  const branch = env.GITHUB_BRANCH || "main";
  const path = env.GITHUB_STATS_PATH || "stats.json";
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}?ref=${branch}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github.raw+json",
      "User-Agent": "steam-family-notifier-ranking-bot",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  return response.json();
}

function formatMoney(value, currency) {
  const amount = (value || 0).toFixed(2);
  if (currency === "BRL") return `R$ ${amount}`;
  if (currency === "USD") return `$${amount}`;
  if (currency === "EUR") return `€${amount}`;
  return currency ? `${amount} ${currency}` : amount;
}

function rankLine(position, text) {
  return `${MEDALS[position - 1] || `${position}.`} ${text}`;
}

/**
 * Groups a sorted (descending) list of members into ranking "slots":
 * members with the exact same value share one slot/position, joined
 * together on the same line. Names within a tied group are sorted
 * alphabetically for a stable, deterministic order.
 *
 * Returns an array of { position, names: [...], value } — position
 * increments by 1 per slot (dense ranking: 1, 2, 3, ... regardless of
 * how many people share a slot), and medals apply to the first three
 * slots, not the first three people.
 */
function groupByTiedValue(members, getValue) {
  const sorted = [...members].sort((a, b) => getValue(b) - getValue(a));
  const slots = [];

  for (const member of sorted) {
    const value = getValue(member);
    const lastSlot = slots[slots.length - 1];
    if (lastSlot && lastSlot.value === value) {
      lastSlot.names.push(member.name);
    } else {
      slots.push({ value, names: [member.name] });
    }
  }

  for (const slot of slots) {
    slot.names.sort((a, b) => a.localeCompare(b));
  }

  return slots.map((slot, index) => ({ ...slot, position: index + 1 }));
}

function buildRankingMessage(stats) {
  const members = Object.values(stats.members || {});
  if (members.length === 0) {
    return "No purchase data yet — the ranking will show up after the group's first tracked purchases.";
  }

  const spentSlots = groupByTiedValue(members, (m) => m.total_spent || 0);
  const countSlots = groupByTiedValue(members, (m) => m.total_purchased || 0);

  const spentLines = spentSlots
    .slice(0, 10)
    .map((slot) =>
      rankLine(slot.position, `**${slot.names.join(" & ")}** — ${formatMoney(slot.value, stats.currency)}`)
    )
    .join("\n");

  const countLines = countSlots
    .slice(0, 10)
    .map((slot) => rankLine(slot.position, `**${slot.names.join(" & ")}** — ${slot.value} game(s)`))
    .join("\n");

  return [
    "**💰 Top spenders**",
    spentLines,
    "",
    "**🛒 Most games bought**",
    countLines,
  ].join("\n");
}

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Steam Family Notifier ranking bot is running.", { status: 200 });
    }

    const signature = request.headers.get("X-Signature-Ed25519");
    const timestamp = request.headers.get("X-Signature-Timestamp");
    const body = await request.text();

    const isValidRequest =
      signature &&
      timestamp &&
      (await verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY));

    if (!isValidRequest) {
      return new Response("Invalid request signature", { status: 401 });
    }

    const interaction = JSON.parse(body);

    // Discord PING used to verify the endpoint is alive.
    if (interaction.type === 1) {
      return Response.json({ type: 1 });
    }

    // Slash command invocation.
    if (interaction.type === 2 && interaction.data?.name === RANKING_COMMAND_NAME) {
      try {
        const stats = await fetchStats(env);
        return Response.json({
          type: 4,
          data: { content: buildRankingMessage(stats) },
        });
      } catch (err) {
        return Response.json({
          type: 4,
          data: { content: `Error fetching the ranking: ${err.message}` },
        });
      }
    }

    return new Response("Unknown interaction", { status: 400 });
  },
};
