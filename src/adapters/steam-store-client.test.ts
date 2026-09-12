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
      kind: "paid",
      priceCents: 4299,
      currency: "BRL",
      fromBundle: false,
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
      kind: "paid",
      priceCents: 1999,
      currency: "BRL",
      fromBundle: true,
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
      kind: "paid",
      priceCents: 1999,
      currency: "USD",
      fromBundle: true,
    });
  });

  it("keeps Steam Store's free flag authoritative", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response(JSON.stringify({
      "10": { success: true, data: { is_free: true } },
    })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(new SteamStoreClient().fetchGameDetails("10", "Example", "br")).resolves.toEqual({
      kind: "free",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
