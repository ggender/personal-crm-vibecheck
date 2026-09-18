import {
  buildContactRow,
  countContacts,
} from "@/features/contacts/data/contacts-repo";
import { KEEP_IN_TOUCH_DAYS } from "@/features/contacts/validation";
import type { Db } from "./client";
import { contacts, notes } from "./schema";
import {
  DOUBLE_FIRST_NAMES,
  FEATURED_CONTACTS,
  FEMALE_FIRST_NAMES,
  MALE_FIRST_NAMES,
  MET_CONTEXTS,
  NOTE_TEMPLATES,
  SURNAMES,
  femaleSurname,
  pickGendered,
  transliterate,
  type Gender,
} from "./seed-data";

export const SEED_CONTACT_COUNT = 999;

// Fixed seed: the same people every time the database is built from scratch.
const RANDOM_SEED = 20260917;
// Rhythms draw from their own sequence, so the people, their details and
// notes stay the same as before rhythms existed.
const RHYTHM_SEED = 20260918;
const RHYTHM_SHARE = 0.04;
const DAY_MS = 24 * 60 * 60 * 1000;
// Notes stay inside the last 18 months, contacts inside the last 2 years.
const NOTE_WINDOW_DAYS = 540;
const CONTACT_WINDOW_DAYS = 730;

type SeedContact = {
  name: string;
  metContext: string;
  phone: string;
  email: string;
  keepInTouchDays: number | null;
  createdAt: Date;
  notes: { body: string; createdAt: Date }[];
};

export type SeedResult =
  | { status: "seeded"; contacts: number; notes: number }
  | { status: "skipped"; contacts: number };

// mulberry32: tiny deterministic generator, returns [0, 1).
function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateSeedContacts(now: Date): SeedContact[] {
  const random = createRandom(RANDOM_SEED);
  const rhythmRandom = createRandom(RHYTHM_SEED);
  const randomRhythm = () =>
    rhythmRandom() < RHYTHM_SHARE
      ? KEEP_IN_TOUCH_DAYS[
          Math.floor(rhythmRandom() * KEEP_IN_TOUCH_DAYS.length)
        ]
      : null;
  const int = (max: number) => Math.floor(random() * max);
  const pick = <T>(items: readonly T[]): T => items[int(items.length)];
  const chance = (probability: number) => random() < probability;
  const digits = (count: number) =>
    Array.from({ length: count }, () => int(10)).join("");
  const daysAgo = (days: number) =>
    new Date(now.getTime() - days * DAY_MS - int(DAY_MS));

  const randomPhone = () => `+7 9${digits(2)} 555-${digits(2)}-${digits(2)}`;
  const randomEmail = (first: string, last: string) => {
    const suffix = chance(0.3) ? String(10 + int(90)) : "";
    return `${transliterate(first)}.${transliterate(last)}${suffix}@example.com`;
  };

  const withDates = (
    person: Omit<SeedContact, "createdAt" | "notes">,
    noteList: SeedContact["notes"],
  ): SeedContact => {
    const sortedNotes = [...noteList].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    const added = daysAgo(int(CONTACT_WINDOW_DAYS + 1));
    const firstNote = sortedNotes[0]?.createdAt;
    const createdAt = firstNote && firstNote < added ? firstNote : added;
    return { ...person, createdAt, notes: sortedNotes };
  };

  const people: SeedContact[] = FEATURED_CONTACTS.map((featured) =>
    withDates(
      {
        name: `${featured.first} ${featured.last}`,
        metContext: featured.metContext,
        phone: featured.phone ?? (chance(0.6) ? randomPhone() : ""),
        email:
          featured.email ??
          (chance(0.5) ? randomEmail(featured.first, featured.last) : ""),
        keepInTouchDays: featured.keepInTouchDays ?? null,
      },
      (featured.notes ?? []).map((note) => ({
        body: note.body,
        createdAt: daysAgo(note.daysAgo),
      })),
    ),
  );

  while (people.length < SEED_CONTACT_COUNT) {
    const gender: Gender = chance(0.5) ? "m" : "f";
    const first = chance(0.02)
      ? pick(DOUBLE_FIRST_NAMES[gender])
      : pick(gender === "m" ? MALE_FIRST_NAMES : FEMALE_FIRST_NAMES);
    const surnames = [pick(SURNAMES)];
    if (chance(0.02)) {
      const second = pick(SURNAMES);
      if (second !== surnames[0]) {
        surnames.push(second);
      }
    }
    const last = surnames
      .map((surname) => (gender === "m" ? surname : femaleSurname(surname)))
      .join("-");
    const noteCount = chance(0.4) ? 1 + int(4) : 0;

    people.push(
      withDates(
        {
          name: `${first} ${last}`,
          metContext: chance(0.03)
            ? ""
            : pickGendered(pick(MET_CONTEXTS), gender),
          phone: chance(0.6) ? randomPhone() : "",
          email: chance(0.5) ? randomEmail(first, last) : "",
          keepInTouchDays: randomRhythm(),
        },
        Array.from({ length: noteCount }, () => ({
          body: pickGendered(pick(NOTE_TEMPLATES), gender),
          createdAt: daysAgo(int(NOTE_WINDOW_DAYS + 1)),
        })),
      ),
    );
  }
  return people;
}

// Safe to run again: does nothing if the database has any contacts.
export async function seedDatabase(
  db: Db,
  now: Date = new Date(),
): Promise<SeedResult> {
  const existing = await countContacts(db);
  if (existing > 0) {
    return { status: "skipped", contacts: existing };
  }

  let noteCount = 0;
  const people = generateSeedContacts(now);
  db.transaction((tx) => {
    for (const person of people) {
      const { id } = tx
        .insert(contacts)
        .values(buildContactRow(person, person.createdAt))
        .returning({ id: contacts.id })
        .get();
      if (person.notes.length > 0) {
        tx.insert(notes)
          .values(person.notes.map((note) => ({ contactId: id, ...note })))
          .run();
        noteCount += person.notes.length;
      }
    }
  });

  const total = await countContacts(db);
  if (total !== SEED_CONTACT_COUNT) {
    throw new Error(
      `Seed expected ${SEED_CONTACT_COUNT} contacts but found ${total}`,
    );
  }
  return { status: "seeded", contacts: total, notes: noteCount };
}
