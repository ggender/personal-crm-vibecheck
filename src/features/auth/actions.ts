"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { log } from "@/lib/log";
import { getAuth } from "./data/auth";
import { getCurrentUser } from "./session";

// Asking for a login link goes straight to Better Auth from the login form
// (authClient.signIn.magicLink), so its rate limit applies.

export async function logout(): Promise<void> {
  const user = await getCurrentUser();
  await getAuth().api.signOut({ headers: await headers() });
  log.info("auth", "session.ended", { userId: user?.id });
  redirect("/login");
}
