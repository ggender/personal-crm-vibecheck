// The only home for input rules and length limits. The server always checks;
// checks in the browser are a convenience.
import { z } from "zod";

export const LIMITS = {
  name: 200,
  metContext: 300,
  phone: 50,
  email: 200,
  note: 5000,
  groupName: 50,
} as const;

// How often to keep in touch, in days: the only choices the form offers.
export const KEEP_IN_TOUCH_DAYS = [14, 30, 90, 180, 365] as const;

const contactId = z
  .number({ error: "Не удалось понять, какой это контакт" })
  .int({ error: "Не удалось понять, какой это контакт" })
  .positive({ error: "Не удалось понять, какой это контакт" });

const groupId = z
  .number({ error: "Не удалось понять, какая это группа" })
  .int({ error: "Не удалось понять, какая это группа" })
  .positive({ error: "Не удалось понять, какая это группа" });

export const noteBody = z
  .string({ error: "Напиши текст заметки" })
  .trim()
  .min(1, { error: "Напиши текст заметки" })
  .max(LIMITS.note, {
    error: `Заметка длиннее ${LIMITS.note} знаков — сократи её`,
  });

export const addNoteInput = z.object({ contactId, body: noteBody });

export const deleteNoteInput = z.object({
  noteId: z
    .number({ error: "Не удалось понять, какая это заметка" })
    .int({ error: "Не удалось понять, какая это заметка" })
    .positive({ error: "Не удалось понять, какая это заметка" }),
});

export const deleteContactInput = z.object({ contactId });

export const markTalkedInput = z.object({ contactId });

const groupName = z
  .string({ error: "Напиши название группы" })
  .trim()
  .min(1, { error: "Напиши название группы" })
  .max(LIMITS.groupName, {
    error: `Название группы длиннее ${LIMITS.groupName} знаков — сократи его`,
  });

export const createGroupInput = z.object({ name: groupName });

export const renameGroupInput = z.object({ groupId, name: groupName });

export const deleteGroupInput = z.object({ groupId });

function optionalText(limit: number, label: string) {
  return z
    .string()
    .trim()
    .max(limit, { error: `${label} длиннее ${limit} знаков — сократи` })
    .default("");
}

const contactFields = {
  name: z
    .string({ error: "Укажи имя" })
    .trim()
    .min(1, { error: "Укажи имя" })
    .max(LIMITS.name, {
      error: `Имя длиннее ${LIMITS.name} знаков — сократи его`,
    }),
  metContext: optionalText(LIMITS.metContext, "«Откуда знакомы»"),
  phone: optionalText(LIMITS.phone, "Телефон"),
  email: optionalText(LIMITS.email, "Почта").refine(
    (value) => value === "" || value.includes("@"),
    { error: "В почте должен быть знак @" },
  ),
  // null means "не следить".
  keepInTouchDays: z
    .literal(KEEP_IN_TOUCH_DAYS, {
      error: "Выбери из списка, как часто общаться",
    })
    .nullable()
    .default(null),
  // The groups ticked in the form; none when not given.
  groupIds: z
    .array(groupId, { error: "Не удалось понять, какая это группа" })
    .default([]),
};

export const createContactInput = z.object({
  ...contactFields,
  firstNote: z
    .string()
    .trim()
    .max(LIMITS.note, {
      error: `Заметка длиннее ${LIMITS.note} знаков — сократи её`,
    })
    .default(""),
});

export const updateContactInput = z.object({ id: contactId, ...contactFields });

// One message per field, in the order the form shows them.
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !(field in errors)) {
      errors[field] = issue.message;
    }
  }
  return errors;
}

export function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Проверь введённые данные";
}
