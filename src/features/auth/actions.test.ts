import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const signOut = vi.fn();
const requestHeaders = new Headers({ cookie: "better-auth.session_token=x" });
vi.mock("next/headers", () => ({ headers: vi.fn(async () => requestHeaders) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("./data/auth", () => ({ getAuth: () => ({ api: { signOut } }) }));
vi.mock("./session", () => ({ getCurrentUser: vi.fn() }));

const { redirect } = await import("next/navigation");
const { getCurrentUser } = await import("./session");
const { logout } = await import("./actions");

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("logout action", () => {
  it("ends the session and goes to the login screen", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 42,
      email: "anna@example.com",
    });
    signOut.mockResolvedValue({ success: true });

    await logout();

    expect(signOut).toHaveBeenCalledWith({ headers: requestHeaders });
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("logs the user id, never the address", async () => {
    vi.stubEnv("LOG_LEVEL", "info");
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((line: unknown) => {
      lines.push(String(line));
    });
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 42,
      email: "anna@example.com",
    });
    signOut.mockResolvedValue({ success: true });

    await logout();

    const output = lines.join("\n");
    expect(output).toContain("session.ended userId=42");
    expect(output).not.toContain("anna@example.com");
  });
});
