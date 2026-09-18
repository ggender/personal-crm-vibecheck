import { describe, expect, it } from "vitest";
import {
  calendarDaysBetween,
  deleteContactQuestion,
  deleteNoteQuestion,
  formatContactCount,
  formatDayCount,
  formatFoundCount,
  formatKeepInTouch,
  formatKeepInTouchStatus,
  formatNoteCount,
  formatNoteDate,
  formatTodayLabel,
  initials,
} from "./format";
import { KEEP_IN_TOUCH_DAYS } from "./validation";

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

describe("calendarDaysBetween", () => {
  it("counts calendar days in local time, not 24-hour periods", () => {
    const now = new Date(2026, 8, 18, 0, 10);
    expect(calendarDaysBetween(new Date(2026, 8, 18, 0, 5), now)).toBe(0);
    expect(calendarDaysBetween(new Date(2026, 8, 17, 23, 50), now)).toBe(1);
    expect(calendarDaysBetween(new Date(2026, 7, 19, 12, 0), now)).toBe(30);
  });

  it("handles the turn of the year and a date in the future", () => {
    expect(
      calendarDaysBetween(
        new Date(2026, 11, 31, 22, 0),
        new Date(2027, 0, 1, 9, 0),
      ),
    ).toBe(1);
    expect(
      calendarDaysBetween(
        new Date(2026, 8, 20, 9, 0),
        new Date(2026, 8, 18, 9, 0),
      ),
    ).toBe(-2);
  });
});

describe("formatDayCount", () => {
  it.each([
    [0, "0 дней"],
    [1, "1 день"],
    [2, "2 дня"],
    [5, "5 дней"],
    [11, "11 дней"],
    [21, "21 день"],
    [45, "45 дней"],
  ])("%i → %s", (count, text) => {
    expect(formatDayCount(count)).toBe(text);
  });
});

describe("formatKeepInTouch", () => {
  it.each([
    [null, "Не следить"],
    [14, "Раз в 2 недели"],
    [30, "Раз в месяц"],
    [90, "Раз в 3 месяца"],
    [180, "Раз в полгода"],
    [365, "Раз в год"],
  ])("%s → %s", (days, text) => {
    expect(formatKeepInTouch(days)).toBe(text);
  });

  it("has a name for every rhythm in the form", () => {
    for (const days of KEEP_IN_TOUCH_DAYS) {
      expect(formatKeepInTouch(days)).not.toMatch(/\d+ д/);
    }
  });

  it("still reads well for a rhythm outside the list", () => {
    expect(formatKeepInTouch(45)).toBe("Раз в 45 дней");
  });
});

describe("formatKeepInTouchStatus", () => {
  it("says it is time to write and how long it has been", () => {
    expect(
      formatKeepInTouchStatus({
        days: 30,
        daysSince: 45,
        daysLeft: 0,
        isDue: true,
      }),
    ).toBe("Раз в месяц · пора написать: 45 дней без общения");
  });

  it("says when the next time comes", () => {
    expect(
      formatKeepInTouchStatus({
        days: 30,
        daysSince: 12,
        daysLeft: 18,
        isDue: false,
      }),
    ).toBe("Раз в месяц · следующий раз через 18 дней");
    expect(
      formatKeepInTouchStatus({
        days: 14,
        daysSince: 13,
        daysLeft: 1,
        isDue: false,
      }),
    ).toBe("Раз в 2 недели · следующий раз через 1 день");
  });
});
