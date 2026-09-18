import { beforeAll, describe, expect, it } from "vitest";
import { createContact } from "@/features/contacts/data/contacts-repo";
import {
  keepInTouchState,
  lastTalkAt,
} from "@/features/contacts/keep-in-touch";
import { normalizeName } from "@/features/contacts/normalize-name";
import { KEEP_IN_TOUCH_DAYS } from "@/features/contacts/validation";
import type { Db } from "./client";
import { contacts, notes } from "./schema";
import { SEED_CONTACT_COUNT, seedDatabase } from "./seed-database";
import { createTestDb } from "./test-db";

const now = new Date("2026-09-17T12:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function allRows(db: Db) {
  return {
    contacts: db.select().from(contacts).orderBy(contacts.id).all(),
    notes: db.select().from(notes).orderBy(notes.id).all(),
  };
}

describe("seedDatabase", () => {
  it("fills an empty database with exactly 999 contacts", async () => {
    const db = createTestDb();

    const result = await seedDatabase(db, now);

    const rows = allRows(db);
    expect(SEED_CONTACT_COUNT).toBe(999);
    expect(rows.contacts).toHaveLength(999);
    expect(result).toEqual({
      status: "seeded",
      contacts: 999,
      notes: rows.notes.length,
    });
  });

  it("adds nothing on a second run", async () => {
    const db = createTestDb();
    await seedDatabase(db, now);
    const before = allRows(db);

    const result = await seedDatabase(db, now);

    expect(result).toEqual({ status: "skipped", contacts: 999 });
    expect(allRows(db)).toEqual(before);
  });

  it("leaves a database with any contacts alone", async () => {
    const db = createTestDb();
    await createContact({ name: "Моя Анна" }, db);

    const result = await seedDatabase(db, now);

    expect(result).toEqual({ status: "skipped", contacts: 1 });
  });

  it("produces the same data every time", async () => {
    const first = createTestDb();
    const second = createTestDb();

    await seedDatabase(first, now);
    await seedDatabase(second, now);

    expect(allRows(second)).toEqual(allRows(first));
  });
});

describe("seed content", () => {
  let rows: ReturnType<typeof allRows>;

  beforeAll(async () => {
    const db = createTestDb();
    await seedDatabase(db, now);
    rows = allRows(db);
  });

  it("stores the search form of every name", () => {
    for (const contact of rows.contacts) {
      expect(contact.nameSearch).toBe(normalizeName(contact.name));
      expect(contact.name).toBe(contact.name.trim());
    }
  });

  it("has names with ё and hyphens", () => {
    const allNames = rows.contacts.map((contact) => contact.name).join("\n");
    for (const part of ["Семён", "Фёдор", "Алёна", "Королёв", "Ёлкин"]) {
      expect(allNames).toContain(part);
    }
    expect(allNames).toContain("Анна-Мария");
    expect(rows.contacts.some((contact) => /\S-\S+$/.test(contact.name))).toBe(
      true,
    );
  });

  it("has at least three pairs of namesakes with different met context", () => {
    const contextsByName = new Map<string, Set<string>>();
    for (const contact of rows.contacts) {
      const contexts = contextsByName.get(contact.name) ?? new Set<string>();
      contexts.add(contact.metContext);
      contextsByName.set(contact.name, contexts);
    }
    const distinguishable = [...contextsByName.values()].filter(
      (contexts) => contexts.size >= 2,
    );
    expect(distinguishable.length).toBeGreaterThanOrEqual(3);
  });

  it("uses at least 40 different met contexts", () => {
    const contexts = new Set(
      rows.contacts.map((contact) => contact.metContext).filter(Boolean),
    );
    expect(contexts.size).toBeGreaterThanOrEqual(40);
  });

  it("gives about 60% a fictional phone", () => {
    const withPhone = rows.contacts.filter((contact) => contact.phone !== "");
    expect(withPhone.length / 999).toBeGreaterThan(0.5);
    expect(withPhone.length / 999).toBeLessThan(0.7);
    for (const contact of withPhone) {
      expect(contact.phone).toMatch(/^\+7 9\d\d 555-\d\d-\d\d$/);
    }
  });

  it("gives about 50% an example.com email", () => {
    const withEmail = rows.contacts.filter((contact) => contact.email !== "");
    expect(withEmail.length / 999).toBeGreaterThan(0.4);
    expect(withEmail.length / 999).toBeLessThan(0.6);
    for (const contact of withEmail) {
      expect(contact.email).toMatch(/^[a-z0-9.-]+@example\.com$/);
    }
  });

  it("gives about 40% of contacts one to four notes", () => {
    const perContact = new Map<number, number>();
    for (const note of rows.notes) {
      perContact.set(note.contactId, (perContact.get(note.contactId) ?? 0) + 1);
    }
    expect(perContact.size / 999).toBeGreaterThan(0.3);
    expect(perContact.size / 999).toBeLessThan(0.5);
    for (const noteCount of perContact.values()) {
      expect(noteCount).toBeGreaterThanOrEqual(1);
      expect(noteCount).toBeLessThanOrEqual(4);
    }
  });

  it("dates notes within the last 18 months, after the contact was added", () => {
    const createdAtById = new Map(
      rows.contacts.map((contact) => [contact.id, contact.createdAt]),
    );
    const oldest = now.getTime() - 548 * DAY_MS;
    for (const note of rows.notes) {
      expect(note.body.trim()).not.toBe("");
      expect(note.createdAt.getTime()).toBeLessThanOrEqual(now.getTime());
      expect(note.createdAt.getTime()).toBeGreaterThanOrEqual(oldest);
      expect(note.createdAt.getTime()).toBeGreaterThanOrEqual(
        createdAtById.get(note.contactId)!.getTime(),
      );
    }
  });

  it("gives a few percent a keep-in-touch rhythm, and some of them are due", () => {
    const withRhythm = rows.contacts.filter(
      (contact) => contact.keepInTouchDays !== null,
    );
    expect(withRhythm.length / 999).toBeGreaterThan(0.02);
    expect(withRhythm.length / 999).toBeLessThan(0.07);
    for (const contact of withRhythm) {
      expect(KEEP_IN_TOUCH_DAYS).toContain(contact.keepInTouchDays);
    }
    expect(rows.contacts.every((contact) => contact.talkedAt === null)).toBe(
      true,
    );

    const lastNoteAt = new Map<number, Date>();
    for (const note of rows.notes) {
      const latest = lastNoteAt.get(note.contactId);
      if (!latest || note.createdAt > latest) {
        lastNoteAt.set(note.contactId, note.createdAt);
      }
    }
    const due = withRhythm.filter(
      (contact) =>
        keepInTouchState(
          contact.keepInTouchDays!,
          lastTalkAt({
            createdAt: contact.createdAt,
            talkedAt: contact.talkedAt,
            lastNoteAt: lastNoteAt.get(contact.id) ?? null,
          }),
          now,
        ).isDue,
    );
    expect(due.length).toBeGreaterThanOrEqual(5);
    expect(due.length).toBeLessThan(withRhythm.length);
  });

  it("gives the people from the sketches their rhythms", () => {
    const rhythmOf = (person: string) =>
      rows.contacts.find(
        (contact) => `${contact.name} · ${contact.metContext}` === person,
      )?.keepInTouchDays;

    expect(rhythmOf("Анна Петрова · Конференция ProductCamp, 2025")).toBe(30);
    expect(rhythmOf("Дарья Лебедева · Через Бориса")).toBe(14);
    expect(rhythmOf("Вера Соколова · Соседка по даче")).toBe(90);
    expect(rhythmOf("Анна Петрова · Соседка по подъезду")).toBeNull();
  });

  it("includes the people from the sketches", () => {
    const people = rows.contacts.map(
      (contact) => `${contact.name} · ${contact.metContext}`,
    );
    expect(people).toEqual(
      expect.arrayContaining([
        "Анна Петрова · Конференция ProductCamp, 2025",
        "Анна Жукова · Курс по аналитике",
        "Жанна Агеева · Подруга сестры",
        "Иван Аннин · Клиент, 2024",
        "Борис Ковалёв · Бывший коллега",
      ]),
    );
  });
});
