import { describe, expect, it } from "vitest";
import { formatContactCount, formatFoundCount, initials } from "./format";

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
