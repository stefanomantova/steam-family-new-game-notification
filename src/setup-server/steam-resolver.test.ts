import { describe, expect, it } from "vitest";
import { extractSteamIdentifier } from "./steam-resolver.js";

describe("extractSteamIdentifier", () => {
  it("recognizes standard 17-digit SteamID64", () => {
    const result = extractSteamIdentifier("76561198000000001");
    expect(result).toEqual({ type: "steamid", value: "76561198000000001" });
  });

  it("extracts SteamID64 from profile URLs", () => {
    const res1 = extractSteamIdentifier("https://steamcommunity.com/profiles/76561198012345678");
    expect(res1).toEqual({ type: "steamid", value: "76561198012345678" });

    const res2 = extractSteamIdentifier("https://steamcommunity.com/profiles/76561198012345678/");
    expect(res2).toEqual({ type: "steamid", value: "76561198012345678" });

    const res3 = extractSteamIdentifier("steamcommunity.com/profiles/76561198012345678");
    expect(res3).toEqual({ type: "steamid", value: "76561198012345678" });
  });

  it("extracts custom vanity names from custom URL formats", () => {
    const res1 = extractSteamIdentifier("https://steamcommunity.com/id/gabelog/");
    expect(res1).toEqual({ type: "vanity", value: "gabelog" });

    const res2 = extractSteamIdentifier("https://steamcommunity.com/id/custom-user_123");
    expect(res2).toEqual({ type: "vanity", value: "custom-user_123" });

    const res3 = extractSteamIdentifier("steamcommunity.com/id/stefanom");
    expect(res3).toEqual({ type: "vanity", value: "stefanom" });
  });

  it("treats plain alphanumeric strings as potential vanity names", () => {
    const res = extractSteamIdentifier("coolgamer_99");
    expect(res).toEqual({ type: "vanity", value: "coolgamer_99" });
  });

  it("identifies invalid inputs", () => {
    expect(extractSteamIdentifier("")).toEqual({ type: "invalid", value: "" });
    expect(extractSteamIdentifier("   ")).toEqual({ type: "invalid", value: "" });
    expect(extractSteamIdentifier("http://example.com/notsteam")).toEqual({ type: "invalid", value: "http://example.com/notsteam" });
  });
});
