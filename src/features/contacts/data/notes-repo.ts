import { count, desc, eq } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { notes } from "@/db/schema";

export type Note = {
  id: number;
  contactId: number;
  body: string;
  createdAt: Date;
};

function isForeignKeyError(error: unknown): boolean {
  let current: unknown = error;
  while (current instanceof Error) {
    if (
      (current as { code?: unknown }).code === "SQLITE_CONSTRAINT_FOREIGNKEY"
    ) {
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
    .orderBy(desc(notes.createdAt), desc(notes.id))
    .all();
}

// Returns null when the contact is gone (e.g. deleted in another tab).
export async function addNote(
  contactId: number,
  body: string,
  db: Db = getDb(),
): Promise<Note | null> {
  try {
    return db
      .insert(notes)
      .values({ contactId, body: body.trim(), createdAt: new Date() })
      .returning()
      .get();
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
  const result = db.delete(notes).where(eq(notes.id, id)).run();
  return result.changes > 0;
}

export async function countNotes(
  contactId: number,
  db: Db = getDb(),
): Promise<number> {
  return (
    db
      .select({ value: count() })
      .from(notes)
      .where(eq(notes.contactId, contactId))
      .get()?.value ?? 0
  );
}
