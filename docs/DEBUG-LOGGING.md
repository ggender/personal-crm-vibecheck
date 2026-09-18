# Debug logging

One logger for the whole app: `src/lib/log.ts`. Never call `console.*` directly in app code.

## Line format

```
2026-09-17T12:00:00.000Z INFO  [notes] note.added noteId=12 contactId=3 length=42
```

Time (UTC) · level · `[category]` · event · `key=value` fields · error details (ERROR only).

## Levels

| Level   | When                                                       | Example                               |
| ------- | ---------------------------------------------------------- | ------------------------------------- |
| `DEBUG` | Noisy details useful while chasing a bug. Off by default.  | `contacts.searched resultCount=4`     |
| `INFO`  | A user action changed data, or a script finished a step.   | `contact.created contactId=1000`      |
| `WARN`  | Something expected went wrong and the user got a message.  | `note.rejected issueCount=1`          |
| `ERROR` | Something unexpected failed. Always pass the caught error. | `note.add_failed contactId=3` + error |

Threshold: environment variable `LOG_LEVEL` (`debug`, `info`, `warn`, `error`, `silent`), default `info`.
Example: `LOG_LEVEL=debug npm run dev`. Tests run with `silent`.

## Categories

| Category   | What                                                             |
| ---------- | ---------------------------------------------------------------- |
| `contacts` | list, search, create, update, delete contacts, mark talked       |
| `notes`    | add and delete notes                                             |
| `db`       | connections, creating the database, migrations, page load errors |
| `seed`     | seed and reset scripts                                           |

## Events

Name events `<thing>.<what_happened>` in past tense, snake_case after the dot:
`contact.created`, `contact.updated`, `contact.deleted`, `contact.talked`, `note.added`, `note.deleted`,
`note.rejected`, `note.add_failed`, `db.pool_created`, `db.pool_error`, `db.created`, `db.migrated`, `page.load_failed`,
`seed.done`, `seed.skipped`.

What to log:

- every Server Action: `INFO` on success, `WARN` on validation failure, `ERROR` on unexpected failure;
- opening the database and running migrations (`db`);
- seed and reset results (`seed`);
- search at `DEBUG` only (it fires on every pause in typing).

## Privacy rule

Only ids, counts, lengths and durations. **Never** names, `met_context`, phones, emails, note texts or
search queries — log `queryLength`, not the query.

The logger enforces part of this: fields accept only numbers and booleans. Errors are described by their
innermost cause (name, code, message), because wrapping errors from Drizzle put query params (personal
data) into their message.
