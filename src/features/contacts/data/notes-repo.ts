import { and, count, desc, eq, inArray } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { contacts, notes } from "@/db/schema";

export type Note = {
  id: number;
  contactId: number;
  body: string;
  createdAt: Date;
};

// A note has no owner of its own: it belongs to the owner of its contact.

// Postgres error code foreign_key_violation.
const FOREIGN_KEY_VIOLATION = "23503";

function isForeignKeyError(error: unknown): boolean {
  let current: unknown = error;
  while (current instanceof Error) {
    if ((current as { code?: unknown }).code === FOREIGN_KEY_VIOLATION) {
      return true;
    }
    current = current.cause;
  }
  return false;
}

const noteColumns = {
  id: notes.id,
  contactId: notes.contactId,
  body: notes.body,
  createdAt: notes.createdAt,
};

function ownContactIds(ownerId: number, db: Db) {
  return db
    .select({ id: contacts.id })
    .from(contacts)
    .where(eq(contacts.ownerId, ownerId));
}

export async function listNotes(
  ownerId: number,
  contactId: number,
  db: Db = getDb(),
): Promise<Note[]> {
  return db
    .select(noteColumns)
    .from(notes)
    .innerJoin(contacts, eq(contacts.id, notes.contactId))
    .where(and(eq(notes.contactId, contactId), eq(contacts.ownerId, ownerId)))
    .orderBy(desc(notes.createdAt), desc(notes.id));
}

// Returns null when the contact is gone (e.g. deleted in another tab) or is
// someone else's.
export async function addNote(
  ownerId: number,
  contactId: number,
  body: string,
  db: Db = getDb(),
): Promise<Note | null> {
  const [contact] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.ownerId, ownerId)));
  if (!contact) {
    return null;
  }
  try {
    const [note] = await db
      .insert(notes)
      .values({ contactId, body: body.trim(), createdAt: new Date() })
      .returning();
    return note;
  } catch (error) {
    // Deleted between the check and the insert.
    if (isForeignKeyError(error)) {
      return null;
    }
    throw error;
  }
}

export async function deleteNote(
  ownerId: number,
  id: number,
  db: Db = getDb(),
): Promise<boolean> {
  const deleted = await db
    .delete(notes)
    .where(
      and(
        eq(notes.id, id),
        inArray(notes.contactId, ownContactIds(ownerId, db)),
      ),
    )
    .returning({ id: notes.id });
  return deleted.length > 0;
}

export async function countNotes(
  ownerId: number,
  contactId: number,
  db: Db = getDb(),
): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(notes)
    .innerJoin(contacts, eq(contacts.id, notes.contactId))
    .where(and(eq(notes.contactId, contactId), eq(contacts.ownerId, ownerId)));
  return row?.value ?? 0;
}
