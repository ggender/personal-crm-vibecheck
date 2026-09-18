// Chores on the database as a whole, for the db:* scripts only.
import { sql } from "drizzle-orm";
import { openDatabase, type ServerDb } from "./client";

// "crm" in postgres://postgres@localhost:5433/crm
export function databaseName(url: string): string {
  const name = decodeURIComponent(new URL(url).pathname.slice(1));
  if (name === "") {
    throw new Error("The database URL names no database");
  }
  return name;
}

// The same server's built-in "postgres" database: other databases are
// created and dropped from there.
export function maintenanceUrl(url: string): string {
  const parsed = new URL(url);
  parsed.pathname = "/postgres";
  return parsed.toString();
}

async function onServer<T>(
  url: string,
  work: (server: ServerDb) => Promise<T>,
): Promise<T> {
  const server = openDatabase(maintenanceUrl(url));
  try {
    return await work(server);
  } finally {
    await server.$client.end();
  }
}

// Returns true when the database had to be created.
export async function createDatabaseIfMissing(url: string): Promise<boolean> {
  const name = databaseName(url);
  return onServer(url, async (server) => {
    const found = await server.execute(
      sql`select 1 from pg_database where datname = ${name}`,
    );
    if (found.rows.length > 0) {
      return false;
    }
    await server.execute(sql`create database ${sql.identifier(name)}`);
    return true;
  });
}

// WITH (FORCE) closes the connections of a running app; it reconnects
// by itself once the database is back.
export async function dropDatabase(url: string): Promise<void> {
  const name = databaseName(url);
  await onServer(url, (server) =>
    server.execute(
      sql`drop database if exists ${sql.identifier(name)} with (force)`,
    ),
  );
}

// The next step, in plain Russian, for the errors a script is most likely
// to hit. Drizzle wraps driver errors, so the code may sit in a cause.
export function hintFor(error: unknown): string | null {
  let current: unknown = error;
  while (current instanceof Error) {
    const code = (current as { code?: unknown }).code;
    if (code === "ECONNREFUSED") {
      return "Postgres не отвечает. Запусти Docker Desktop, затем выполни: docker compose up -d";
    }
    // invalid_catalog_name: no such database; undefined_table: not migrated.
    if (code === "3D000" || code === "42P01") {
      return "Базы ещё нет. Сначала выполни: npm run db:migrate";
    }
    current = current.cause;
  }
  return null;
}
