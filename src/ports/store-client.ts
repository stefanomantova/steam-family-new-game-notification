import type { AppId } from "../domain/models.js";
import type { PriceResult } from "../domain/pricing.js";

export interface GameDetails {
  price: PriceResult;
  isFamilyShareable: boolean;
}

export interface StoreClient {
  fetchGameDetails(appid: AppId, gameName: string, countryCode: string): Promise<GameDetails>;
  fetchGameName(appid: AppId, countryCode: string): Promise<string>;
}
