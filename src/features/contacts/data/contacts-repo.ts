import { and, asc, count, eq, sql } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { contacts, notes } from "@/db/schema";
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
  createdAt: Date;
  updatedAt: Date;
};

export type ContactListItem = Pick<Contact, "id" | "name" | "metContext">;

export type ContactFields = {
  name: string;
  metContext?: string;
  phone?: string;
  email?: string;
};

export type NewContact = ContactFields & { firstNote?: string };

// The one place that turns input into a stored row: name_search always
// follows the name. Also used by the seed script.
export function buildContactRow(fields: ContactFields, now: Date) {
  const name = fields.name.trim();
  return {
    name,
    nameSearch: normalizeName(name),
    metContext: fields.metContext ?? "",
    phone: fields.phone ?? "",
    email: fields.email ?? "",
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
  createdAt: contacts.createdAt,
  updatedAt: contacts.updatedAt,
};

export async function searchContacts(
  query: string,
  db: Db = getDb(),
): Promise<ContactListItem[]> {
  const conditions = splitSearchQuery(query).map(
    (word) =>
      sql`${contacts.nameSearch} LIKE ${`%${escapeLike(word)}%`} ESCAPE '\\'`,
  );
  return db
    .select({
      id: contacts.id,
      name: contacts.name,
      metContext: contacts.metContext,
    })
    .from(contacts)
    .where(and(...conditions))
    .orderBy(asc(contacts.nameSearch), asc(contacts.id))
    .all();
}

export async function countContacts(db: Db = getDb()): Promise<number> {
  return db.select({ value: count() }).from(contacts).get()?.value ?? 0;
}

export async function getContact(
  id: number,
  db: Db = getDb(),
): Promise<Contact | null> {
  return (
    db.select(contactColumns).from(contacts).where(eq(contacts.id, id)).get() ??
    null
  );
}

export async function createContact(
  input: NewContact,
  db: Db = getDb(),
): Promise<number> {
  const now = new Date();
  const firstNote = input.firstNote?.trim() ?? "";
  return db.transaction((tx) => {
    const { id } = tx
      .insert(contacts)
      .values(buildContactRow(input, now))
      .returning({ id: contacts.id })
      .get();
    if (firstNote !== "") {
      tx.insert(notes)
        .values({ contactId: id, body: firstNote, createdAt: now })
        .run();
    }
    return id;
  });
}

export async function updateContact(
  id: number,
  fields: ContactFields,
  db: Db = getDb(),
): Promise<boolean> {
  const { name, nameSearch, metContext, phone, email, updatedAt } =
    buildContactRow(fields, new Date());
  const result = db
    .update(contacts)
    .set({ name, nameSearch, metContext, phone, email, updatedAt })
    .where(eq(contacts.id, id))
    .run();
  return result.changes > 0;
}

// Notes go too: the foreign key is ON DELETE CASCADE.
export async function deleteContact(
  id: number,
  db: Db = getDb(),
): Promise<boolean> {
  const result = db.delete(contacts).where(eq(contacts.id, id)).run();
  return result.changes > 0;
}
