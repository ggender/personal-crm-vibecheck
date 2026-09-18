// npm run db:seed — gives the demo account 999 fictional contacts.
import { log } from "@/lib/log";
import { hintFor } from "./admin";
import { databaseUrl, openDatabase } from "./client";
import { DEMO_EMAIL, seedDatabase } from "./seed-database";

async function main(): Promise<void> {
  const db = openDatabase(databaseUrl());
  try {
    const result = await seedDatabase(db);
    if (result.status === "skipped") {
      log.info("seed", "seed.skipped", { contacts: result.contacts });
      console.log(`У ${DEMO_EMAIL} уже есть контакты, ничего не добавляю.`);
    } else {
      log.info("seed", "seed.done", {
        contacts: result.contacts,
        notes: result.notes,
      });
      console.log(
        `Готово. Контактов: ${result.contacts}, заметок: ${result.notes}. Входи как ${DEMO_EMAIL}.`,
      );
    }
  } catch (error) {
    log.error("seed", "seed.failed", error);
    console.error(
      hintFor(error) ??
        "Не удалось наполнить базу. Подробности — в строке ERROR выше.",
    );
    process.exitCode = 1;
  } finally {
    await db.$client.end();
  }
}

void main();
