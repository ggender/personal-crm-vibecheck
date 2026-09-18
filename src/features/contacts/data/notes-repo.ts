import { count, desc, eq } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { notes } from "@/db/schema";

export type Note = {
  id: number;
  contactId: number;
  body: string;
  createdAt: Date;
};

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

export async function listNotes(
  contactId: number,
  db: Db = getDb(),
): Promise<Note[]> {
  return db
    .select()
    .from(notes)
    .where(eq(notes.contactId, contactId))
    .orderBy(desc(notes.createdAt), desc(notes.id));
}

// Returns null when the contact is gone (e.g. deleted in another tab).
export async function addNote(
  contactId: number,
  body: string,
  db: Db = getDb(),
): Promise<Note | null> {
  try {
    const [note] = await db
      .insert(notes)
      .values({ contactId, body: body.trim(), createdAt: new Date() })
      .returning();
    return note;
  } catch (error) {
    if (isForeignKeyError(error)) {
      return null;
    }
    throw error;
  }
}

export async function deleteNote(
  id: number,
  db: Db = getDb(),
): Promise<boolean> {
  const deleted = await db
    .delete(notes)
    .where(eq(notes.id, id))
    .returning({ id: notes.id });
  return deleted.length > 0;
}

export async function countNotes(
  contactId: number,
  db: Db = getDb(),
): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(notes)
    .where(eq(notes.contactId, contactId));
  return row?.value ?? 0;
}
