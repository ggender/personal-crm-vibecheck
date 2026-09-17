// npm run db:migrate — creates the database file if needed and applies migrations.
import { log } from "@/lib/log";
import { databasePath, openDatabase } from "./client";
import { runMigrations } from "./run-migrations";

const filePath = databasePath();

try {
  const db = openDatabase(filePath, { fileMustExist: false });
  runMigrations(db);
  db.$client.close();
  log.info("db", "db.migrated");
  console.log(`Миграции применены: ${filePath}`);
} catch (error) {
  log.error("db", "db.migrate_failed", error);
  console.error(
    "Не удалось применить миграции. Подробности — в строке ERROR выше.",
  );
  process.exitCode = 1;
}
