// The only home for input rules and length limits. The server always checks;
// checks in the browser are a convenience.
import { z } from "zod";

export const LIMITS = {
  name: 200,
  metContext: 300,
  phone: 50,
  email: 200,
  note: 5000,
} as const;

const contactId = z
  .number({ error: "Не удалось понять, какой это контакт" })
  .int({ error: "Не удалось понять, какой это контакт" })
  .positive({ error: "Не удалось понять, какой это контакт" });

export const noteBody = z
  .string({ error: "Напиши текст заметки" })
  .trim()
  .min(1, { error: "Напиши текст заметки" })
  .max(LIMITS.note, {
    error: `Заметка длиннее ${LIMITS.note} знаков — сократи её`,
  });

export const addNoteInput = z.object({ contactId, body: noteBody });

export function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Проверь введённые данные";
}
