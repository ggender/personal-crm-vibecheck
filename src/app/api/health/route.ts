// Smoke check after a deploy: the app is up, reaches its database and the
// database has every migration of this code. Answers without a session.
import { countPendingMigrations } from "@/features/database/data/migration-status";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const pending = await countPendingMigrations();
    if (pending > 0) {
      log.warn("db", "health.migrations_pending", { pending });
      return Response.json(
        { status: "migrations_pending", pending },
        { status: 503 },
      );
    }
    return Response.json({ status: "ok" });
  } catch (error) {
    log.error("db", "health.db_unreachable", error);
    return Response.json({ status: "db_unreachable" }, { status: 503 });
  }
}
