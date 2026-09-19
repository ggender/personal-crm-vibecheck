import { and, asc, count, eq, ne } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { contactGroups, groups } from "@/db/schema";
import { normalizeName } from "../normalize-name";

export type Group = {
  id: number;
  name: string;
};

export type GroupWithCount = Group & { contactCount: number };

export type RenameGroupResult = "renamed" | "missing" | "name_taken";

// Someone else's group looks exactly like a missing one.
function isOwned(ownerId: number, id: number) {
  return and(eq(groups.ownerId, ownerId), eq(groups.id, id));
}

// Alphabetically, with how many contacts each group has.
export async function listGroups(
  ownerId: number,
  db: Db = getDb(),
): Promise<GroupWithCount[]> {
  return db
    .select({
      id: groups.id,
      name: groups.name,
      contactCount: count(contactGroups.contactId),
    })
    .from(groups)
    .leftJoin(contactGroups, eq(contactGroups.groupId, groups.id))
    .where(eq(groups.ownerId, ownerId))
    .groupBy(groups.id)
    .orderBy(asc(groups.nameSearch), asc(groups.id));
}

export async function listContactGroups(
  ownerId: number,
  contactId: number,
  db: Db = getDb(),
): Promise<Group[]> {
  return db
    .select({ id: groups.id, name: groups.name })
    .from(contactGroups)
    .innerJoin(groups, eq(groups.id, contactGroups.groupId))
    .where(
      and(eq(contactGroups.contactId, contactId), eq(groups.ownerId, ownerId)),
    )
    .orderBy(asc(groups.nameSearch), asc(groups.id));
}

// Returns null when the owner already has a group with this name: case, ё
// and extra spaces do not make a new name.
export async function createGroup(
  ownerId: number,
  name: string,
  db: Db = getDb(),
): Promise<Group | null> {
  const trimmed = name.trim();
  const [group] = await db
    .insert(groups)
    .values({ ownerId, name: trimmed, nameSearch: normalizeName(trimmed) })
    .onConflictDoNothing({ target: [groups.ownerId, groups.nameSearch] })
    .returning({ id: groups.id, name: groups.name });
  return group ?? null;
}

export async function renameGroup(
  ownerId: number,
  id: number,
  name: string,
  db: Db = getDb(),
): Promise<RenameGroupResult> {
  const trimmed = name.trim();
  const nameSearch = normalizeName(trimmed);
  const [taken] = await db
    .select({ id: groups.id })
    .from(groups)
    .where(
      and(
        eq(groups.ownerId, ownerId),
        eq(groups.nameSearch, nameSearch),
        ne(groups.id, id),
      ),
    );
  if (taken) {
    return "name_taken";
  }
  const renamed = await db
    .update(groups)
    .set({ name: trimmed, nameSearch })
    .where(isOwned(ownerId, id))
    .returning({ id: groups.id });
  return renamed.length > 0 ? "renamed" : "missing";
}

// The contacts stay: only their links to the group go (ON DELETE CASCADE).
export async function deleteGroup(
  ownerId: number,
  id: number,
  db: Db = getDb(),
): Promise<boolean> {
  const deleted = await db
    .delete(groups)
    .where(isOwned(ownerId, id))
    .returning({ id: groups.id });
  return deleted.length > 0;
}
