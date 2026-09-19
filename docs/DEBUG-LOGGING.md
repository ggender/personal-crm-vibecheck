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

| Category   | What                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------- |
| `contacts` | list, search, create, update, delete contacts, mark talked, rhythm and groups from the card |
| `notes`    | add and delete notes                                                                        |
| `groups`   | create, rename and delete groups                                                            |
| `auth`     | login letters, sign-ups, sessions, Better Auth's own messages                               |
| `db`       | connections, creating the database, migrations, page load errors                            |
| `seed`     | seed and reset scripts                                                                      |

## Events

Name events `<thing>.<what_happened>` in past tense, snake_case after the dot:
`contact.created`, `contact.updated`, `contact.deleted`, `contact.talked`, `contact.keep_in_touch_set` (the rhythm chosen
in the card; `keepInTouchDays`), `contact.group_added`, `contact.group_removed` (one group changed in the card), `note.added`, `note.deleted`,
`note.rejected`, `note.add_failed`, `group.created`, `group.renamed`, `group.deleted`, `group.rejected`,
`group.name_taken`, `group.missing`, `group.create_failed`, `db.pool_created`, `db.pool_error`, `db.created`, `db.migrated`, `db.outdated` (the database lacks migrations of the
code; `pendingCount`), `page.load_failed`,
`seed.done`, `seed.skipped`, `login_link.sent`, `login_link.send_failed`, `user.created`, `session.created`,
`session.ended`, `session.missing` (an action came without a session), `session.check_failed`.

Better Auth's own messages arrive as `better_auth.warn` / `better_auth.error`: its texts are not written, an error is
described by its innermost cause.

What to log:

- every Server Action: `INFO` on success, `WARN` on validation failure, `ERROR` on unexpected failure;
- opening the database and running migrations (`db`);
- seed and reset results (`seed`);
- search at `DEBUG` only (it fires on every pause in typing).

## Privacy rule

Only ids, counts, lengths and durations. **Never** names, `met_context`, phones, emails, note texts, group names or
search queries — log `queryLength`, not the query. The same for signing in: **never** the address a letter goes to,
login links, their tokens or session tokens — log `userId`. An SMTP error is logged by its code only (its text often
names the recipient), and the development server does not print requests to `/api/auth/magic-link/verify`
(`next.config.ts`), because the address of a login link carries its token.

The logger enforces part of this: fields accept only numbers and booleans. Errors are described by their
innermost cause (name, code, message), because wrapping errors from Drizzle put query params (personal
data) into their message.
