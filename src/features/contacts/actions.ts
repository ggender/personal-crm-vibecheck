"use server";

import { revalidatePath } from "next/cache";
import { log } from "@/lib/log";
import * as contactsRepo from "./data/contacts-repo";
import * as notesRepo from "./data/notes-repo";
import {
  addNoteInput,
  createContactInput,
  fieldErrors,
  firstIssueMessage,
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
    const note = await notesRepo.addNote(contactId, body);
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
    const contactId = await contactsRepo.createContact(parsed.data);
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
    const updated = await contactsRepo.updateContact(id, fields);
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
