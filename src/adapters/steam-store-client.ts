import type { AppId } from "../domain/models.js";
import { fallbackPrice, directPrice, type PriceResult } from "../domain/pricing.js";
import type { StoreClient } from "../ports/store-client.js";
import { fetchJson } from "./http.js";

const STORE_APPDETAILS_URL = "https://store.steampowered.com/api/appdetails";
const STORE_SEARCH_URL = "https://store.steampowered.com/api/storesearch/";

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

export class SteamStoreClient implements StoreClient {
  public async fetchGameDetails(
    appid: AppId,
    gameName: string,
    countryCode: string,
  ): Promise<PriceResult> {
    try {
      const url = new URL(STORE_APPDETAILS_URL);
      url.search = new URLSearchParams({ appids: appid, cc: countryCode }).toString();
      const data = await fetchJson<AppDetailsResponse>(url.toString());
      const entry = data[appid];

      if (!entry?.success) {
        return this.searchPrice(gameName, countryCode);
      }

      const details = entry.data ?? {};
      const direct = directPrice(
        Boolean(details.is_free),
        details.price_overview?.final,
        details.price_overview?.currency,
      );
      if (direct.kind !== "unknown") {
        return direct;
      }

      const packagePrices = (details.package_groups ?? []).flatMap((group) =>
        (group.subs ?? [])
          .map((sub) => sub.price_in_cents_with_discount)
          .filter((price): price is number => price !== undefined),
      );
      return this.searchOrFallback(packagePrices, gameName, countryCode);
    } catch (error) {
      console.error(`Error fetching store details for appid ${appid}:`, error);
      return { kind: "unknown" };
    }
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

  private async searchOrFallback(
    packagePrices: number[],
    gameName: string,
    countryCode: string,
  ): Promise<PriceResult> {
    if (packagePrices.some((price) => price > 0)) {
      return fallbackPrice(packagePrices, undefined, COUNTRY_CURRENCY[countryCode]);
    }

    const search = await this.searchPrice(gameName, countryCode);
    const searchPrice = search.kind === "paid" ? search.priceCents : undefined;
    const searchCurrency = search.kind === "paid" ? search.currency : undefined;
    return fallbackPrice(
      packagePrices,
      searchPrice,
      searchCurrency ?? COUNTRY_CURRENCY[countryCode],
    );
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
}
