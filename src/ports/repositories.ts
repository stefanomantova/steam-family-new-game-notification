import type { LibrarySnapshot } from "../domain/models.js";
import type { PurchaseStats } from "../domain/stats.js";

export interface StateRepository {
  load(): Promise<LibrarySnapshot>;
  save(state: LibrarySnapshot): Promise<void>;
}

export interface StatsRepository {
  load(): Promise<PurchaseStats>;
  save(stats: PurchaseStats): Promise<void>;
}
