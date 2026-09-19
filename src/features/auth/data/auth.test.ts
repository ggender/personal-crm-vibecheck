import { afterEach, describe, expect, it, vi } from "vitest";

// The Better Auth setup is built on first use and talks to the database only
// on a query, so its logger can be exercised without Postgres.
const { getAuth } = await import("./auth");

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

// Every level of the log ends up on the console: errors, warnings and the rest.
function captureLog(): string[] {
  vi.stubEnv("LOG_LEVEL", "debug");
  const lines: string[] = [];
  const keep = (line: unknown) => {
    lines.push(String(line));
  };
  vi.spyOn(console, "error").mockImplementation(keep);
  vi.spyOn(console, "warn").mockImplementation(keep);
  vi.spyOn(console, "log").mockImplementation(keep);
  return lines;
}

describe("Better Auth logger", () => {
  it("writes the level and the event only, never the library's own text", () => {
    const lines = captureLog();
    const logger = getAuth().options.logger!;

    logger.log!("warn", "Magic link for anna@example.com was not sent");
    logger.log!("info", "Session created for anna@example.com");

    const output = lines.join("\n");
    expect(output).toContain("better_auth.warn");
    expect(output).toContain("better_auth.info");
    expect(output).not.toContain("anna@example.com");
  });

  it("describes an error by its root cause, without the query params", () => {
    const lines = captureLog();
    const logger = getAuth().options.logger!;

    logger.log!(
      "error",
      "Failed query: select ... params: tok123",
      new Error('Failed query: select ... where "token" = $1 params: tok123', {
        cause: new Error("connect ECONNREFUSED"),
      }),
    );

    const output = lines.join("\n");
    expect(output).toContain("better_auth.error");
    expect(output).toContain("ECONNREFUSED");
    expect(output).not.toContain("tok123");
  });
});
