import { describe, expect, it } from "vitest";
import { keepInTouchState, lastTalkAt, selectDue } from "./keep-in-touch";

// Local time, like everything the card shows.
const now = new Date(2026, 8, 18, 12, 0);

function daysAgo(days: number): Date {
  return new Date(2026, 8, 18 - days, 12, 0);
}

describe("lastTalkAt", () => {
  const createdAt = daysAgo(200);

  it("takes the later of the last note and the last «Пообщались»", () => {
    expect(
      lastTalkAt({ createdAt, lastNoteAt: daysAgo(10), talkedAt: daysAgo(40) }),
    ).toEqual(daysAgo(10));
    expect(
      lastTalkAt({ createdAt, lastNoteAt: daysAgo(40), talkedAt: daysAgo(10) }),
    ).toEqual(daysAgo(10));
  });

  it("uses whichever of the two exists", () => {
    expect(
      lastTalkAt({ createdAt, lastNoteAt: daysAgo(40), talkedAt: null }),
    ).toEqual(daysAgo(40));
    expect(
      lastTalkAt({ createdAt, lastNoteAt: null, talkedAt: daysAgo(3) }),
    ).toEqual(daysAgo(3));
  });

  it("counts from the day the contact was added when there is nothing else", () => {
    expect(lastTalkAt({ createdAt, lastNoteAt: null, talkedAt: null })).toEqual(
      createdAt,
    );
  });
});

describe("keepInTouchState", () => {
  it("is due once the rhythm has passed", () => {
    expect(keepInTouchState(30, daysAgo(29), now)).toEqual({
      days: 30,
      daysSince: 29,
      daysLeft: 1,
      isDue: false,
    });
    expect(keepInTouchState(30, daysAgo(30), now)).toEqual({
      days: 30,
      daysSince: 30,
      daysLeft: 0,
      isDue: true,
    });
    expect(keepInTouchState(30, daysAgo(45), now)).toEqual({
      days: 30,
      daysSince: 45,
      daysLeft: 0,
      isDue: true,
    });
  });

  it("counts calendar days, not 24-hour periods", () => {
    const lateEvening = new Date(2026, 8, 4, 23, 50);
    const justAfterMidnight = new Date(2026, 8, 18, 0, 10);

    expect(keepInTouchState(14, lateEvening, justAfterMidnight)).toMatchObject({
      daysSince: 14,
      isDue: true,
    });
  });

  it("starts over after a talk today", () => {
    expect(keepInTouchState(14, now, now)).toEqual({
      days: 14,
      daysSince: 0,
      daysLeft: 14,
      isDue: false,
    });
  });

  it("never counts a date in the future as negative days", () => {
    expect(keepInTouchState(14, daysAgo(-2), now)).toEqual({
      days: 14,
      daysSince: 0,
      daysLeft: 14,
      isDue: false,
    });
  });
});

describe("selectDue", () => {
  function item(id: number, keepInTouchDays: number, noteDaysAgo: number) {
    return {
      id,
      name: `Контакт ${id}`,
      metContext: "",
      keepInTouchDays,
      createdAt: daysAgo(400),
      talkedAt: null,
      lastNoteAt: daysAgo(noteDaysAgo),
    };
  }

  it("keeps only contacts due now, the longest without talking first", () => {
    const due = selectDue(
      [
        item(1, 30, 45),
        item(2, 365, 370),
        item(3, 14, 10), // not due yet
        item(4, 14, 44),
      ],
      now,
    );

    // The order matches the days the list shows, whatever the rhythm.
    expect(due.map((contact) => contact.id)).toEqual([2, 1, 4]);
    expect(due.map((contact) => contact.daysSinceTalk)).toEqual([370, 45, 44]);
  });

  it("keeps the incoming alphabetical order for the same number of days", () => {
    const due = selectDue([item(7, 30, 40), item(3, 30, 40)], now);

    expect(due.map((contact) => contact.id)).toEqual([7, 3]);
  });

  it("counts a contact without notes from the day it was added", () => {
    const withoutNotes = { ...item(9, 90, 0), lastNoteAt: null };

    expect(selectDue([withoutNotes], now)).toEqual([
      { ...withoutNotes, daysSinceTalk: 400 },
    ]);
  });
});
