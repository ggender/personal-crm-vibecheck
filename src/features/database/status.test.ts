import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./data/migration-status", () => ({
  countPendingMigrations: vi.fn(),
}));

const { countPendingMigrations } = await import("./data/migration-status");
const { isDatabaseOutdated } = await import("./status");

let lines: string[];

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("LOG_LEVEL", "info");
  lines = [];
  for (const method of ["log", "warn", "error"] as const) {
    vi.spyOn(console, method).mockImplementation((line: unknown) => {
      lines.push(String(line));
    });
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("isDatabaseOutdated", () => {
  it("says yes and leaves a WARN line when migrations are pending", async () => {
    vi.mocked(countPendingMigrations).mockResolvedValue(1);

    expect(await isDatabaseOutdated()).toBe(true);
    expect(lines.join("\n")).toMatch(
      /WARN .*\[db\] db\.outdated pendingCount=1/,
    );
  });

  it("says no when every migration is applied", async () => {
    vi.mocked(countPendingMigrations).mockResolvedValue(0);

    expect(await isDatabaseOutdated()).toBe(false);
    expect(lines).toEqual([]);
  });

  it("says no when Postgres cannot be asked, so the page shows its own error", async () => {
    vi.mocked(countPendingMigrations).mockRejectedValue(
      new Error("connect ECONNREFUSED"),
    );

    expect(await isDatabaseOutdated()).toBe(false);
  });
});
