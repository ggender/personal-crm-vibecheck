import {
  and,
  asc,
  count,
  eq,
  exists,
  inArray,
  isNotNull,
  max,
  notExists,
  sql,
} from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { contactGroups, contacts, groups, notes } from "@/db/schema";
import {
  escapeLike,
  normalizeName,
  splitSearchQuery,
} from "../normalize-name";

export type Contact = {
  id: number;
  name: string;
  metContext: string;
  phone: string;
  email: string;
  keepInTouchDays: number | null;
  talkedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ContactListItem = Pick<Contact, "id" | "name" | "metContext">;

// A contact with a rhythm and the times keep-in-touch.ts counts from.
export type KeepInTouchItem = ContactListItem & {
  keepInTouchDays: number;
  createdAt: Date;
  talkedAt: Date | null;
  lastNoteAt: Date | null;
};

export type ContactFields = {
  name: string;
  metContext?: string;
  phone?: string;
  email?: string;
  keepInTouchDays?: number | null;
  // The contact's groups replace the old ones; not given — they stay.
  groupIds?: number[];
};

// Which contacts the list shows: everyone (null), the contacts of one
// group, or the contacts without any group ("none").
export type GroupFilter = number | "none" | null;

export type NewContact = ContactFields & { firstNote?: string };

// The one place that turns input into a stored row: name_search always
// follows the name. Also used by the seed script. The owner is added by the
// caller.
export function buildContactRow(fields: ContactFields, now: Date) {
  const name = fields.name.trim();
  return {
    name,
    nameSearch: normalizeName(name),
    metContext: fields.metContext ?? "",
    phone: fields.phone ?? "",
    email: fields.email ?? "",
    keepInTouchDays: fields.keepInTouchDays ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

const contactColumns = {
  id: contacts.id,
  name: contacts.name,
  metContext: contacts.metContext,
  phone: contacts.phone,
  email: contacts.email,
  keepInTouchDays: contacts.keepInTouchDays,
  talkedAt: contacts.talkedAt,
  createdAt: contacts.createdAt,
  updatedAt: contacts.updatedAt,
};

// Someone else's contact looks exactly like a missing one.
function isOwned(ownerId: number, id: number) {
  return and(eq(contacts.ownerId, ownerId), eq(contacts.id, id));
}

function inGroup(group: GroupFilter, db: Db) {
  if (group === null) {
    return [];
  }
  const links = db
    .select({ contactId: contactGroups.contactId })
    .from(contactGroups);
  if (group === "none") {
    return [notExists(links.where(eq(contactGroups.contactId, contacts.id)))];
  }
  return [
    exists(
      links.where(
        and(
          eq(contactGroups.contactId, contacts.id),
          eq(contactGroups.groupId, group),
        ),
      ),
    ),
  ];
}

// Only the owner's own groups are linked: one that is gone (deleted in
// another tab) or someone else's is skipped.
async function replaceGroups(
  ownerId: number,
  contactId: number,
  groupIds: number[],
  db: Db,
): Promise<void> {
  await db.delete(contactGroups).where(eq(contactGroups.contactId, contactId));
  if (groupIds.length === 0) {
    return;
  }
  await db.insert(contactGroups).select(
    db
      .select({
        contactId: sql<number>`cast(${contactId} as integer)`.as("contact_id"),
        groupId: groups.id,
      })
      .from(groups)
      .where(and(eq(groups.ownerId, ownerId), inArray(groups.id, groupIds))),
  );
}

// Every word of the query must be part of the name.
function nameMatches(query: string) {
  return splitSearchQuery(query).map(
    (word) =>
      sql`${contacts.nameSearch} LIKE ${`%${escapeLike(word)}%`} ESCAPE '\\'`,
  );
}

export async function searchContacts(
  ownerId: number,
  query: string,
  group: GroupFilter,
  db: Db = getDb(),
): Promise<ContactListItem[]> {
  return db
    .select({
      id: contacts.id,
      name: contacts.name,
      metContext: contacts.metContext,
    })
    .from(contacts)
    .where(
      and(
        eq(contacts.ownerId, ownerId),
        ...nameMatches(query),
        ...inGroup(group, db),
      ),
    )
    .orderBy(asc(contacts.nameSearch), asc(contacts.id));
}

// Contacts with a rhythm, alphabetically; which of them are due is decided
// by keep-in-touch.ts.
export async function listKeepInTouch(
  ownerId: number,
  query: string,
  group: GroupFilter,
  db: Db = getDb(),
): Promise<KeepInTouchItem[]> {
  const rows = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      metContext: contacts.metContext,
      keepInTouchDays: contacts.keepInTouchDays,
      createdAt: contacts.createdAt,
      talkedAt: contacts.talkedAt,
      lastNoteAt: max(notes.createdAt),
    })
    .from(contacts)
    .leftJoin(notes, eq(notes.contactId, contacts.id))
    .where(
      and(
        eq(contacts.ownerId, ownerId),
        isNotNull(contacts.keepInTouchDays),
        ...nameMatches(query),
        ...inGroup(group, db),
      ),
    )
    .groupBy(contacts.id)
    .orderBy(asc(contacts.nameSearch), asc(contacts.id));
  return rows.flatMap(({ keepInTouchDays, ...row }) =>
    keepInTouchDays === null ? [] : [{ ...row, keepInTouchDays }],
  );
}

export async function countContacts(
  ownerId: number,
  group: GroupFilter,
  db: Db = getDb(),
): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(contacts)
    .where(and(eq(contacts.ownerId, ownerId), ...inGroup(group, db)));
  return row?.value ?? 0;
}

export async function getContact(
  ownerId: number,
  id: number,
  db: Db = getDb(),
): Promise<Contact | null> {
  const [contact] = await db
    .select(contactColumns)
    .from(contacts)
    .where(isOwned(ownerId, id));
  return contact ?? null;
}

export async function createContact(
  ownerId: number,
  input: NewContact,
  db: Db = getDb(),
): Promise<number> {
  const now = new Date();
  const firstNote = input.firstNote?.trim() ?? "";
  return db.transaction(async (tx) => {
    const [{ id }] = await tx
      .insert(contacts)
      .values({ ...buildContactRow(input, now), ownerId })
      .returning({ id: contacts.id });
    await replaceGroups(ownerId, id, input.groupIds ?? [], tx);
    if (firstNote !== "") {
      await tx
        .insert(notes)
        .values({ contactId: id, body: firstNote, createdAt: now });
    }
    return id;
  });
}

export async function updateContact(
  ownerId: number,
  id: number,
  fields: ContactFields,
  db: Db = getDb(),
): Promise<boolean> {
  const {
    name,
    nameSearch,
    metContext,
    phone,
    email,
    keepInTouchDays,
    updatedAt,
  } = buildContactRow(fields, new Date());
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(contacts)
      .set({
        name,
        nameSearch,
        metContext,
        phone,
        email,
        keepInTouchDays,
        updatedAt,
      })
      .where(isOwned(ownerId, id))
      .returning({ id: contacts.id });
    if (updated.length === 0) {
      return false;
    }
    if (fields.groupIds !== undefined) {
      await replaceGroups(ownerId, id, fields.groupIds, tx);
    }
    return true;
  });
}

// «Пообщались»: restarts the keep-in-touch clock. Not an edit of the
// contact, so updated_at stays.
export async function markTalked(
  ownerId: number,
  id: number,
  db: Db = getDb(),
): Promise<boolean> {
  const marked = await db
    .update(contacts)
    .set({ talkedAt: new Date() })
    .where(isOwned(ownerId, id))
    .returning({ id: contacts.id });
  return marked.length > 0;
}

// Notes and links to groups go too: the foreign keys are ON DELETE CASCADE.
export async function deleteContact(
  ownerId: number,
  id: number,
  db: Db = getDb(),
): Promise<boolean> {
  const deleted = await db
    .delete(contacts)
    .where(isOwned(ownerId, id))
    .returning({ id: contacts.id });
  return deleted.length > 0;
}
