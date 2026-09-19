"use client";

import { Button } from "@/components/ui/button";

// Shown by a page instead of itself while the database lacks migrations of
// this code.
export function DatabaseOutdated() {
  return (
    <main className="grid min-h-dvh place-items-center p-8 text-center">
      <div className="max-w-md space-y-4">
        <h1 className="font-heading text-3xl font-semibold">База устарела</h1>
        <p className="text-muted-foreground">
          Приложение обновилось, а база с контактами — ещё нет: в ней не хватает
          того, что нужно новой версии. Данные на месте.
        </p>
        <p>
          Выполни в папке проекта команду <code>npm run db:migrate</code> и
          проверь снова. Команда только добавит недостающее — контакты и заметки
          не пропадут.
        </p>
        {/* A full reload asks the page again, the check included. */}
        <Button
          size="lg"
          className="px-4"
          onClick={() => window.location.reload()}
        >
          Проверить снова
        </Button>
      </div>
    </main>
  );
}
