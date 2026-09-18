import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "@/db/test-db";
import { createContact } from "./contacts-repo";
import { addNote, countNotes, deleteNote, listNotes } from "./notes-repo";

let db: TestDb;
let contactId: number;

beforeEach(async () => {
  db = await createTestDb();
  contactId = await createContact({ name: "Анна Петрова" }, db);
});

afterEach(async () => {
  vi.useRealTimers();
  await db.$client.close();
});

describe("addNote and listNotes", () => {
  it("returns the saved note with a trimmed body and the current date", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-17T10:00:00Z"));

    const note = await addNote(contactId, "  Созвонились в пятницу \n", db);

    expect(note).toEqual({
      id: expect.any(Number),
      contactId,
      body: "Созвонились в пятницу",
      createdAt: new Date("2026-09-17T10:00:00Z"),
    });
  });

  it("lists the newest notes first", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-05-17T10:00:00Z"));
    await addNote(contactId, "Май", db);
    vi.setSystemTime(new Date("2026-09-03T10:00:00Z"));
    await addNote(contactId, "Сентябрь", db);
    vi.setSystemTime(new Date("2026-06-01T10:00:00Z"));
    await addNote(contactId, "Июнь", db);

    const bodies = (await listNotes(contactId, db)).map((note) => note.body);
    expect(bodies).toEqual(["Сентябрь", "Июнь", "Май"]);
  });

  it("puts the later of two same-moment notes first", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-17T10:00:00Z"));
    await addNote(contactId, "Первая", db);
    await addNote(contactId, "Вторая", db);

    const bodies = (await listNotes(contactId, db)).map((note) => note.body);
    expect(bodies).toEqual(["Вторая", "Первая"]);
  });

  it("lists only the notes of the given contact", async () => {
    const otherId = await createContact({ name: "Борис" }, db);
    await addNote(otherId, "Чужая", db);

    expect(await listNotes(contactId, db)).toEqual([]);
  });

  it("returns null when the contact no longer exists", async () => {
    expect(await addNote(12345, "Заметка", db)).toBeNull();
  });
});

describe("deleteNote", () => {
  it("removes only that note", async () => {
    const first = await addNote(contactId, "Первая", db);
    await addNote(contactId, "Вторая", db);

    expect(await deleteNote(first!.id, db)).toBe(true);

    const bodies = (await listNotes(contactId, db)).map((note) => note.body);
    expect(bodies).toEqual(["Вторая"]);
  });

  it("returns false for a missing note", async () => {
    expect(await deleteNote(12345, db)).toBe(false);
  });
});

describe("countNotes", () => {
  it("counts the notes of one contact", async () => {
    const otherId = await createContact({ name: "Борис" }, db);
    await addNote(contactId, "Первая", db);
    await addNote(contactId, "Вторая", db);
    await addNote(otherId, "Чужая", db);

    expect(await countNotes(contactId, db)).toBe(2);
    expect(await countNotes(otherId, db)).toBe(1);
    expect(await countNotes(12345, db)).toBe(0);
  });
});
