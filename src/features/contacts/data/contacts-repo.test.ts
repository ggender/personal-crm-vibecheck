import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { contacts, notes } from "@/db/schema";
import { createTestDb, createTestUser, type TestDb } from "@/db/test-db";
import {
  addContactToGroup,
  countContacts,
  createContact,
  deleteContact,
  getContact,
  listKeepInTouch,
  markTalked,
  removeContactFromGroup,
  searchContacts,
  setKeepInTouchDays,
  updateContact,
} from "./contacts-repo";
import { createGroup, deleteGroup, listContactGroups } from "./groups-repo";
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
  return (await searchContacts(owner, query, null, db)).map(
    (contact) => contact.name,
  );
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
    expect(await countContacts(owner, null, db)).toBe(0);
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
    const [first] = await searchContacts(owner, "петрова", null, db);
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

describe("setKeepInTouchDays", () => {
  it("changes only the rhythm and the change date", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-01T10:00:00Z"));
    const id = await createContact(
      owner,
      { name: "Марк", metContext: "Митап", phone: "+7 900" },
      db,
    );

    vi.setSystemTime(new Date("2026-09-17T10:00:00Z"));
    expect(await setKeepInTouchDays(owner, id, 30, db)).toBe(true);

    expect(await getContact(owner, id, db)).toMatchObject({
      name: "Марк",
      metContext: "Митап",
      phone: "+7 900",
      keepInTouchDays: 30,
      talkedAt: null,
      createdAt: new Date("2026-09-01T10:00:00Z"),
      updatedAt: new Date("2026-09-17T10:00:00Z"),
    });
  });

  it("stops keeping in touch with null", async () => {
    const id = await createContact(
      owner,
      { name: "Марк", keepInTouchDays: 14 },
      db,
    );

    expect(await setKeepInTouchDays(owner, id, null, db)).toBe(true);

    expect((await getContact(owner, id, db))?.keepInTouchDays).toBeNull();
  });

  it("returns false for a missing contact", async () => {
    expect(await setKeepInTouchDays(owner, 12345, 30, db)).toBe(false);
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

    expect(await listKeepInTouch(owner, "", null, db)).toEqual([
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
      (await listKeepInTouch(owner, query, null, db)).map(
        (contact) => contact.name,
      );

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
    expect(await countContacts(owner, null, db)).toBe(0);
    await createContact(owner, { name: "Анна" }, db);
    await createContact(owner, { name: "Борис" }, db);
    expect(await countContacts(owner, null, db)).toBe(2);
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
      (await listKeepInTouch(owner, "", null, db)).map(
        (contact) => contact.name,
      ),
    ).toEqual(["Анна Своя"]);
    expect(await countContacts(owner, null, db)).toBe(1);
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
    expect(await setKeepInTouchDays(owner, theirs, null, db)).toBe(false);
    expect(await markTalked(owner, theirs, db)).toBe(false);
    expect(await deleteContact(owner, theirs, db)).toBe(false);

    expect(await getContact(stranger, theirs, db)).toMatchObject({
      name: "Анна Чужая",
      keepInTouchDays: 14,
      talkedAt: null,
    });
    expect(await listNotes(stranger, theirs, db)).toHaveLength(1);
  });
});

describe("groups of a contact", () => {
  let work: number;
  let friends: number;

  beforeEach(async () => {
    work = (await createGroup(owner, "Работа", db))!.id;
    friends = (await createGroup(owner, "Друзья", db))!.id;
  });

  async function groupsOf(id: number): Promise<string[]> {
    return (await listContactGroups(owner, id, db)).map((group) => group.name);
  }

  it("are saved together with a new contact", async () => {
    const id = await createContact(
      owner,
      { name: "Анна", groupIds: [work, friends, work] },
      db,
    );

    expect(await groupsOf(id)).toEqual(["Друзья", "Работа"]);
  });

  it("skip a group that is gone or someone else's", async () => {
    const theirs = (await createGroup(stranger, "Чужая", db))!.id;

    const id = await createContact(
      owner,
      { name: "Анна", groupIds: [work, theirs, 12345] },
      db,
    );

    expect(await groupsOf(id)).toEqual(["Работа"]);
  });

  it("are replaced when the contact is edited", async () => {
    const id = await createContact(
      owner,
      { name: "Анна", groupIds: [work] },
      db,
    );

    await updateContact(owner, id, { name: "Анна", groupIds: [friends] }, db);
    expect(await groupsOf(id)).toEqual(["Друзья"]);

    await updateContact(owner, id, { name: "Анна", groupIds: [] }, db);
    expect(await groupsOf(id)).toEqual([]);
  });

  it("stay when an edit does not mention them", async () => {
    const id = await createContact(
      owner,
      { name: "Анна", groupIds: [work] },
      db,
    );

    await updateContact(owner, id, { name: "Анна Петрова" }, db);

    expect(await groupsOf(id)).toEqual(["Работа"]);
  });

  it("of someone else's contact cannot be changed", async () => {
    const theirGroup = (await createGroup(stranger, "Чужая", db))!.id;
    const theirs = await createContact(
      stranger,
      { name: "Анна Чужая", groupIds: [theirGroup] },
      db,
    );

    expect(
      await updateContact(
        owner,
        theirs,
        { name: "Взлом", groupIds: [work] },
        db,
      ),
    ).toBe(false);

    expect(
      (await listContactGroups(stranger, theirs, db)).map((group) => group.id),
    ).toEqual([theirGroup]);
  });

  it("get one more group from the card", async () => {
    const id = await createContact(
      owner,
      { name: "Анна", groupIds: [work] },
      db,
    );

    expect(await addContactToGroup(owner, id, friends, db)).toBe("added");

    expect(await groupsOf(id)).toEqual(["Друзья", "Работа"]);
  });

  it("do not mind the same group added twice", async () => {
    const id = await createContact(
      owner,
      { name: "Анна", groupIds: [work] },
      db,
    );

    expect(await addContactToGroup(owner, id, work, db)).toBe("added");

    expect(await groupsOf(id)).toEqual(["Работа"]);
  });

  it("lose one group from the card, the others stay", async () => {
    const id = await createContact(
      owner,
      { name: "Анна", groupIds: [work, friends] },
      db,
    );

    expect(await removeContactFromGroup(owner, id, work, db)).toBe(true);
    expect(await groupsOf(id)).toEqual(["Друзья"]);
    // Not in the group any more: nothing to do, and that is fine.
    expect(await removeContactFromGroup(owner, id, work, db)).toBe(true);
    expect(await groupsOf(id)).toEqual(["Друзья"]);
  });

  it("say which is gone when adding: the contact or the group", async () => {
    const id = await createContact(owner, { name: "Анна" }, db);
    const theirs = (await createGroup(stranger, "Чужая", db))!.id;
    await deleteGroup(owner, friends, db);

    expect(await addContactToGroup(owner, 12345, work, db)).toBe(
      "contact_missing",
    );
    expect(await addContactToGroup(owner, id, friends, db)).toBe(
      "group_missing",
    );
    expect(await addContactToGroup(owner, id, theirs, db)).toBe(
      "group_missing",
    );
    expect(await removeContactFromGroup(owner, 12345, work, db)).toBe(false);
    expect(await groupsOf(id)).toEqual([]);
  });

  it("of someone else's contact cannot be added to or taken from", async () => {
    const theirGroup = (await createGroup(stranger, "Чужая", db))!.id;
    const theirs = await createContact(
      stranger,
      { name: "Анна Чужая", groupIds: [theirGroup] },
      db,
    );

    expect(await addContactToGroup(owner, theirs, work, db)).toBe(
      "contact_missing",
    );
    expect(await addContactToGroup(owner, theirs, theirGroup, db)).toBe(
      "contact_missing",
    );
    expect(await removeContactFromGroup(owner, theirs, theirGroup, db)).toBe(
      false,
    );

    expect(
      (await listContactGroups(stranger, theirs, db)).map((group) => group.id),
    ).toEqual([theirGroup]);
  });

  it("are not saved when the contact fails to save", async () => {
    await db.$client.exec(`
      CREATE FUNCTION fail_notes() RETURNS trigger LANGUAGE plpgsql
        AS $$ BEGIN RAISE EXCEPTION 'boom'; END $$;
      CREATE TRIGGER fail_notes BEFORE INSERT ON notes
        FOR EACH ROW EXECUTE FUNCTION fail_notes();
    `);

    await expect(
      createContact(
        owner,
        { name: "Анна", groupIds: [work], firstNote: "Заметка" },
        db,
      ),
    ).rejects.toThrow();
    expect(await countContacts(owner, null, db)).toBe(0);
  });
});

describe("the list of one group", () => {
  let work: number;
  let friends: number;

  beforeEach(async () => {
    work = (await createGroup(owner, "Работа", db))!.id;
    friends = (await createGroup(owner, "Друзья", db))!.id;
    await createContact(
      owner,
      { name: "Анна Петрова", groupIds: [work, friends], keepInTouchDays: 30 },
      db,
    );
    await createContact(
      owner,
      { name: "Борис Ковалёв", groupIds: [work], keepInTouchDays: 14 },
      db,
    );
    await createContact(
      owner,
      { name: "Анна Жукова", groupIds: [friends] },
      db,
    );
    await createContact(
      owner,
      { name: "Вера Соколова", keepInTouchDays: 90 },
      db,
    );
    await createContact(owner, { name: "Анна Своя" }, db);
  });

  const inGroup = async (group: number | "none", query = "") =>
    (await searchContacts(owner, query, group, db)).map(
      (contact) => contact.name,
    );

  it("shows only the contacts in the group", async () => {
    expect(await inGroup(work)).toEqual(["Анна Петрова", "Борис Ковалёв"]);
    expect(await inGroup(friends)).toEqual(["Анна Жукова", "Анна Петрова"]);
  });

  it("shows the contacts without any group", async () => {
    expect(await inGroup("none")).toEqual(["Анна Своя", "Вера Соколова"]);
  });

  it("works together with the search", async () => {
    expect(await inGroup(work, "анн")).toEqual(["Анна Петрова"]);
    expect(await inGroup("none", "анн")).toEqual(["Анна Своя"]);
  });

  it("works together with the keep-in-touch list", async () => {
    const keepInTouch = async (group: number | "none") =>
      (await listKeepInTouch(owner, "", group, db)).map(
        (contact) => contact.name,
      );

    expect(await keepInTouch(work)).toEqual(["Анна Петрова", "Борис Ковалёв"]);
    expect(await keepInTouch(friends)).toEqual(["Анна Петрова"]);
    expect(await keepInTouch("none")).toEqual(["Вера Соколова"]);
  });

  it("is counted", async () => {
    expect(await countContacts(owner, null, db)).toBe(5);
    expect(await countContacts(owner, work, db)).toBe(2);
    expect(await countContacts(owner, "none", db)).toBe(2);
  });

  it("has none of another owner's contacts", async () => {
    await createContact(stranger, { name: "Анна Чужая" }, db);

    expect(await inGroup("none")).toEqual(["Анна Своя", "Вера Соколова"]);
    expect(await countContacts(owner, "none", db)).toBe(2);
  });
});
