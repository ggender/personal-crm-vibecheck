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

const dayMonthFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
});

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Calendar days in this computer's time zone: 00:05 today is "сегодня",
// 23:50 of the day before is "вчера".
export function formatNoteDate(date: Date, now: Date = new Date()): string {
  if (isSameDay(date, now)) {
    return "сегодня";
  }
  const yesterday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1,
  );
  if (isSameDay(date, yesterday)) {
    return "вчера";
  }
  const dayMonth = dayMonthFormat.format(date);
  return date.getFullYear() === now.getFullYear()
    ? dayMonth
    : `${dayMonth} ${date.getFullYear()}`;
}

export function formatTodayLabel(now: Date = new Date()): string {
  return `сегодня, ${dayMonthFormat.format(now)}`;
}
