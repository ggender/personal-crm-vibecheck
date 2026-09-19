// Migrations applied one by one, the way an existing database gets them.
import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { MIGRATIONS_FOLDER } from "./run-migrations";

type Journal = { entries: { idx: number; tag: string }[] };

function migrationSql(idx: number): string {
  const journal = JSON.parse(
    readFileSync(path.join(MIGRATIONS_FOLDER, "meta/_journal.json"), "utf8"),
  ) as Journal;
  const entry = journal.entries.find((item) => item.idx === idx);
  if (!entry) {
    throw new Error(`No migration with idx ${idx}`);
  }
  return readFileSync(path.join(MIGRATIONS_FOLDER, `${entry.tag}.sql`), "utf8");
}

async function apply(client: PGlite, idx: number): Promise<void> {
  for (const statement of migrationSql(idx).split("--> statement-breakpoint")) {
    await client.exec(statement);
  }
}

// Booting PGlite takes ~1 s, cloning it ~0.15 s: one database at the first
// migration, and every test gets a copy of it.
let template: PGlite;
let client: PGlite;

beforeAll(async () => {
  template = new PGlite();
  await apply(template, 0);
});

beforeEach(async () => {
  // clone() is typed as the PGlite interface but returns a PGlite.
  client = (await template.clone()) as PGlite;
});

afterEach(async () => {
  await client.close();
});

afterAll(async () => {
  await template.close();
});

describe("migration 0001: users and contact owners", () => {
  it("gives the contacts that already exist to demo@example.com", async () => {
    await client.exec(`
      INSERT INTO contacts (name, name_search, created_at, updated_at)
      VALUES ('Анна', 'анна', now(), now()), ('Борис', 'борис', now(), now());
    `);

    await apply(client, 1);

    const users = await client.query<{ id: number; email_verified: boolean }>(
      "SELECT id, email_verified FROM users WHERE email = 'demo@example.com'",
    );
    expect(users.rows).toEqual([
      { id: expect.any(Number), email_verified: true },
    ]);
    const owners = await client.query<{ owner_id: number }>(
      "SELECT DISTINCT owner_id FROM contacts",
    );
    expect(owners.rows).toEqual([{ owner_id: users.rows[0].id }]);
  });

  it("creates no account in an empty database", async () => {
    await apply(client, 1);

    const users = await client.query("SELECT id FROM users");
    expect(users.rows).toEqual([]);
  });
});
