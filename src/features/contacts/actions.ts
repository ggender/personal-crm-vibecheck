"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/features/auth/session";
import { log } from "@/lib/log";
import * as contactsRepo from "./data/contacts-repo";
import * as notesRepo from "./data/notes-repo";
import {
  addNoteInput,
  createContactInput,
  deleteContactInput,
  deleteNoteInput,
  fieldErrors,
  firstIssueMessage,
  markTalkedInput,
  updateContactInput,
} from "./validation";

export type ActionResult =
  { ok: true } | { ok: false; error: string; canRetry: boolean };

export type FormResult =
  | { ok: true; contactId: number }
  | { ok: false; error: string; canRetry: boolean }
  | { ok: false; fieldErrors: Record<string, string>; canRetry: false };

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
    log.info("contacts", "contact.updated", { contactId: id });
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
