// The only home for Russian plurals and human-readable formatting.

import type { KeepInTouchState } from "./keep-in-touch";

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
// Accusative, as in «действует 5 минут».
const MINUTE_FORMS: PluralForms = ["минуту", "минуты", "минут"];

export function formatContactCount(count: number): string {
  return `${count} ${pluralize(count, CONTACT_FORMS)}`;
}

export function formatMinuteCount(count: number): string {
  return `${count} ${pluralize(count, MINUTE_FORMS)}`;
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

const DAY_MS = 24 * 60 * 60 * 1000;

// Calendar days in this computer's time zone, like formatNoteDate:
// 23:50 yesterday and 00:10 today are one day apart.
export function calendarDaysBetween(from: Date, to: Date): number {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  // Rounding absorbs the 23- and 25-hour days of daylight saving time.
  return Math.round((end.getTime() - start.getTime()) / DAY_MS);
}

export function formatTodayLabel(now: Date = new Date()): string {
  return `сегодня, ${dayMonthFormat.format(now)}`;
}

const NOTE_FORMS: PluralForms = ["заметка", "заметки", "заметок"];
// Accusative case: «…и 1 заметку?»
const NOTE_FORMS_ACCUSATIVE: PluralForms = ["заметку", "заметки", "заметок"];

export function formatNoteCount(count: number): string {
  return `${count} ${pluralize(count, NOTE_FORMS)}`;
}

export function deleteContactQuestion(name: string, noteCount: number): string {
  if (noteCount === 0) {
    return `Удалить контакт «${name}»?`;
  }
  return `Удалить контакт «${name}» и ${noteCount} ${pluralize(noteCount, NOTE_FORMS_ACCUSATIVE)}?`;
}

export function deleteGroupQuestion(name: string): string {
  return `Удалить группу «${name}»?`;
}

export function deleteNoteQuestion(date: Date, now: Date = new Date()): string {
  const when = formatNoteDate(date, now);
  if (when === "сегодня") {
    return "Удалить сегодняшнюю заметку?";
  }
  if (when === "вчера") {
    return "Удалить вчерашнюю заметку?";
  }
  return `Удалить заметку от ${when}?`;
}

const DAY_FORMS: PluralForms = ["день", "дня", "дней"];

export function formatDayCount(count: number): string {
  return `${count} ${pluralize(count, DAY_FORMS)}`;
}

const KEEP_IN_TOUCH_LABELS: Record<number, string> = {
  14: "Раз в 2 недели",
  30: "Раз в месяц",
  90: "Раз в 3 месяца",
  180: "Раз в полгода",
  365: "Раз в год",
};

export function formatKeepInTouch(days: number | null): string {
  if (days === null) {
    return "Не следить";
  }
  return KEEP_IN_TOUCH_LABELS[days] ?? `Раз в ${formatDayCount(days)}`;
}

// «Раз в месяц · пора написать: 45 дней без общения»
export function formatKeepInTouchStatus(state: KeepInTouchState): string {
  const rhythm = formatKeepInTouch(state.days);
  return state.isDue
    ? `${rhythm} · пора написать: ${formatDayCount(state.daysSince)} без общения`
    : `${rhythm} · следующий раз через ${formatDayCount(state.daysLeft)}`;
}
