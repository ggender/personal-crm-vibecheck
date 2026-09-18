// First step of npm run db:reset: drops the database.
// The npm script then runs db:migrate (creates it again) and db:seed.
import { log } from "@/lib/log";
import { databaseName, dropDatabase, hintFor } from "./admin";
import { databaseUrl } from "./client";

async function main(): Promise<void> {
  const url = databaseUrl();
  try {
    await dropDatabase(url);
    log.info("seed", "db.reset");
    console.log(`Старая база удалена: ${databaseName(url)}`);
  } catch (error) {
    log.error("seed", "db.reset_failed", error);
    console.error(
      hintFor(error) ??
        "Не удалось удалить базу. Подробности — в строке ERROR выше.",
    );
    process.exitCode = 1;
  }
}

void main();
