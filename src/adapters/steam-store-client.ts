import type { AppId } from "../domain/models.js";
import { fallbackPrice, directPrice, type PriceResult } from "../domain/pricing.js";
import type { StoreClient } from "../ports/store-client.js";
import { fetchJson, fetchText } from "./http.js";

const STORE_APPDETAILS_URL = "https://store.steampowered.com/api/appdetails";
const STORE_BUNDLE_URL = "https://store.steampowered.com/api/bundle";
const STORE_SEARCH_URL = "https://store.steampowered.com/api/storesearch/";
const STEAMDB_URL = "https://steamdb.info";

const COUNTRY_CURRENCY: Record<string, string> = {
  br: "BRL",
  us: "USD",
  gb: "GBP",
  ca: "CAD",
  au: "AUD",
  de: "EUR",
  fr: "EUR",
  es: "EUR",
  it: "EUR",
  nl: "EUR",
  pt: "EUR",
  jp: "JPY",
  ar: "ARS",
  mx: "MXN",
};

interface AppDetailsResponse {
  [appid: string]: {
    success?: boolean;
    data?: {
      is_free?: boolean;
      name?: string;
      price_overview?: { final?: number; currency?: string };
      package_groups?: Array<{
        subs?: Array<{ price_in_cents_with_discount?: number }>;
      }>;
    };
  };
}

interface SearchResponse {
  items?: Array<{
    name?: string;
    price?: { final?: number; currency?: string };
  }>;
}

interface BundleDetailsResponse {
  success?: boolean;
  data?: {
    price?: { final?: number; currency?: string };
  };
}

interface Price {
  priceCents: number;
  currency?: string;
}

export class SteamStoreClient implements StoreClient {
  public async fetchGameDetails(
    appid: AppId,
    gameName: string,
    countryCode: string,
  ): Promise<PriceResult> {
    let packagePrices: number[] = [];

    try {
      const url = new URL(STORE_APPDETAILS_URL);
      url.search = new URLSearchParams({ appids: appid, cc: countryCode }).toString();
      const data = await fetchJson<AppDetailsResponse>(url.toString());
      const entry = data[appid];

      if (entry?.success) {
        const details = entry.data ?? {};
        const direct = directPrice(
          Boolean(details.is_free),
          details.price_overview?.final,
          details.price_overview?.currency,
        );
        if (direct.kind !== "unknown") {
          return direct;
        }

        packagePrices = (details.package_groups ?? []).flatMap((group) =>
          (group.subs ?? [])
            .map((sub) => sub.price_in_cents_with_discount)
            .filter((price): price is number => price !== undefined),
        );
      }
    } catch (error) {
      console.error(`Error fetching store details for appid ${appid}:`, error);
    }

    const packagePrice = fallbackPrice(packagePrices, undefined, COUNTRY_CURRENCY[countryCode]);
    if (packagePrice.kind === "paid") {
      return packagePrice;
    }

    const search = await this.searchPrice(gameName, countryCode);
    if (search.kind === "paid") {
      return search;
    }

    const steamDbAppPrice = await this.fetchSteamDbPrice(appid, "app", countryCode);
    if (steamDbAppPrice) {
      return { kind: "paid", ...steamDbAppPrice, fromBundle: false };
    }

    for (const bundleId of await this.findBundlesForApp(appid)) {
      const bundlePrice = await this.fetchBundlePrice(bundleId, countryCode);
      if (bundlePrice) {
        return { kind: "paid", ...bundlePrice, fromBundle: true };
      }

      const steamDbBundlePrice = await this.fetchSteamDbPrice(bundleId, "bundle", countryCode);
      if (steamDbBundlePrice) {
        return { kind: "paid", ...steamDbBundlePrice, fromBundle: true };
      }
    }

    return { kind: "unknown" };
  }

  public async fetchGameName(appid: AppId, countryCode: string): Promise<string> {
    try {
      const url = new URL(STORE_APPDETAILS_URL);
      url.search = new URLSearchParams({ appids: appid, cc: countryCode, filters: "basic" }).toString();
      const data = await fetchJson<AppDetailsResponse>(url.toString());
      return data[appid]?.data?.name ?? `App ${appid}`;
    } catch (error) {
      console.error(`Could not fetch the game name automatically:`, error);
      return `App ${appid}`;
    }
  }

  private async searchPrice(gameName: string, countryCode: string): Promise<PriceResult> {
    if (!gameName) {
      return { kind: "unknown" };
    }

    try {
      const url = new URL(STORE_SEARCH_URL);
      url.search = new URLSearchParams({ term: gameName, cc: countryCode, l: "english" }).toString();
      const data = await fetchJson<SearchResponse>(url.toString());
      const items = data.items ?? [];
      const normalized = gameName.trim().toLowerCase();
      const chosen = items.find((item) => item.name?.trim().toLowerCase() === normalized) ?? items[0];
      const final = chosen?.price?.final;

      if (final === undefined) {
        return { kind: "unknown" };
      }

      const currency = chosen?.price?.currency;

      return {
        kind: "paid",
        priceCents: final,
        ...(currency ? { currency } : {}),
        fromBundle: true,
      };
    } catch (error) {
      console.error(`Error searching the store for '${gameName}':`, error);
      return { kind: "unknown" };
    }
  }

  private async findBundlesForApp(appid: AppId): Promise<string[]> {
    try {
      const page = await fetchText(`${STEAMDB_URL}/app/${appid}/bundles/`);
      return [...new Set([...page.matchAll(/\/bundle\/(\d+)\//g)].map((match) => match[1]!))];
    } catch (error) {
      console.error(`Error fetching SteamDB bundles for appid ${appid}:`, error);
      return [];
    }
  }

  private async fetchBundlePrice(bundleId: string, countryCode: string): Promise<Price | undefined> {
    try {
      const url = new URL(STORE_BUNDLE_URL);
      url.search = new URLSearchParams({ bundleid: bundleId, cc: countryCode }).toString();
      const data = await fetchJson<BundleDetailsResponse>(url.toString());
      const price = data.success ? data.data?.price : undefined;
      if (price?.final === undefined) {
        return undefined;
      }
      return { priceCents: price.final, ...(price.currency ? { currency: price.currency } : {}) };
    } catch (error) {
      console.error(`Error fetching store bundle ${bundleId}:`, error);
      return undefined;
    }
  }

  private async fetchSteamDbPrice(
    itemId: string,
    itemType: "app" | "bundle",
    countryCode: string,
  ): Promise<Price | undefined> {
    try {
      const page = await fetchText(`${STEAMDB_URL}/${itemType}/${itemId}/`);
      const row = /<td[^>]*>\s*Current Price\s*<\/td>\s*<td[^>]*>(.*?)<\/td>/is.exec(page);
      if (!row) {
        console.error(`SteamDB current price not found for ${itemType} ${itemId}.`);
        return undefined;
      }

      const priceText = row[1]!.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
      const priceMatch = /(?:R\$|US\$|\$|€|£|¥)\s*(?:\d{1,3}(?:[.,\s]\d{3})*|\d+)(?:[.,]\d{1,2})?/.exec(priceText);
      return this.parseSteamDbPrice(priceMatch?.[0] ?? priceText, countryCode);
    } catch (error) {
      console.error(`Error fetching SteamDB price for ${itemType} ${itemId}:`, error);
      return undefined;
    }
  }

  private parseSteamDbPrice(priceText: string, countryCode: string): Price | undefined {
    const currencyPatterns: ReadonlyArray<readonly [string, string]> = [
      ["R$", "BRL"],
      ["US$", "USD"],
      ["€", "EUR"],
      ["£", "GBP"],
      ["¥", "JPY"],
      ["$", COUNTRY_CURRENCY[countryCode] ?? "USD"],
    ];
    const currency = currencyPatterns.find(([symbol]) => priceText.includes(symbol))?.[1];
    const amountMatch = /\d[\d.,\s]*/.exec(priceText);
    if (!currency || !amountMatch) {
      return undefined;
    }

    let amount = amountMatch[0].replaceAll(" ", "");
    if (amount.includes(",") && amount.includes(".")) {
      amount = amount.lastIndexOf(",") > amount.lastIndexOf(".")
        ? amount.replaceAll(".", "").replace(",", ".")
        : amount.replaceAll(",", "");
    } else if (amount.includes(",")) {
      amount = amount.split(",").at(-1)!.length <= 2
        ? amount.replaceAll(".", "").replace(",", ".")
        : amount.replaceAll(",", "");
    }

    const priceCents = Math.round(Number(amount) * 100);
    return Number.isFinite(priceCents) ? { priceCents, currency } : undefined;
  }
}
