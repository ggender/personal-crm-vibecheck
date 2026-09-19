import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { contactGroups } from "@/db/schema";
import { createTestDb, createTestUser, type TestDb } from "@/db/test-db";
import { createContact, deleteContact, getContact } from "./contacts-repo";
import {
  createGroup,
  deleteGroup,
  listContactGroups,
  listGroups,
  renameGroup,
  type Group,
} from "./groups-repo";

let db: TestDb;
let owner: number;
let stranger: number;

beforeEach(async () => {
  db = await createTestDb();
  owner = await createTestUser(db, "owner@example.com");
  stranger = await createTestUser(db, "stranger@example.com");
});

afterEach(async () => {
  await db.$client.close();
});

async function newGroup(name: string, ownerId = owner): Promise<Group> {
  const group = await createGroup(ownerId, name, db);
  if (!group) {
    throw new Error(`Group ${name} was not created`);
  }
  return group;
}

async function groupNames(ownerId = owner): Promise<string[]> {
  return (await listGroups(ownerId, db)).map((group) => group.name);
}

async function contactGroupNames(contactId: number): Promise<string[]> {
  return (await listContactGroups(owner, contactId, db)).map(
    (group) => group.name,
  );
}

describe("createGroup", () => {
  it("trims the name and lists the new group", async () => {
    const group = await createGroup(owner, "  Работа ", db);

    expect(group).toEqual({ id: expect.any(Number), name: "Работа" });
    expect(await listGroups(owner, db)).toEqual([
      { id: group!.id, name: "Работа", contactCount: 0 },
    ]);
  });

  it("refuses a name the owner already has, whatever the case, ё or spaces", async () => {
    await newGroup("Семён и друзья");

    expect(await createGroup(owner, " семен  И ДРУЗЬЯ", db)).toBeNull();
    expect(await groupNames()).toEqual(["Семён и друзья"]);
  });

  it("lets different owners have groups with the same name", async () => {
    await newGroup("Работа", stranger);

    expect(await createGroup(owner, "Работа", db)).not.toBeNull();
  });
});

describe("listGroups", () => {
  it("lists groups alphabetically with how many contacts each has", async () => {
    const work = await newGroup("Работа");
    const friends = await newGroup("друзья");
    const tree = await newGroup("Ёлка");
    await createContact(
      owner,
      { name: "Анна", groupIds: [work.id, friends.id] },
      db,
    );
    await createContact(owner, { name: "Борис", groupIds: [work.id] }, db);
    await createContact(owner, { name: "Вера" }, db);

    expect(await listGroups(owner, db)).toEqual([
      { id: friends.id, name: "друзья", contactCount: 1 },
      { id: tree.id, name: "Ёлка", contactCount: 0 },
      { id: work.id, name: "Работа", contactCount: 2 },
    ]);
  });
});

describe("listContactGroups", () => {
  it("lists the groups of one contact alphabetically", async () => {
    const work = await newGroup("Работа");
    const friends = await newGroup("Друзья");
    await newGroup("Соседи");
    const anna = await createContact(
      owner,
      { name: "Анна", groupIds: [work.id, friends.id] },
      db,
    );

    expect(await listContactGroups(owner, anna, db)).toEqual([
      { id: friends.id, name: "Друзья" },
      { id: work.id, name: "Работа" },
    ]);
  });

  it("is empty for a contact without groups or a missing contact", async () => {
    const vera = await createContact(owner, { name: "Вера" }, db);

    expect(await listContactGroups(owner, vera, db)).toEqual([]);
    expect(await listContactGroups(owner, 12345, db)).toEqual([]);
  });
});

describe("renameGroup", () => {
  it("renames the group and keeps its contacts", async () => {
    const work = await newGroup("Работа");
    const anna = await createContact(
      owner,
      { name: "Анна", groupIds: [work.id] },
      db,
    );

    expect(await renameGroup(owner, work.id, "  Бывшая работа ", db)).toBe(
      "renamed",
    );

    expect(await contactGroupNames(anna)).toEqual(["Бывшая работа"]);
  });

  it("allows changing only the letter case", async () => {
    const work = await newGroup("работа");

    expect(await renameGroup(owner, work.id, "Работа", db)).toBe("renamed");
    expect(await groupNames()).toEqual(["Работа"]);
  });

  it("refuses a name another group of the owner has", async () => {
    const work = await newGroup("Работа");
    await newGroup("Друзья");

    expect(await renameGroup(owner, work.id, "ДРУЗЬЯ", db)).toBe("name_taken");
    expect(await groupNames()).toEqual(["Друзья", "Работа"]);
  });

  it("says when the group is gone", async () => {
    expect(await renameGroup(owner, 12345, "Работа", db)).toBe("missing");
  });
});

describe("deleteGroup", () => {
  it("removes the group but keeps its contacts", async () => {
    const work = await newGroup("Работа");
    const friends = await newGroup("Друзья");
    const anna = await createContact(
      owner,
      { name: "Анна", groupIds: [work.id, friends.id] },
      db,
    );

    expect(await deleteGroup(owner, work.id, db)).toBe(true);

    expect(await groupNames()).toEqual(["Друзья"]);
    expect(await getContact(owner, anna, db)).toMatchObject({ name: "Анна" });
    expect(await contactGroupNames(anna)).toEqual(["Друзья"]);
  });

  it("returns false for a missing group", async () => {
    expect(await deleteGroup(owner, 12345, db)).toBe(false);
  });
});

describe("deleting a contact", () => {
  it("takes it out of its groups", async () => {
    const work = await newGroup("Работа");
    const anna = await createContact(
      owner,
      { name: "Анна", groupIds: [work.id] },
      db,
    );

    await deleteContact(owner, anna, db);

    expect(await listGroups(owner, db)).toEqual([
      { id: work.id, name: "Работа", contactCount: 0 },
    ]);
    expect(await db.select().from(contactGroups)).toEqual([]);
  });
});

describe("another owner's groups", () => {
  let theirs: Group;
  let theirContact: number;

  beforeEach(async () => {
    theirs = await newGroup("Чужая группа", stranger);
    theirContact = await createContact(
      stranger,
      { name: "Анна Чужая", groupIds: [theirs.id] },
      db,
    );
  });

  it("are not listed", async () => {
    expect(await listGroups(owner, db)).toEqual([]);
    expect(await listContactGroups(owner, theirContact, db)).toEqual([]);
  });

  it("cannot be renamed or deleted", async () => {
    expect(await renameGroup(owner, theirs.id, "Взлом", db)).toBe("missing");
    expect(await deleteGroup(owner, theirs.id, db)).toBe(false);

    expect(await listGroups(stranger, db)).toEqual([
      { id: theirs.id, name: "Чужая группа", contactCount: 1 },
    ]);
  });
});
