import { afterEach, describe, expect, it, vi } from "vitest";
import { databaseUrl } from "./client";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("databaseUrl", () => {
  it("points to the Postgres from docker-compose.yml by default", () => {
    vi.stubEnv("CRM_DATABASE_URL", undefined);

    expect(databaseUrl()).toBe("postgres://postgres@localhost:5433/crm");
  });

  it("takes another database from CRM_DATABASE_URL", () => {
    vi.stubEnv(
      "CRM_DATABASE_URL",
      "postgres://postgres@localhost:5433/crm_e2e",
    );

    expect(databaseUrl()).toBe("postgres://postgres@localhost:5433/crm_e2e");
  });
});
