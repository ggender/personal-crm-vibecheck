import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  clearTestDb,
  createTestDb,
  createTestUser,
  type TestDb,
} from "@/db/test-db";
import { createContact } from "./contacts-repo";
import { addNote, countNotes, deleteNote, listNotes } from "./notes-repo";

let db: TestDb;
let owner: number;
let stranger: number;
let contactId: number;

beforeAll(async () => {
  db = await createTestDb();
});

beforeEach(async () => {
  await clearTestDb(db);
  owner = await createTestUser(db, "owner@example.com");
  stranger = await createTestUser(db, "stranger@example.com");
  contactId = await createContact(owner, { name: "Анна Петрова" }, db);
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  await db.$client.close();
});

describe("addNote and listNotes", () => {
  it("returns the saved note with a trimmed body and the current date", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-17T10:00:00Z"));

    const note = await addNote(owner, contactId, "  Созвонились в пятницу \n", db);

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
    await addNote(owner, contactId, "Май", db);
    vi.setSystemTime(new Date("2026-09-03T10:00:00Z"));
    await addNote(owner, contactId, "Сентябрь", db);
    vi.setSystemTime(new Date("2026-06-01T10:00:00Z"));
    await addNote(owner, contactId, "Июнь", db);

    const bodies = (await listNotes(owner, contactId, db)).map((note) => note.body);
    expect(bodies).toEqual(["Сентябрь", "Июнь", "Май"]);
  });

  it("puts the later of two same-moment notes first", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-17T10:00:00Z"));
    await addNote(owner, contactId, "Первая", db);
    await addNote(owner, contactId, "Вторая", db);

    const bodies = (await listNotes(owner, contactId, db)).map((note) => note.body);
    expect(bodies).toEqual(["Вторая", "Первая"]);
  });

  it("lists only the notes of the given contact", async () => {
    const otherId = await createContact(owner, { name: "Борис" }, db);
    await addNote(owner, otherId, "Чужая", db);

    expect(await listNotes(owner, contactId, db)).toEqual([]);
  });

  it("returns null when the contact no longer exists", async () => {
    expect(await addNote(owner, 12345, "Заметка", db)).toBeNull();
  });
});

describe("deleteNote", () => {
  it("removes only that note", async () => {
    const first = await addNote(owner, contactId, "Первая", db);
    await addNote(owner, contactId, "Вторая", db);

    expect(await deleteNote(owner, first!.id, db)).toBe(true);

    const bodies = (await listNotes(owner, contactId, db)).map((note) => note.body);
    expect(bodies).toEqual(["Вторая"]);
  });

  it("returns false for a missing note", async () => {
    expect(await deleteNote(owner, 12345, db)).toBe(false);
  });
});

describe("countNotes", () => {
  it("counts the notes of one contact", async () => {
    const otherId = await createContact(owner, { name: "Борис" }, db);
    await addNote(owner, contactId, "Первая", db);
    await addNote(owner, contactId, "Вторая", db);
    await addNote(owner, otherId, "Чужая", db);

    expect(await countNotes(owner, contactId, db)).toBe(2);
    expect(await countNotes(owner, otherId, db)).toBe(1);
    expect(await countNotes(owner, 12345, db)).toBe(0);
  });
});

describe("notes of another owner's contact", () => {
  let theirs: number;
  let theirNoteId: number;

  beforeEach(async () => {
    theirs = await createContact(stranger, { name: "Анна Чужая" }, db);
    const note = await addNote(stranger, theirs, "Чужая заметка", db);
    theirNoteId = note!.id;
  });

  it("are not listed or counted", async () => {
    expect(await listNotes(owner, theirs, db)).toEqual([]);
    expect(await countNotes(owner, theirs, db)).toBe(0);
  });

  it("cannot be added to", async () => {
    expect(await addNote(owner, theirs, "Подброшенная", db)).toBeNull();

    const bodies = (await listNotes(stranger, theirs, db)).map(
      (note) => note.body,
    );
    expect(bodies).toEqual(["Чужая заметка"]);
  });

  it("cannot be deleted", async () => {
    expect(await deleteNote(owner, theirNoteId, db)).toBe(false);

    expect(await countNotes(stranger, theirs, db)).toBe(1);
  });
});
