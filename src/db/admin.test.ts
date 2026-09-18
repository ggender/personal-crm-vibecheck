import { describe, expect, it } from "vitest";
import { databaseName, hintFor, maintenanceUrl } from "./admin";

function errorWithCode(code: string): Error {
  return Object.assign(new Error("driver error"), { code });
}

// Drizzle wraps driver errors, so the code sits one level down.
function wrapped(cause: Error): Error {
  return new Error("Failed query: select 1", { cause });
}

describe("databaseName", () => {
  it("reads the database from the address", () => {
    expect(databaseName("postgres://postgres@localhost:5433/crm")).toBe("crm");
    expect(
      databaseName("postgres://user:secret@db.example.com/crm_e2e?ssl=true"),
    ).toBe("crm_e2e");
  });

  it("refuses an address without a database", () => {
    expect(() => databaseName("postgres://postgres@localhost:5433")).toThrow();
  });
});

describe("maintenanceUrl", () => {
  it("keeps the server and the user but switches to the postgres database", () => {
    expect(maintenanceUrl("postgres://postgres@localhost:5433/crm_e2e")).toBe(
      "postgres://postgres@localhost:5433/postgres",
    );
    expect(
      maintenanceUrl("postgres://user:secret@db.example.com/crm?ssl=true"),
    ).toBe("postgres://user:secret@db.example.com/postgres?ssl=true");
  });
});

describe("hintFor", () => {
  it("asks to start Docker when Postgres does not answer", () => {
    expect(hintFor(wrapped(errorWithCode("ECONNREFUSED")))).toBe(
      "Postgres не отвечает. Запусти Docker Desktop, затем выполни: docker compose up -d",
    );
  });

  it("asks to migrate when the database or its tables are missing", () => {
    const hint = "Базы ещё нет. Сначала выполни: npm run db:migrate";
    expect(hintFor(wrapped(errorWithCode("3D000")))).toBe(hint);
    expect(hintFor(wrapped(errorWithCode("42P01")))).toBe(hint);
  });

  it("has nothing to say about other errors", () => {
    expect(hintFor(wrapped(errorWithCode("23503")))).toBeNull();
    expect(hintFor(new Error("boom"))).toBeNull();
    expect(hintFor("boom")).toBeNull();
  });
});
