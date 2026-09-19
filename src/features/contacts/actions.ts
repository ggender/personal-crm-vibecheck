"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/features/auth/session";
import { log } from "@/lib/log";
import * as contactsRepo from "./data/contacts-repo";
import * as groupsRepo from "./data/groups-repo";
import * as notesRepo from "./data/notes-repo";
import {
  addNoteInput,
  createContactInput,
  createGroupInput,
  deleteContactInput,
  deleteGroupInput,
  deleteNoteInput,
  fieldErrors,
  firstIssueMessage,
  markTalkedInput,
  renameGroupInput,
  updateContactInput,
} from "./validation";

export type ActionResult =
  { ok: true } | { ok: false; error: string; canRetry: boolean };

export type FormResult =
  | { ok: true; contactId: number }
  | { ok: false; error: string; canRetry: boolean }
  | { ok: false; fieldErrors: Record<string, string>; canRetry: false };

export type CreateGroupResult =
  | { ok: true; groupId: number }
  | { ok: false; error: string; canRetry: boolean };

function lengthOf(value: unknown): number | undefined {
  return typeof value === "string" ? value.length : undefined;
}

function idOf(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

// The page is still open, but the session has ended (expired or signed out
// in another tab). The typed text stays in the form.
const SIGNED_OUT = {
  ok: false,
  error: "Вход истёк — войди снова",
  canRetry: false,
} as const;

function signedOut() {
  log.warn("auth", "session.missing");
  return SIGNED_OUT;
}

// The owner of everything the action may touch; null when signed out.
async function currentOwnerId(): Promise<number | null> {
  return (await getCurrentUser())?.id ?? null;
}

export async function addNote(input: {
  contactId: number;
  body: string;
}): Promise<ActionResult> {
  const parsed = addNoteInput.safeParse(input);
  if (!parsed.success) {
    log.warn("notes", "note.rejected", {
      contactId: idOf(input?.contactId),
      length: lengthOf(input?.body),
      issueCount: parsed.error.issues.length,
    });
    return {
      ok: false,
      error: firstIssueMessage(parsed.error),
      canRetry: false,
    };
  }

  const { contactId, body } = parsed.data;
  try {
    const ownerId = await currentOwnerId();
    if (ownerId === null) {
      return signedOut();
    }
    const note = await notesRepo.addNote(ownerId, contactId, body);
    revalidatePath("/");
    if (!note) {
      log.warn("notes", "note.contact_missing", { contactId });
      return {
        ok: false,
        error: "Такого контакта больше нет — заметку некуда сохранить",
        canRetry: false,
      };
    }
    log.info("notes", "note.added", {
      noteId: note.id,
      contactId,
      length: note.body.length,
    });
    return { ok: true };
  } catch (error) {
    log.error("notes", "note.add_failed", error, { contactId });
    return {
      ok: false,
      error: "Не удалось сохранить заметку",
      canRetry: true,
    };
  }
}

export async function createContact(input: unknown): Promise<FormResult> {
  const parsed = createContactInput.safeParse(input);
  if (!parsed.success) {
    log.warn("contacts", "contact.rejected", {
      issueCount: parsed.error.issues.length,
    });
    return {
      ok: false,
      fieldErrors: fieldErrors(parsed.error),
      canRetry: false,
    };
  }

  try {
    const ownerId = await currentOwnerId();
    if (ownerId === null) {
      return signedOut();
    }
    const contactId = await contactsRepo.createContact(ownerId, parsed.data);
    revalidatePath("/");
    log.info("contacts", "contact.created", {
      contactId,
      withFirstNote: parsed.data.firstNote !== "",
      groupCount: parsed.data.groupIds.length,
    });
    return { ok: true, contactId };
  } catch (error) {
    log.error("contacts", "contact.create_failed", error);
    return { ok: false, error: "Не удалось сохранить контакт", canRetry: true };
  }
}

export async function updateContact(input: unknown): Promise<FormResult> {
  const parsed = updateContactInput.safeParse(input);
  if (!parsed.success) {
    log.warn("contacts", "contact.rejected", {
      issueCount: parsed.error.issues.length,
    });
    return {
      ok: false,
      fieldErrors: fieldErrors(parsed.error),
      canRetry: false,
    };
  }

  const { id, ...fields } = parsed.data;
  try {
    const ownerId = await currentOwnerId();
    if (ownerId === null) {
      return signedOut();
    }
    const updated = await contactsRepo.updateContact(ownerId, id, fields);
    revalidatePath("/");
    if (!updated) {
      log.warn("contacts", "contact.missing", { contactId: id });
      return {
        ok: false,
        error: "Такого контакта больше нет",
        canRetry: false,
      };
    }
    log.info("contacts", "contact.updated", {
      contactId: id,
      groupCount: fields.groupIds.length,
    });
    return { ok: true, contactId: id };
  } catch (error) {
    log.error("contacts", "contact.update_failed", error, { contactId: id });
    return {
      ok: false,
      error: "Не удалось сохранить изменения",
      canRetry: true,
    };
  }
}

export async function deleteNote(input: {
  noteId: number;
}): Promise<ActionResult> {
  const parsed = deleteNoteInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: firstIssueMessage(parsed.error),
      canRetry: false,
    };
  }

  const { noteId } = parsed.data;
  try {
    const ownerId = await currentOwnerId();
    if (ownerId === null) {
      return signedOut();
    }
    const deleted = await notesRepo.deleteNote(ownerId, noteId);
    revalidatePath("/");
    if (!deleted) {
      log.warn("notes", "note.missing", { noteId });
      return { ok: false, error: "Этой заметки уже нет", canRetry: false };
    }
    log.info("notes", "note.deleted", { noteId });
    return { ok: true };
  } catch (error) {
    log.error("notes", "note.delete_failed", error, { noteId });
    return { ok: false, error: "Не удалось удалить заметку", canRetry: true };
  }
}

// «Пообщались»: talked without writing a note.
export async function markTalked(input: {
  contactId: number;
}): Promise<ActionResult> {
  const parsed = markTalkedInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: firstIssueMessage(parsed.error),
      canRetry: false,
    };
  }

  const { contactId } = parsed.data;
  try {
    const ownerId = await currentOwnerId();
    if (ownerId === null) {
      return signedOut();
    }
    const marked = await contactsRepo.markTalked(ownerId, contactId);
    revalidatePath("/");
    if (!marked) {
      log.warn("contacts", "contact.missing", { contactId });
      return {
        ok: false,
        error: "Такого контакта больше нет",
        canRetry: false,
      };
    }
    log.info("contacts", "contact.talked", { contactId });
    return { ok: true };
  } catch (error) {
    log.error("contacts", "contact.talk_failed", error, { contactId });
    return { ok: false, error: "Не удалось отметить", canRetry: true };
  }
}

// The notes of the contact go with it: the foreign key is ON DELETE CASCADE.
export async function deleteContact(input: {
  contactId: number;
}): Promise<ActionResult> {
  const parsed = deleteContactInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: firstIssueMessage(parsed.error),
      canRetry: false,
    };
  }

  const { contactId } = parsed.data;
  try {
    const ownerId = await currentOwnerId();
    if (ownerId === null) {
      return signedOut();
    }
    const deleted = await contactsRepo.deleteContact(ownerId, contactId);
    revalidatePath("/");
    if (!deleted) {
      log.warn("contacts", "contact.missing", { contactId });
      return {
        ok: false,
        error: "Такого контакта больше нет",
        canRetry: false,
      };
    }
    log.info("contacts", "contact.deleted", { contactId });
    return { ok: true };
  } catch (error) {
    log.error("contacts", "contact.delete_failed", error, { contactId });
    return { ok: false, error: "Не удалось удалить контакт", canRetry: true };
  }
}

function nameTaken(name: string) {
  return {
    ok: false,
    error: `Группа «${name}» уже есть`,
    canRetry: false,
  } as const;
}

const GROUP_MISSING = {
  ok: false,
  error: "Такой группы больше нет",
  canRetry: false,
} as const;

export async function createGroup(input: {
  name: string;
}): Promise<CreateGroupResult> {
  const parsed = createGroupInput.safeParse(input);
  if (!parsed.success) {
    log.warn("groups", "group.rejected", {
      length: lengthOf(input?.name),
      issueCount: parsed.error.issues.length,
    });
    return {
      ok: false,
      error: firstIssueMessage(parsed.error),
      canRetry: false,
    };
  }

  const { name } = parsed.data;
  try {
    const ownerId = await currentOwnerId();
    if (ownerId === null) {
      return signedOut();
    }
    const group = await groupsRepo.createGroup(ownerId, name);
    if (!group) {
      log.warn("groups", "group.name_taken", { length: name.length });
      return nameTaken(name);
    }
    revalidatePath("/");
    log.info("groups", "group.created", {
      groupId: group.id,
      length: name.length,
    });
    return { ok: true, groupId: group.id };
  } catch (error) {
    log.error("groups", "group.create_failed", error);
    return { ok: false, error: "Не удалось создать группу", canRetry: true };
  }
}

export async function renameGroup(input: {
  groupId: number;
  name: string;
}): Promise<ActionResult> {
  const parsed = renameGroupInput.safeParse(input);
  if (!parsed.success) {
    log.warn("groups", "group.rejected", {
      groupId: idOf(input?.groupId),
      length: lengthOf(input?.name),
      issueCount: parsed.error.issues.length,
    });
    return {
      ok: false,
      error: firstIssueMessage(parsed.error),
      canRetry: false,
    };
  }

  const { groupId, name } = parsed.data;
  try {
    const ownerId = await currentOwnerId();
    if (ownerId === null) {
      return signedOut();
    }
    const result = await groupsRepo.renameGroup(ownerId, groupId, name);
    if (result === "name_taken") {
      log.warn("groups", "group.name_taken", { groupId, length: name.length });
      return nameTaken(name);
    }
    revalidatePath("/");
    if (result === "missing") {
      log.warn("groups", "group.missing", { groupId });
      return GROUP_MISSING;
    }
    log.info("groups", "group.renamed", { groupId, length: name.length });
    return { ok: true };
  } catch (error) {
    log.error("groups", "group.rename_failed", error, { groupId });
    return {
      ok: false,
      error: "Не удалось переименовать группу",
      canRetry: true,
    };
  }
}

// The contacts of the group stay; only the group goes.
export async function deleteGroup(input: {
  groupId: number;
}): Promise<ActionResult> {
  const parsed = deleteGroupInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: firstIssueMessage(parsed.error),
      canRetry: false,
    };
  }

  const { groupId } = parsed.data;
  try {
    const ownerId = await currentOwnerId();
    if (ownerId === null) {
      return signedOut();
    }
    const deleted = await groupsRepo.deleteGroup(ownerId, groupId);
    revalidatePath("/");
    if (!deleted) {
      log.warn("groups", "group.missing", { groupId });
      return GROUP_MISSING;
    }
    log.info("groups", "group.deleted", { groupId });
    return { ok: true };
  } catch (error) {
    log.error("groups", "group.delete_failed", error, { groupId });
    return { ok: false, error: "Не удалось удалить группу", canRetry: true };
  }
}
