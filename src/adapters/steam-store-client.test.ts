import { afterEach, describe, expect, it, vi } from "vitest";
import { SteamStoreClient } from "./steam-store-client.js";

function response(body: string) {
  return { ok: true, text: async () => body } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SteamStoreClient pricing fallbacks", () => {
  it("uses SteamDB's app price only after Steam Store search cannot price an app", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(JSON.stringify({ "10": { success: false } })))
      .mockResolvedValueOnce(response(JSON.stringify({ items: [] })))
      .mockResolvedValueOnce(response("<tr><td>Current Price</td><td>R$ 42,99</td></tr>"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(new SteamStoreClient().fetchGameDetails("10", "Example", "br")).resolves.toEqual({
      price: {
        kind: "paid",
        priceCents: 4299,
        currency: "BRL",
        fromBundle: false,
      },
      isFamilyShareable: true,
    });
  });

  it("uses the first SteamDB bundle candidate with a Steam Store price", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(JSON.stringify({ "10": { success: false } })))
      .mockResolvedValueOnce(response(JSON.stringify({ items: [] })))
      .mockResolvedValueOnce(response("<tr><td>Current Price</td><td>Unavailable</td></tr>"))
      .mockResolvedValueOnce(response('<a href="/bundle/101/">One</a><a href="/bundle/101/">Duplicate</a>'))
      .mockResolvedValueOnce(response(JSON.stringify({
        success: true,
        data: { price: { final: 1999, currency: "BRL" } },
      })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(new SteamStoreClient().fetchGameDetails("10", "Example", "br")).resolves.toEqual({
      price: {
        kind: "paid",
        priceCents: 1999,
        currency: "BRL",
        fromBundle: true,
      },
      isFamilyShareable: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("falls back to a bundle's SteamDB price when the Steam Store cannot price it", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(JSON.stringify({ "10": { success: false } })))
      .mockResolvedValueOnce(response(JSON.stringify({ items: [] })))
      .mockResolvedValueOnce(response("<tr><td>Current Price</td><td>Unavailable</td></tr>"))
      .mockResolvedValueOnce(response('<a href="/bundle/101/">One</a>'))
      .mockResolvedValueOnce(response(JSON.stringify({ success: true, data: {} })))
      .mockResolvedValueOnce(response("<tr><td>Current Price</td><td>$19.99</td></tr>"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(new SteamStoreClient().fetchGameDetails("10", "Example", "us")).resolves.toEqual({
      price: {
        kind: "paid",
        priceCents: 1999,
        currency: "USD",
        fromBundle: true,
      },
      isFamilyShareable: true,
    });
  });

  it("keeps Steam Store's free flag authoritative", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response(JSON.stringify({
      "10": { success: true, data: { is_free: true, categories: [{ id: 62 }] } },
    })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(new SteamStoreClient().fetchGameDetails("10", "Example", "br")).resolves.toEqual({
      price: { kind: "free" },
      isFamilyShareable: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("detects when a game is not eligible for Family Sharing (missing category 62)", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response(JSON.stringify({
      "1222700": {
        success: true,
        data: {
          is_free: false,
          categories: [{ id: 1, description: "Multi-player" }, { id: 9, description: "Co-op" }],
          price_overview: { final: 2670, currency: "BRL" },
        },
      },
    })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(new SteamStoreClient().fetchGameDetails("1222700", "A Way Out", "br")).resolves.toEqual({
      price: {
        kind: "paid",
        priceCents: 2670,
        currency: "BRL",
        fromBundle: false,
      },
      isFamilyShareable: false,
    });
  });
});
