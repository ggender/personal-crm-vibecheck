import { describe, expect, it } from "vitest";
import { escapeLike, normalizeName, splitSearchQuery } from "./normalize-name";

describe("normalizeName", () => {
  it("lowercases Cyrillic", () => {
    expect(normalizeName("Анна")).toBe("анна");
    expect(normalizeName("ЁЛКИН")).toBe("елкин");
  });

  it("trims edges and replaces ё with е", () => {
    expect(normalizeName("  Семён  ")).toBe("семен");
  });

  it("keeps hyphens", () => {
    expect(normalizeName("Анна-Мария")).toBe("анна-мария");
  });

  it("collapses inner whitespace of any kind", () => {
    expect(normalizeName("Анна   Петрова")).toBe("анна петрова");
    expect(normalizeName("Анна\t\nПетрова")).toBe("анна петрова");
  });

  it("treats a decomposed ё (е + combining diaeresis) like ё", () => {
    expect(normalizeName("Сёмен")).toBe("семен");
  });

  it("keeps й", () => {
    expect(normalizeName("Андрей")).toBe("андрей");
  });
});

describe("escapeLike", () => {
  it("escapes LIKE wildcards and the escape character", () => {
    expect(escapeLike("100%")).toBe("100\\%");
    expect(escapeLike("a_b")).toBe("a\\_b");
    expect(escapeLike("a\\b")).toBe("a\\\\b");
  });

  it("leaves ordinary text alone", () => {
    expect(escapeLike("анна-мария")).toBe("анна-мария");
  });
});

describe("splitSearchQuery", () => {
  it("normalizes and splits the query into words", () => {
    expect(splitSearchQuery("  Анна   Пёт ")).toEqual(["анна", "пет"]);
  });

  it("returns no words for an empty or blank query", () => {
    expect(splitSearchQuery("")).toEqual([]);
    expect(splitSearchQuery("   ")).toEqual([]);
  });
});
