import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import {
  drizzle,
  type BetterSQLite3Database,
} from "drizzle-orm/better-sqlite3";
import { log } from "@/lib/log";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema> & {
  $client: Database.Database;
};

export function databasePath(): string {
  return path.resolve(process.env.CRM_DB_PATH ?? "data/crm.db");
}

type OpenOptions = {
  // The app never creates the file: a missing database must be an error,
  // not a silently empty one. Scripts create it.
  fileMustExist: boolean;
};

export function openDatabase(filePath: string, options: OpenOptions): Db {
  const inMemory = filePath === ":memory:";
  if (!inMemory && !options.fileMustExist) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  const sqlite = new Database(filePath, {
    fileMustExist: !inMemory && options.fileMustExist,
  });
  sqlite.pragma("journal_mode = WAL");
  // SQLite ignores ON DELETE CASCADE unless this is on for the connection.
  sqlite.pragma("foreign_keys = ON");
  return drizzle({ client: sqlite, schema });
}

// Next.js reloads modules in development; keep one connection per process.
const globalForDb = globalThis as typeof globalThis & { crmDb?: Db };

export function getDb(): Db {
  if (!globalForDb.crmDb) {
    try {
      globalForDb.crmDb = openDatabase(databasePath(), {
        fileMustExist: true,
      });
    } catch (error) {
      log.error("db", "db.open_failed", error);
      throw error;
    }
    log.info("db", "db.opened");
  }
  return globalForDb.crmDb;
}
