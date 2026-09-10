import type { LibrarySnapshot } from "../domain/models.js";
import type { PurchaseStats } from "../domain/stats.js";
import type { StateRepository, StatsRepository } from "../ports/repositories.js";
import { readJsonFile, writeJsonFile } from "./json-file.js";

export class JsonStateRepository implements StateRepository {
  public constructor(private readonly path: string) {}

  public load(): Promise<LibrarySnapshot> {
    return readJsonFile(this.path, {});
  }

  public save(state: LibrarySnapshot): Promise<void> {
    return writeJsonFile(this.path, state);
  }
}

export class JsonStatsRepository implements StatsRepository {
  public constructor(private readonly path: string) {}

  public load(): Promise<PurchaseStats> {
    return readJsonFile(this.path, { currency: null, members: {} });
  }

  public save(stats: PurchaseStats): Promise<void> {
    return writeJsonFile(this.path, stats);
  }
}
