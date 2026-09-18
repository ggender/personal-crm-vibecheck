// Better Auth's endpoints: asking for a login link, following it, sessions.
import { getAuth } from "@/features/auth/data/auth";

export function GET(request: Request): Promise<Response> {
  return getAuth().handler(request);
}

export function POST(request: Request): Promise<Response> {
  return getAuth().handler(request);
}
