// Who is signed in. Pages and Server Actions ask here before touching data.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { log } from "@/lib/log";
import { getAuth } from "./data/auth";

export type CurrentUser = { id: number; email: string };

async function findSession() {
  // Outside the try: during a build Next.js stops here on purpose.
  const requestHeaders = await headers();
  try {
    return await getAuth().api.getSession({ headers: requestHeaders });
  } catch (error) {
    log.error("auth", "session.check_failed", error);
    // Next.js prints what is thrown, and Drizzle's error carries the query
    // params (the session token): callers get an error without them.
    throw new Error("The session could not be checked");
  }
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await findSession();
  if (!session) {
    return null;
  }
  // Better Auth hands numeric ids out as strings.
  return { id: Number(session.user.id), email: session.user.email };
}

// For pages: without a session the visitor goes to the login screen.
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}
