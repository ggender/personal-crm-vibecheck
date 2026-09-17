import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { contacts, notes } from "@/db/schema";
import { createTestDb } from "@/db/test-db";
import {
  countContacts,
  createContact,
  deleteContact,
  getContact,
  searchContacts,
  updateContact,
} from "./contacts-repo";
import { addNote, listNotes } from "./notes-repo";

let db: Db;

beforeEach(() => {
  db = createTestDb();
});

afterEach(() => {
  vi.useRealTimers();
});

function nameSearchOf(id: number): string | undefined {
  return db
    .select({ nameSearch: contacts.nameSearch })
    .from(contacts)
    .where(eq(contacts.id, id))
    .get()?.nameSearch;
}

async function names(query: string): Promise<string[]> {
  return (await searchContacts(query, db)).map((contact) => contact.name);
}

describe("createContact", () => {
  it("trims the name and stores its search form", async () => {
    const id = await createContact({ name: "  Семён Королёв  " }, db);

    const contact = await getContact(id, db);
    expect(contact?.name).toBe("Семён Королёв");
    expect(nameSearchOf(id)).toBe("семен королев");
  });

  it("fills optional fields with empty strings and sets both dates", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-17T10:00:00Z"));

    const id = await createContact({ name: "Анна Петрова" }, db);

    expect(await getContact(id, db)).toEqual({
      id,
      name: "Анна Петрова",
      metContext: "",
      phone: "",
      email: "",
      createdAt: new Date("2026-09-17T10:00:00Z"),
      updatedAt: new Date("2026-09-17T10:00:00Z"),
    });
  });

  it("saves the first note together with the contact", async () => {
    const id = await createContact(
      {
        name: "Анна Петрова",
        metContext: "Конференция ProductCamp, 2025",
        phone: "+7 916 555-01-42",
        email: "anna@example.com",
        firstNote: "  Пришлёт ссылку на свой доклад ",
      },
      db,
    );

    expect(await getContact(id, db)).toMatchObject({
      metContext: "Конференция ProductCamp, 2025",
      phone: "+7 916 555-01-42",
      email: "anna@example.com",
    });
    const saved = await listNotes(id, db);
    expect(saved.map((note) => note.body)).toEqual([
      "Пришлёт ссылку на свой доклад",
    ]);
  });

  it("skips a blank first note", async () => {
    const id = await createContact({ name: "Анна", firstNote: "   " }, db);

    expect(await listNotes(id, db)).toEqual([]);
  });

  it("does not keep the contact when the first note fails", async () => {
    db.$client.exec(
      "CREATE TRIGGER fail_notes BEFORE INSERT ON notes BEGIN SELECT RAISE(ABORT, 'boom'); END;",
    );

    await expect(
      createContact({ name: "Анна", firstNote: "Заметка" }, db),
    ).rejects.toThrow();
    expect(await countContacts(db)).toBe(0);
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
      await createContact({ name }, db);
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
    await createContact({ name: "Егор Новиков" }, db);
    await createContact({ name: "Ёжиков Лев" }, db);
    await createContact({ name: "Дарья Лебедева" }, db);

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
    const [first] = await searchContacts("петрова", db);
    expect(Object.keys(first).sort()).toEqual(["id", "metContext", "name"]);
  });
});

describe("getContact", () => {
  it("returns null for a missing contact", async () => {
    expect(await getContact(12345, db)).toBeNull();
  });
});

describe("updateContact", () => {
  it("updates fields, the search form and the change date", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-01T10:00:00Z"));
    const id = await createContact({ name: "Марк Орлов" }, db);

    vi.setSystemTime(new Date("2026-09-17T10:00:00Z"));
    const updated = await updateContact(
      id,
      {
        name: " Марк Орлов-Соколов ",
        metContext: "Митап по Next.js",
        phone: "+7 900 555-00-00",
        email: "mark@example.com",
      },
      db,
    );

    expect(updated).toBe(true);
    expect(await getContact(id, db)).toEqual({
      id,
      name: "Марк Орлов-Соколов",
      metContext: "Митап по Next.js",
      phone: "+7 900 555-00-00",
      email: "mark@example.com",
      createdAt: new Date("2026-09-01T10:00:00Z"),
      updatedAt: new Date("2026-09-17T10:00:00Z"),
    });
    expect(await names("соколов")).toEqual(["Марк Орлов-Соколов"]);
  });

  it("returns false for a missing contact", async () => {
    expect(await updateContact(12345, { name: "Никто" }, db)).toBe(false);
  });
});

describe("deleteContact", () => {
  it("removes the contact together with its notes", async () => {
    const id = await createContact({ name: "Анна", firstNote: "Первая" }, db);
    await addNote(id, "Вторая", db);
    const otherId = await createContact({ name: "Борис" }, db);
    await addNote(otherId, "Чужая заметка", db);

    expect(await deleteContact(id, db)).toBe(true);

    expect(await getContact(id, db)).toBeNull();
    const left = db.select({ contactId: notes.contactId }).from(notes).all();
    expect(left).toEqual([{ contactId: otherId }]);
  });

  it("returns false for a missing contact", async () => {
    expect(await deleteContact(12345, db)).toBe(false);
  });
});

describe("countContacts", () => {
  it("counts all contacts", async () => {
    expect(await countContacts(db)).toBe(0);
    await createContact({ name: "Анна" }, db);
    await createContact({ name: "Борис" }, db);
    expect(await countContacts(db)).toBe(2);
  });
});
