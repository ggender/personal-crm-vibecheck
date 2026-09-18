// The only home for name normalization. contacts.name_search stores this
// form (lower case, ё as е, single spaces) and search queries are normalized
// the same way, so search and sorting never depend on database settings.

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
