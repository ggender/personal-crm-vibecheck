import { describe, expect, it } from "vitest";
import {
  deleteContactQuestion,
  deleteNoteQuestion,
  formatContactCount,
  formatFoundCount,
  formatNoteCount,
  formatNoteDate,
  formatTodayLabel,
  initials,
} from "./format";

describe("formatContactCount", () => {
  it.each([
    [0, "0 контактов"],
    [1, "1 контакт"],
    [2, "2 контакта"],
    [4, "4 контакта"],
    [5, "5 контактов"],
    [11, "11 контактов"],
    [14, "14 контактов"],
    [21, "21 контакт"],
    [22, "22 контакта"],
    [111, "111 контактов"],
    [999, "999 контактов"],
    [1000, "1000 контактов"],
    [1001, "1001 контакт"],
  ])("%i → %s", (count, text) => {
    expect(formatContactCount(count)).toBe(text);
  });
});

describe("formatFoundCount", () => {
  it("shows found out of total", () => {
    expect(formatFoundCount(4, 999)).toBe("Найдено 4 из 999");
  });
});

describe("initials", () => {
  it("takes the first letters of the first two words", () => {
    expect(initials("Анна Петрова")).toBe("АП");
    expect(initials("анна-мария лебедева-орлова")).toBe("АЛ");
    expect(initials("  Ёжик  ")).toBe("Ё");
    expect(initials("Жан Поль Сартр")).toBe("ЖП");
  });

  it("does not break emoji and handles an empty name", () => {
    expect(initials("🙂 Смайлик")).toBe("🙂С");
    expect(initials("   ")).toBe("");
  });
});

describe("formatNoteDate", () => {
  // Local time on purpose: "today" is the day on this computer.
  const now = new Date(2026, 8, 17, 0, 30);

  it("says today and yesterday by calendar day, not by 24 hours", () => {
    expect(formatNoteDate(new Date(2026, 8, 17, 0, 5), now)).toBe("сегодня");
    expect(formatNoteDate(new Date(2026, 8, 16, 23, 50), now)).toBe("вчера");
    expect(formatNoteDate(new Date(2026, 8, 16, 0, 1), now)).toBe("вчера");
  });

  it("shows day and month within the current year", () => {
    expect(formatNoteDate(new Date(2026, 8, 3, 12, 0), now)).toBe("3 сентября");
    expect(formatNoteDate(new Date(2026, 0, 1, 12, 0), now)).toBe("1 января");
  });

  it("adds the year for older notes", () => {
    expect(formatNoteDate(new Date(2025, 4, 17, 12, 0), now)).toBe(
      "17 мая 2025",
    );
  });

  it("handles the turn of the year", () => {
    const newYear = new Date(2027, 0, 1, 9, 0);
    expect(formatNoteDate(new Date(2026, 11, 31, 22, 0), newYear)).toBe(
      "вчера",
    );
    expect(formatNoteDate(new Date(2026, 11, 30, 22, 0), newYear)).toBe(
      "30 декабря 2026",
    );
  });
});

describe("formatTodayLabel", () => {
  it("names today with its date", () => {
    expect(formatTodayLabel(new Date(2026, 8, 17, 15, 0))).toBe(
      "сегодня, 17 сентября",
    );
  });
});

describe("formatNoteCount", () => {
  it.each([
    [1, "1 заметка"],
    [2, "2 заметки"],
    [3, "3 заметки"],
    [5, "5 заметок"],
    [11, "11 заметок"],
    [21, "21 заметка"],
  ])("%i → %s", (count, text) => {
    expect(formatNoteCount(count)).toBe(text);
  });
});

describe("deleteContactQuestion", () => {
  it("names the contact and how many notes go with it", () => {
    expect(deleteContactQuestion("Анна Петрова", 3)).toBe(
      "Удалить контакт «Анна Петрова» и 3 заметки?",
    );
    expect(deleteContactQuestion("Анна Петрова", 1)).toBe(
      "Удалить контакт «Анна Петрова» и 1 заметку?",
    );
  });

  it("asks a short question when there are no notes", () => {
    expect(deleteContactQuestion("Анна Петрова", 0)).toBe(
      "Удалить контакт «Анна Петрова»?",
    );
  });
});

describe("deleteNoteQuestion", () => {
  const now = new Date(2026, 8, 17, 12, 0);

  it("names the note by its date", () => {
    expect(deleteNoteQuestion(new Date(2026, 8, 17, 9, 0), now)).toBe(
      "Удалить сегодняшнюю заметку?",
    );
    expect(deleteNoteQuestion(new Date(2026, 8, 16, 9, 0), now)).toBe(
      "Удалить вчерашнюю заметку?",
    );
    expect(deleteNoteQuestion(new Date(2026, 8, 3, 9, 0), now)).toBe(
      "Удалить заметку от 3 сентября?",
    );
    expect(deleteNoteQuestion(new Date(2025, 4, 17, 9, 0), now)).toBe(
      "Удалить заметку от 17 мая 2025?",
    );
  });
});
