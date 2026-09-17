// The only home for name normalization. SQLite cannot compare Cyrillic
// case-insensitively, so contacts.name_search stores this form and search
// queries are normalized the same way.

export function normalizeName(value: string): string {
  return value
    .normalize("NFC")
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/\s+/g, " ");
}

// Makes %, _ and \ literal inside a LIKE pattern that uses ESCAPE '\'.
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function splitSearchQuery(query: string): string[] {
  const normalized = normalizeName(query);
  return normalized === "" ? [] : normalized.split(" ");
}
