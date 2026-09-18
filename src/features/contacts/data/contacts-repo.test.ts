import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { contacts, notes } from "@/db/schema";
import { createTestDb, createTestUser, type TestDb } from "@/db/test-db";
import {
  countContacts,
  createContact,
  deleteContact,
  getContact,
  listKeepInTouch,
  markTalked,
  searchContacts,
  updateContact,
} from "./contacts-repo";
import { addNote, listNotes } from "./notes-repo";

let db: TestDb;
let owner: number;
let stranger: number;

beforeEach(async () => {
  db = await createTestDb();
  owner = await createTestUser(db, "owner@example.com");
  stranger = await createTestUser(db, "stranger@example.com");
});

afterEach(async () => {
  vi.useRealTimers();
  await db.$client.close();
});

async function nameSearchOf(id: number): Promise<string | undefined> {
  const [row] = await db
    .select({ nameSearch: contacts.nameSearch })
    .from(contacts)
    .where(eq(contacts.id, id));
  return row?.nameSearch;
}

async function names(query: string): Promise<string[]> {
  return (await searchContacts(owner, query, db)).map((contact) => contact.name);
}

describe("createContact", () => {
  it("trims the name and stores its search form", async () => {
    const id = await createContact(owner, { name: "  Семён Королёв  " }, db);

    const contact = await getContact(owner, id, db);
    expect(contact?.name).toBe("Семён Королёв");
    expect(await nameSearchOf(id)).toBe("семен королев");
  });

  it("fills optional fields with empty strings and sets both dates", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-17T10:00:00Z"));

    const id = await createContact(owner, { name: "Анна Петрова" }, db);

    expect(await getContact(owner, id, db)).toEqual({
      id,
      name: "Анна Петрова",
      metContext: "",
      phone: "",
      email: "",
      keepInTouchDays: null,
      talkedAt: null,
      createdAt: new Date("2026-09-17T10:00:00Z"),
      updatedAt: new Date("2026-09-17T10:00:00Z"),
    });
  });

  it("stores how often to keep in touch", async () => {
    const id = await createContact(owner, 
      { name: "Анна Петрова", keepInTouchDays: 30 },
      db,
    );

    expect(await getContact(owner, id, db)).toMatchObject({ keepInTouchDays: 30 });
  });

  it("saves the first note together with the contact", async () => {
    const id = await createContact(owner, 
      {
        name: "Анна Петрова",
        metContext: "Конференция ProductCamp, 2025",
        phone: "+7 916 555-01-42",
        email: "anna@example.com",
        firstNote: "  Пришлёт ссылку на свой доклад ",
      },
      db,
    );

    expect(await getContact(owner, id, db)).toMatchObject({
      metContext: "Конференция ProductCamp, 2025",
      phone: "+7 916 555-01-42",
      email: "anna@example.com",
    });
    const saved = await listNotes(owner, id, db);
    expect(saved.map((note) => note.body)).toEqual([
      "Пришлёт ссылку на свой доклад",
    ]);
  });

  it("skips a blank first note", async () => {
    const id = await createContact(owner, { name: "Анна", firstNote: "   " }, db);

    expect(await listNotes(owner, id, db)).toEqual([]);
  });

  it("does not keep the contact when the first note fails", async () => {
    await db.$client.exec(`
      CREATE FUNCTION fail_notes() RETURNS trigger LANGUAGE plpgsql
        AS $$ BEGIN RAISE EXCEPTION 'boom'; END $$;
      CREATE TRIGGER fail_notes BEFORE INSERT ON notes
        FOR EACH ROW EXECUTE FUNCTION fail_notes();
    `);

    await expect(
      createContact(owner, { name: "Анна", firstNote: "Заметка" }, db),
    ).rejects.toThrow();
    expect(await countContacts(owner, db)).toBe(0);
  });
});

describe("searchContacts", () => {
  beforeEach(async () => {
    for (const name of [
      "Анна Петрова",
      "Иван Аннин",
      "Жанна Агеева",
      "Семён Королёв",
      "Анна-Мария Ёлкина",
      "Борис Ковалёв",
      "Скидка 100% Магазин",
      "Имя_с_подчёркиванием",
    ]) {
      await createContact(owner, { name }, db);
    }
  });

  it("finds a part of a name regardless of case", async () => {
    expect(await names("анн")).toEqual([
      "Анна Петрова",
      "Анна-Мария Ёлкина",
      "Жанна Агеева",
      "Иван Аннин",
    ]);
    expect(await names("АНН")).toEqual(await names("анн"));
  });

  it("treats е and ё as the same letter", async () => {
    expect(await names("семен")).toEqual(["Семён Королёв"]);
    expect(await names("ковалёв")).toEqual(["Борис Ковалёв"]);
  });

  it("requires every word to match", async () => {
    expect(await names("анна пет")).toEqual(["Анна Петрова"]);
    expect(await names("  Пет   АННА ")).toEqual(["Анна Петрова"]);
  });

  it("finds hyphenated names", async () => {
    expect(await names("анна-мария")).toEqual(["Анна-Мария Ёлкина"]);
  });

  it("treats % and _ as ordinary characters", async () => {
    expect(await names("%")).toEqual(["Скидка 100% Магазин"]);
    expect(await names("_")).toEqual(["Имя_с_подчёркиванием"]);
    expect(await names("анна%")).toEqual([]);
    expect(await names("\\")).toEqual([]);
  });

  it("returns everyone in alphabetical order for an empty query, with Ё in place", async () => {
    await createContact(owner, { name: "Егор Новиков" }, db);
    await createContact(owner, { name: "Ёжиков Лев" }, db);
    await createContact(owner, { name: "Дарья Лебедева" }, db);

    expect(await names("   ")).toEqual([
      "Анна Петрова",
      "Анна-Мария Ёлкина",
      "Борис Ковалёв",
      "Дарья Лебедева",
      "Егор Новиков",
      "Ёжиков Лев",
      "Жанна Агеева",
      "Иван Аннин",
      "Имя_с_подчёркиванием",
      "Семён Королёв",
      "Скидка 100% Магазин",
    ]);
  });

  it("returns only what the list needs", async () => {
    const [first] = await searchContacts(owner, "петрова", db);
    expect(Object.keys(first).sort()).toEqual(["id", "metContext", "name"]);
  });
});

describe("getContact", () => {
  it("returns null for a missing contact", async () => {
    expect(await getContact(owner, 12345, db)).toBeNull();
  });
});

describe("updateContact", () => {
  it("updates fields, the search form and the change date", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-01T10:00:00Z"));
    const id = await createContact(owner, { name: "Марк Орлов" }, db);

    vi.setSystemTime(new Date("2026-09-17T10:00:00Z"));
    const updated = await updateContact(owner, 
      id,
      {
        name: " Марк Орлов-Соколов ",
        metContext: "Митап по Next.js",
        phone: "+7 900 555-00-00",
        email: "mark@example.com",
        keepInTouchDays: 90,
      },
      db,
    );

    expect(updated).toBe(true);
    expect(await getContact(owner, id, db)).toEqual({
      id,
      name: "Марк Орлов-Соколов",
      metContext: "Митап по Next.js",
      phone: "+7 900 555-00-00",
      email: "mark@example.com",
      keepInTouchDays: 90,
      talkedAt: null,
      createdAt: new Date("2026-09-01T10:00:00Z"),
      updatedAt: new Date("2026-09-17T10:00:00Z"),
    });
    expect(await names("соколов")).toEqual(["Марк Орлов-Соколов"]);
  });

  it("stops keeping in touch when the rhythm is removed", async () => {
    const id = await createContact(owner, { name: "Марк", keepInTouchDays: 30 }, db);

    await updateContact(owner, id, { name: "Марк", keepInTouchDays: null }, db);

    expect(await getContact(owner, id, db)).toMatchObject({ keepInTouchDays: null });
  });

  it("returns false for a missing contact", async () => {
    expect(await updateContact(owner, 12345, { name: "Никто" }, db)).toBe(false);
  });
});

describe("markTalked", () => {
  it("stamps when you talked and leaves the change date alone", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-01T10:00:00Z"));
    const id = await createContact(owner, { name: "Марк", keepInTouchDays: 14 }, db);

    vi.setSystemTime(new Date("2026-09-17T10:00:00Z"));
    expect(await markTalked(owner, id, db)).toBe(true);

    expect(await getContact(owner, id, db)).toMatchObject({
      talkedAt: new Date("2026-09-17T10:00:00Z"),
      updatedAt: new Date("2026-09-01T10:00:00Z"),
    });
  });

  it("returns false for a missing contact", async () => {
    expect(await markTalked(owner, 12345, db)).toBe(false);
  });
});

describe("listKeepInTouch", () => {
  it("returns only contacts with a rhythm, with the times the rules need", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-01T10:00:00Z"));
    const anna = await createContact(owner, 
      { name: "Анна Петрова", keepInTouchDays: 30, firstNote: "Первая" },
      db,
    );
    const boris = await createContact(owner, 
      { name: "Борис Ковалёв", keepInTouchDays: 14 },
      db,
    );
    await createContact(owner, { name: "Вера Соколова", firstNote: "Без ритма" }, db);

    vi.setSystemTime(new Date("2026-09-10T10:00:00Z"));
    await addNote(owner, anna, "Последняя", db);
    vi.setSystemTime(new Date("2026-09-12T10:00:00Z"));
    await markTalked(owner, boris, db);

    expect(await listKeepInTouch(owner, "", db)).toEqual([
      {
        id: anna,
        name: "Анна Петрова",
        metContext: "",
        keepInTouchDays: 30,
        createdAt: new Date("2026-08-01T10:00:00Z"),
        talkedAt: null,
        lastNoteAt: new Date("2026-09-10T10:00:00Z"),
      },
      {
        id: boris,
        name: "Борис Ковалёв",
        metContext: "",
        keepInTouchDays: 14,
        createdAt: new Date("2026-08-01T10:00:00Z"),
        talkedAt: new Date("2026-09-12T10:00:00Z"),
        lastNoteAt: null,
      },
    ]);
  });

  it("narrows by name the same way as the search", async () => {
    for (const name of ["Анна Петрова", "Семён Королёв", "Иван Аннин"]) {
      await createContact(owner, { name, keepInTouchDays: 30 }, db);
    }
    await createContact(owner, { name: "Анна Жукова" }, db);

    const found = async (query: string) =>
      (await listKeepInTouch(owner, query, db)).map((contact) => contact.name);

    expect(await found("анн")).toEqual(["Анна Петрова", "Иван Аннин"]);
    expect(await found("семен")).toEqual(["Семён Королёв"]);
    expect(await found("%")).toEqual([]);
  });
});

describe("deleteContact", () => {
  it("removes the contact together with its notes", async () => {
    const id = await createContact(owner, { name: "Анна", firstNote: "Первая" }, db);
    await addNote(owner, id, "Вторая", db);
    const otherId = await createContact(owner, { name: "Борис" }, db);
    await addNote(owner, otherId, "Чужая заметка", db);

    expect(await deleteContact(owner, id, db)).toBe(true);

    expect(await getContact(owner, id, db)).toBeNull();
    const left = await db.select({ contactId: notes.contactId }).from(notes);
    expect(left).toEqual([{ contactId: otherId }]);
  });

  it("returns false for a missing contact", async () => {
    expect(await deleteContact(owner, 12345, db)).toBe(false);
  });
});

describe("countContacts", () => {
  it("counts all contacts of the owner", async () => {
    expect(await countContacts(owner, db)).toBe(0);
    await createContact(owner, { name: "Анна" }, db);
    await createContact(owner, { name: "Борис" }, db);
    expect(await countContacts(owner, db)).toBe(2);
  });
});

describe("another owner's contacts", () => {
  let theirs: number;

  beforeEach(async () => {
    theirs = await createContact(
      stranger,
      { name: "Анна Чужая", keepInTouchDays: 14, firstNote: "Чужая заметка" },
      db,
    );
    await createContact(owner, { name: "Анна Своя", keepInTouchDays: 14 }, db);
  });

  it("are not listed, searched or counted", async () => {
    expect(await names("")).toEqual(["Анна Своя"]);
    expect(await names("чужая")).toEqual([]);
    expect(
      (await listKeepInTouch(owner, "", db)).map((contact) => contact.name),
    ).toEqual(["Анна Своя"]);
    expect(await countContacts(owner, db)).toBe(1);
  });

  it("cannot be opened", async () => {
    expect(await getContact(owner, theirs, db)).toBeNull();
    expect(await getContact(stranger, theirs, db)).toMatchObject({
      name: "Анна Чужая",
    });
  });

  it("cannot be changed, marked or deleted", async () => {
    expect(await updateContact(owner, theirs, { name: "Взлом" }, db)).toBe(
      false,
    );
    expect(await markTalked(owner, theirs, db)).toBe(false);
    expect(await deleteContact(owner, theirs, db)).toBe(false);

    expect(await getContact(stranger, theirs, db)).toMatchObject({
      name: "Анна Чужая",
      talkedAt: null,
    });
    expect(await listNotes(stranger, theirs, db)).toHaveLength(1);
  });
});
