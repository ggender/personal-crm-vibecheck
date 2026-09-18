// The only home for the Better Auth setup (specs/05-вход-и-пользователи.md).
// It lives in data/ because it talks to the database.
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { log } from "@/lib/log";
import { sendLoginEmail } from "../login-email";
import { LOGIN_LINK_MINUTES } from "../validation";

function createAuth() {
  return betterAuth({
    // Login links in letters are built from it.
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    // BETTER_AUTH_SECRET comes from the environment. Without it Better Auth
    // uses its own development key and refuses to run a production build.
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema,
      usePlural: true,
    }),
    // Numeric ids, like contacts: owner_id points at users.id.
    advanced: { database: { generateId: "serial" } },
    // Better Auth's texts are not written: the rule is ids and lengths only.
    // Errors are described by their innermost cause, like everywhere else.
    logger: {
      log: (level, _message, ...args) => {
        const event = `better_auth.${level}`;
        if (level === "error") {
          log.error(
            "auth",
            event,
            args.find((arg) => arg instanceof Error),
          );
        } else {
          log[level]("auth", event);
        }
      },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            log.info("auth", "user.created", { userId: Number(user.id) });
          },
        },
      },
      session: {
        create: {
          after: async (session) => {
            log.info("auth", "session.created", {
              userId: Number(session.userId),
            });
          },
        },
      },
    },
    plugins: [
      magicLink({
        expiresIn: LOGIN_LINK_MINUTES * 60,
        // The database keeps only a hash of the token.
        storeToken: "hashed",
        sendMagicLink: ({ email, url }) => sendLoginEmail(email, url),
      }),
      // Lets Server Actions (sign out) set cookies; must stay last.
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

// Created on first use, not on import: `next build` loads this module, and
// a production build without BETTER_AUTH_SECRET would fail to start Better
// Auth. Next.js reloads modules in development: keep one per process.
const globalForAuth = globalThis as typeof globalThis & { crmAuth?: Auth };

export function getAuth(): Auth {
  globalForAuth.crmAuth ??= createAuth();
  return globalForAuth.crmAuth;
}
