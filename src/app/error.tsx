"use client";

// Shown when the screen could not be built — most often Postgres is not
// running or the database is missing. The server has already written an
// ERROR line to the log.
export default function ErrorScreen({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="grid min-h-dvh place-items-center p-8 text-center">
      <div className="max-w-md space-y-4">
        <h1 className="font-heading text-3xl font-semibold">
          Что-то сломалось
        </h1>
        <p className="text-muted-foreground">
          Приложение не смогло открыть базу с контактами. Данные никуда не
          делись — они хранятся в базе Postgres.
        </p>
        <button
          type="button"
          onClick={retry}
          className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Попробовать снова
        </button>
        <p className="text-sm text-muted-foreground">
          Если не помогает: проверь, что запущен Docker Desktop, и выполни{" "}
          <code>docker compose up -d</code>. Посмотри окно, где запущено
          приложение, — там строка со словом ERROR. Если базы ещё нет, собери её
          командой <code>npm run db:reset</code>.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground">
            Код ошибки: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
