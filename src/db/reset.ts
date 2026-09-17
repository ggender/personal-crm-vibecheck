// First step of npm run db:reset: deletes the database file.
// The npm script then runs db:migrate and db:seed.
import fs from "node:fs";
import { log } from "@/lib/log";
import { databasePath } from "./client";

const filePath = databasePath();
for (const suffix of ["", "-wal", "-shm"]) {
  fs.rmSync(`${filePath}${suffix}`, { force: true });
}
log.info("seed", "db.reset");
console.log(`Старая база удалена: ${filePath}`);
console.log(
  "Если приложение запущено, перезапусти его, когда база соберётся (Ctrl+C, затем npm run dev).",
);
