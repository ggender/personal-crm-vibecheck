// Test helper: a fresh in-memory database with all migrations applied.
import { openDatabase, type Db } from "./client";
import { runMigrations } from "./run-migrations";

export function createTestDb(): Db {
  const db = openDatabase(":memory:", { fileMustExist: false });
  runMigrations(db);
  return db;
}
