// Whether the database lags behind this code, e.g. after an update that
// brought a new migration. Pages ask first and do not run then: their queries
// would fail on tables or columns the database does not have yet. (Not in the
// root layout: a layout does not stop the page under it from running.)
import { log } from "@/lib/log";
import { countPendingMigrations } from "./data/migration-status";

export async function isDatabaseOutdated(): Promise<boolean> {
  try {
    const pendingCount = await countPendingMigrations();
    if (pendingCount > 0) {
      log.warn("db", "db.outdated", { pendingCount });
      return true;
    }
    return false;
  } catch {
    // Postgres cannot be asked at all (stopped, no database): the page fails
    // with its own message and ERROR line.
    return false;
  }
}
