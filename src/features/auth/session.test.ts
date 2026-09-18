import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("./data/auth", () => ({ getAuth: () => ({ api: { getSession } }) }));

const { getCurrentUser } = await import("./session");

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("getCurrentUser", () => {
  it("gives the signed-in user with a numeric id", async () => {
    getSession.mockResolvedValue({
      user: { id: "42", email: "anna@example.com" },
      session: {},
    });

    expect(await getCurrentUser()).toEqual({
      id: 42,
      email: "anna@example.com",
    });
  });

  it("gives null without a session", async () => {
    getSession.mockResolvedValue(null);

    expect(await getCurrentUser()).toBeNull();
  });

  it("fails without the session token when the database does not answer", async () => {
    vi.stubEnv("LOG_LEVEL", "debug");
    const lines: string[] = [];
    vi.spyOn(console, "error").mockImplementation((line: unknown) => {
      lines.push(String(line));
    });
    // Like Drizzle's errors: the query params are in the message.
    getSession.mockRejectedValue(
      new Error('Failed query: select ... where "token" = $1 params: tok123', {
        cause: new Error("connect ECONNREFUSED"),
      }),
    );

    const failure = await getCurrentUser().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect(String(failure)).not.toContain("tok123");
    expect((failure as Error).cause).toBeUndefined();
    const output = lines.join("\n");
    expect(output).toContain("session.check_failed");
    expect(output).not.toContain("tok123");
  });
});
