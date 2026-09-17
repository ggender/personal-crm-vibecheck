// The only home for Russian plurals and human-readable formatting.

type PluralForms = readonly [one: string, few: string, many: string];

const pluralRules = new Intl.PluralRules("ru-RU");

export function pluralize(count: number, forms: PluralForms): string {
  const rule = pluralRules.select(count);
  if (rule === "one") {
    return forms[0];
  }
  return rule === "few" ? forms[1] : forms[2];
}

const CONTACT_FORMS: PluralForms = ["контакт", "контакта", "контактов"];

export function formatContactCount(count: number): string {
  return `${count} ${pluralize(count, CONTACT_FORMS)}`;
}

export function formatFoundCount(found: number, total: number): string {
  return `Найдено ${found} из ${total}`;
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? "")
    .join("")
    .toUpperCase();
}
