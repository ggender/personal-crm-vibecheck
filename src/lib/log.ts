// Small logger. Rules: docs/DEBUG-LOGGING.md.
// Fields accept only numbers and booleans, so names, phones, emails
// and note texts cannot be logged by accident.

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogThreshold = LogLevel | "silent";
export type LogCategory = "contacts" | "notes" | "auth" | "db" | "seed";
export type LogFields = Record<string, number | boolean | null | undefined>;

const LEVEL_RANK: Record<LogThreshold, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

export function isLevelEnabled(
  level: LogLevel,
  threshold: LogThreshold,
): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[threshold];
}

function rootCause(error: Error): Error {
  let current = error;
  while (current.cause instanceof Error) {
    current = current.cause;
  }
  return current;
}

// Wrapping errors (e.g. Drizzle's) put query params into the message,
// so only the innermost error is described.
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "error=unknown";
  }
  const cause = rootCause(error);
  const code = (cause as { code?: unknown }).code;
  const parts = [`error=${cause.name}`];
  if (typeof code === "string") {
    parts.push(`code=${code}`);
  }
  parts.push(`message=${JSON.stringify(cause.message)}`);
  return parts.join(" ");
}

export function formatLogLine(
  level: LogLevel,
  category: LogCategory,
  event: string,
  fields: LogFields = {},
  now: Date = new Date(),
  error?: unknown,
): string {
  const parts = [
    now.toISOString(),
    level.toUpperCase().padEnd(5),
    `[${category}]`,
    event,
  ];
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      parts.push(`${key}=${value}`);
    }
  }
  if (error !== undefined) {
    parts.push(describeError(error));
  }
  return parts.join(" ");
}

function currentThreshold(): LogThreshold {
  const value = process.env.LOG_LEVEL;
  return value !== undefined && value in LEVEL_RANK
    ? (value as LogThreshold)
    : "info";
}

function write(
  level: LogLevel,
  category: LogCategory,
  event: string,
  fields?: LogFields,
  error?: unknown,
): void {
  if (!isLevelEnabled(level, currentThreshold())) {
    return;
  }
  const line = formatLogLine(level, category, event, fields, new Date(), error);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const log = {
  debug: (category: LogCategory, event: string, fields?: LogFields) =>
    write("debug", category, event, fields),
  info: (category: LogCategory, event: string, fields?: LogFields) =>
    write("info", category, event, fields),
  warn: (category: LogCategory, event: string, fields?: LogFields) =>
    write("warn", category, event, fields),
  error: (
    category: LogCategory,
    event: string,
    error: unknown,
    fields?: LogFields,
  ) => write("error", category, event, fields, error),
};
