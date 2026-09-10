export type SteamId = string;
export type AppId = string;
export type Members = Record<SteamId, string>;
export type Library = Record<AppId, string>;
export type LibrarySnapshot = Record<SteamId, Library>;

export interface DetectedGame {
  appid: AppId;
  name: string;
  recipientSteamIds: SteamId[];
}

export type Attribution =
  | { kind: "shared"; sourceName: string }
  | { kind: "purchased"; buyerSteamId: SteamId }
  | { kind: "ambiguous" };
