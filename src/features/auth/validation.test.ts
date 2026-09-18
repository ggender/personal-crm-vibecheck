import { describe, expect, it } from "vitest";
import { EMAIL_MAX_LENGTH, LOGIN_LINK_MINUTES, loginEmail } from "./validation";

function messageFor(value: unknown): string | undefined {
  const parsed = loginEmail.safeParse(value);
  return parsed.success ? undefined : parsed.error.issues[0]?.message;
}

describe("loginEmail", () => {
  it("trims the address and stores it in lowercase", () => {
    expect(loginEmail.parse("  Anna.Petrova@Example.COM ")).toBe(
      "anna.petrova@example.com",
    );
  });

  it("asks for an address when there is none", () => {
    expect(messageFor("")).toBe("Укажи почту");
    expect(messageFor("   ")).toBe("Укажи почту");
    expect(messageFor(undefined)).toBe("Укажи почту");
  });

  it("points at a typo", () => {
    for (const typo of ["anna", "anna@", "anna.example.com", "anna@example"]) {
      expect(messageFor(typo)).toBe("Проверь почту — похоже, в ней опечатка");
    }
  });

  it("refuses an address longer than the limit", () => {
    const long = `${"a".repeat(EMAIL_MAX_LENGTH)}@example.com`;
    expect(messageFor(long)).toBe(
      `Почта длиннее ${EMAIL_MAX_LENGTH} знаков — проверь её`,
    );
  });
});

describe("LOGIN_LINK_MINUTES", () => {
  it("is how long a login link works", () => {
    expect(LOGIN_LINK_MINUTES).toBe(5);
  });
});
