// The only home for the rules and limits of signing in. The login form checks
// the address before asking for a link; Better Auth checks it again.
import { z } from "zod";

export const EMAIL_MAX_LENGTH = 200;

// How long a login link works (Better Auth's magicLink expiresIn).
export const LOGIN_LINK_MINUTES = 5;

export const loginEmail = z
  .string({ error: "Укажи почту" })
  .trim()
  .toLowerCase()
  .min(1, { error: "Укажи почту" })
  .max(EMAIL_MAX_LENGTH, {
    error: `Почта длиннее ${EMAIL_MAX_LENGTH} знаков — проверь её`,
  })
  .pipe(z.email({ error: "Проверь почту — похоже, в ней опечатка" }));
