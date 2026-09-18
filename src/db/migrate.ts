// npm run db:migrate — creates the database if needed and applies migrations.
import { log } from "@/lib/log";
import { createDatabaseIfMissing, databaseName, hintFor } from "./admin";
import { databaseUrl, openDatabase } from "./client";
import { runMigrations } from "./run-migrations";

async function main(): Promise<void> {
  const url = databaseUrl();
  try {
    if (await createDatabaseIfMissing(url)) {
      log.info("db", "db.created");
    }
    const db = openDatabase(url);
    try {
      await runMigrations(db);
    } finally {
      await db.$client.end();
    }
    log.info("db", "db.migrated");
    console.log(`Миграции применены: база ${databaseName(url)}`);
  } catch (error) {
    log.error("db", "db.migrate_failed", error);
    console.error(
      hintFor(error) ??
        "Не удалось применить миграции. Подробности — в строке ERROR выше.",
    );
    process.exitCode = 1;
  }
}

void main();
