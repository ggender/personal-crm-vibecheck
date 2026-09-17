"use server";

import { revalidatePath } from "next/cache";
import { log } from "@/lib/log";
import * as notesRepo from "./data/notes-repo";
import { addNoteInput, firstIssueMessage } from "./validation";

export type ActionResult =
  { ok: true } | { ok: false; error: string; canRetry: boolean };

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
