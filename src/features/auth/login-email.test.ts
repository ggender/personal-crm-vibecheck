import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMail = vi.fn();
vi.mock("nodemailer", () => ({
  default: { createTransport: vi.fn(() => ({ sendMail })) },
}));

const nodemailer = (await import("nodemailer")).default;
const { buildLoginEmail, sendLoginEmail } = await import("./login-email");

const url =
  "http://localhost:3000/api/auth/magic-link/verify?token=abc&callbackURL=%2F";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("buildLoginEmail", () => {
  it("names the app, carries the link and says how long it works", () => {
    const email = buildLoginEmail(url);

    expect(email.subject).toBe("Вход в Личную CRM");
    expect(email.text).toContain(url);
    expect(email.text).toContain("действует 5 минут");
    expect(email.html).toContain("действует 5 минут");
  });

  it("puts the link into the HTML version with & escaped", () => {
    expect(buildLoginEmail(url).html).toContain(
      'href="http://localhost:3000/api/auth/magic-link/verify?token=abc&amp;callbackURL=%2F"',
    );
  });
});

describe("sendLoginEmail", () => {
  it("sends the letter through Mailpit unless told otherwise", async () => {
    sendMail.mockResolvedValue({});

    await sendLoginEmail("anna@example.com", url);

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      "smtp://localhost:1025",
    );
    expect(sendMail).toHaveBeenCalledWith({
      from: "Личная CRM <no-reply@localhost>",
      to: "anna@example.com",
      ...buildLoginEmail(url),
    });
  });

  it("uses CRM_SMTP_URL when it is set", async () => {
    vi.stubEnv("CRM_SMTP_URL", "smtp://mail.test:2525");
    sendMail.mockResolvedValue({});

    await sendLoginEmail("anna@example.com", url);

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      "smtp://mail.test:2525",
    );
  });

  it("fails with the SMTP error code only, and logs no address or link", async () => {
    vi.stubEnv("LOG_LEVEL", "debug");
    const lines: string[] = [];
    for (const method of ["log", "warn", "error"] as const) {
      vi.spyOn(console, method).mockImplementation((line: unknown) => {
        lines.push(String(line));
      });
    }
    // Like an SMTP server's answer: the recipient is in the message.
    const smtpError = Object.assign(
      new Error(
        "Can't send mail - all recipients were rejected: anna@example.com",
      ),
      { code: "EENVELOPE", response: "550 anna@example.com: rejected" },
    );
    sendMail.mockRejectedValueOnce(smtpError).mockResolvedValueOnce({});

    const failure = await sendLoginEmail("anna@example.com", url).catch(
      (error: unknown) => error,
    );
    await sendLoginEmail("anna@example.com", url);

    expect(failure).toBeInstanceOf(Error);
    expect(failure).toMatchObject({ code: "EENVELOPE" });
    expect(JSON.stringify(failure)).not.toContain("anna@example.com");
    expect((failure as Error).message).not.toContain("anna@example.com");
    expect((failure as Error).cause).toBeUndefined();

    const output = lines.join("\n");
    expect(output).toContain("login_link.send_failed");
    expect(output).toContain("code=EENVELOPE");
    expect(output).toContain("login_link.sent");
    expect(output).not.toContain("anna@example.com");
    expect(output).not.toContain("token=");
  });
});
