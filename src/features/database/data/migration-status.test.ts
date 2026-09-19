import { afterEach, beforeEach, describe, expect, it } from "vitest";
import journal from "@/db/migrations/meta/_journal.json";
import { createTestDb, type TestDb } from "@/db/test-db";
import { countPendingMigrations } from "./migration-status";

let db: TestDb;

beforeEach(async () => {
  db = await createTestDb();
});

afterEach(async () => {
  // One test stops the database itself.
  if (!db.$client.closed) {
    await db.$client.close();
  }
});

describe("countPendingMigrations", () => {
  it("is zero when the database has every migration of the code", async () => {
    expect(await countPendingMigrations(db)).toBe(0);
  });

  it("counts the migrations the database has not had yet", async () => {
    const newest = journal.entries.at(-1)!.when;
    await db.$client.query(
      "DELETE FROM drizzle.__drizzle_migrations WHERE created_at = $1",
      [newest],
    );

    expect(await countPendingMigrations(db)).toBe(1);
  });

  it("counts every migration when the database was never migrated", async () => {
    // Without drizzle-orm's record, as before the first `npm run db:migrate`.
    await db.$client.exec("DROP SCHEMA drizzle CASCADE");

    expect(await countPendingMigrations(db)).toBe(journal.entries.length);
  });

  it("passes on other failures, such as a stopped database", async () => {
    await db.$client.close();

    await expect(countPendingMigrations(db)).rejects.toThrow();
  });
});
