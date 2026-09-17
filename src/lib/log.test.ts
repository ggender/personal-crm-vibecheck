import { describe, expect, it } from "vitest";
import { describeError, formatLogLine, isLevelEnabled } from "./log";

const at = new Date("2026-09-17T12:00:00.000Z");

describe("formatLogLine", () => {
  it("prints time, level, category, event and fields in order", () => {
    expect(
      formatLogLine(
        "info",
        "notes",
        "note.added",
        { noteId: 12, length: 42 },
        at,
      ),
    ).toBe(
      "2026-09-17T12:00:00.000Z INFO  [notes] note.added noteId=12 length=42",
    );
  });

  it("skips undefined fields and prints the line without fields", () => {
    expect(formatLogLine("warn", "db", "db.slow", { ms: undefined }, at)).toBe(
      "2026-09-17T12:00:00.000Z WARN  [db] db.slow",
    );
  });

  it("appends error details after the fields", () => {
    const error = Object.assign(new Error("unable to open database file"), {
      name: "SqliteError",
      code: "SQLITE_CANTOPEN",
    });
    expect(
      formatLogLine("error", "db", "db.open_failed", { attempt: 1 }, at, error),
    ).toBe(
      '2026-09-17T12:00:00.000Z ERROR [db] db.open_failed attempt=1 error=SqliteError code=SQLITE_CANTOPEN message="unable to open database file"',
    );
  });
});

describe("describeError", () => {
  it("uses the root cause so query params never reach the log", () => {
    const cause = Object.assign(new Error("FOREIGN KEY constraint failed"), {
      name: "SqliteError",
      code: "SQLITE_CONSTRAINT_FOREIGNKEY",
    });
    const wrapper = new Error(
      "Failed query: insert into notes ... params: Анна Петрова",
      { cause },
    );

    const described = describeError(wrapper);

    expect(described).toBe(
      'error=SqliteError code=SQLITE_CONSTRAINT_FOREIGNKEY message="FOREIGN KEY constraint failed"',
    );
    expect(described).not.toContain("Анна");
  });

  it("handles values that are not errors", () => {
    expect(describeError("boom")).toBe("error=unknown");
  });
});

describe("isLevelEnabled", () => {
  it("lets through the threshold level and louder ones", () => {
    expect(isLevelEnabled("info", "info")).toBe(true);
    expect(isLevelEnabled("error", "info")).toBe(true);
    expect(isLevelEnabled("debug", "info")).toBe(false);
  });

  it("silences everything at the silent threshold", () => {
    expect(isLevelEnabled("error", "silent")).toBe(false);
  });
});
