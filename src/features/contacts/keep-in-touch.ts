// Keep-in-touch rules: when it is time to write to a contact again.
// Spec: specs/04-keep-in-touch.md.
import { calendarDaysBetween } from "./format";

export type TalkTimes = {
  createdAt: Date;
  // Last press of «Пообщались».
  talkedAt: Date | null;
  lastNoteAt: Date | null;
};

export type KeepInTouchState = {
  days: number;
  daysSince: number;
  daysLeft: number;
  isDue: boolean;
};

// A note and «Пообщались» both count as talking. Without either, the clock
// starts on the day the contact was added.
export function lastTalkAt({
  createdAt,
  talkedAt,
  lastNoteAt,
}: TalkTimes): Date {
  const talks = [talkedAt, lastNoteAt].filter((date) => date !== null);
  if (talks.length === 0) {
    return createdAt;
  }
  return new Date(Math.max(...talks.map((date) => date.getTime())));
}

export function keepInTouchState(
  days: number,
  lastTalk: Date,
  now: Date,
): KeepInTouchState {
  const daysSince = Math.max(0, calendarDaysBetween(lastTalk, now));
  return {
    days,
    daysSince,
    daysLeft: Math.max(0, days - daysSince),
    isDue: daysSince >= days,
  };
}

// Due contacts only, the longest without talking first, so the order matches
// the days the list shows. Ties keep the incoming (alphabetical) order.
export function selectDue<T extends TalkTimes & { keepInTouchDays: number }>(
  items: T[],
  now: Date,
): (T & { daysSinceTalk: number })[] {
  return items
    .map((item) => ({
      item,
      state: keepInTouchState(item.keepInTouchDays, lastTalkAt(item), now),
    }))
    .filter(({ state }) => state.isDue)
    .sort((a, b) => b.state.daysSince - a.state.daysSince)
    .map(({ item, state }) => ({ ...item, daysSinceTalk: state.daysSince }));
}
