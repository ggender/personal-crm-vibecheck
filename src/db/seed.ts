// npm run db:seed — fills an empty database with 999 fictional contacts.
import { log } from "@/lib/log";
import { databasePath, openDatabase, type Db } from "./client";
import { seedDatabase } from "./seed-database";

async function main(): Promise<void> {
  let db: Db;
  try {
    db = openDatabase(databasePath(), { fileMustExist: true });
  } catch (error) {
    log.error("seed", "seed.open_failed", error);
    console.error("Базы ещё нет. Сначала выполни: npm run db:migrate");
    process.exitCode = 1;
    return;
  }

  try {
    const result = await seedDatabase(db);
    if (result.status === "skipped") {
      log.info("seed", "seed.skipped", { contacts: result.contacts });
      console.log("Контакты уже есть, ничего не добавляю.");
    } else {
      log.info("seed", "seed.done", {
        contacts: result.contacts,
        notes: result.notes,
      });
      console.log(
        `Готово. Контактов: ${result.contacts}, заметок: ${result.notes}.`,
      );
    }
  } catch (error) {
    log.error("seed", "seed.failed", error);
    console.error(
      "Не удалось наполнить базу. Если таблиц ещё нет — выполни: npm run db:migrate",
    );
    process.exitCode = 1;
  } finally {
    db.$client.close();
  }
}

void main();
