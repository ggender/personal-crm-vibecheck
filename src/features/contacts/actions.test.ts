import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./data/notes-repo", () => ({
  addNote: vi.fn(),
  deleteNote: vi.fn(),
}));
vi.mock("./data/contacts-repo", () => ({
  createContact: vi.fn(),
  updateContact: vi.fn(),
  deleteContact: vi.fn(),
}));

const { revalidatePath } = await import("next/cache");
const notesRepo = await import("./data/notes-repo");
const contactsRepo = await import("./data/contacts-repo");
const { addNote, createContact, updateContact, deleteNote, deleteContact } =
  await import("./actions");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("addNote action", () => {
  it("saves a valid note and refreshes the page", async () => {
    vi.mocked(notesRepo.addNote).mockResolvedValue({
      id: 7,
      contactId: 3,
      body: "Созвон",
      createdAt: new Date(),
    });

    const result = await addNote({ contactId: 3, body: "  Созвон " });

    expect(result).toEqual({ ok: true });
    expect(notesRepo.addNote).toHaveBeenCalledWith(3, "Созвон");
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("refuses invalid input without touching the database", async () => {
    const result = await addNote({ contactId: 3, body: "   " });

    expect(result).toEqual({
      ok: false,
      error: "Напиши текст заметки",
      canRetry: false,
    });
    expect(notesRepo.addNote).not.toHaveBeenCalled();
  });

  it("explains that the contact is gone", async () => {
    vi.mocked(notesRepo.addNote).mockResolvedValue(null);

    const result = await addNote({ contactId: 3, body: "Созвон" });

    expect(result).toEqual({
      ok: false,
      error: "Такого контакта больше нет — заметку некуда сохранить",
      canRetry: false,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("turns an unexpected failure into a retryable message", async () => {
    vi.mocked(notesRepo.addNote).mockRejectedValue(new Error("disk full"));

    const result = await addNote({ contactId: 3, body: "Созвон" });

    expect(result).toEqual({
      ok: false,
      error: "Не удалось сохранить заметку",
      canRetry: true,
    });
  });
});

describe("createContact action", () => {
  it("creates the contact with its first note", async () => {
    vi.mocked(contactsRepo.createContact).mockResolvedValue(1000);

    const result = await createContact({
      name: " Марк Орлов ",
      metContext: "Митап",
      phone: "",
      email: "",
      firstNote: "Пришлёт ссылку",
    });

    expect(result).toEqual({ ok: true, contactId: 1000 });
    expect(contactsRepo.createContact).toHaveBeenCalledWith({
      name: "Марк Орлов",
      metContext: "Митап",
      phone: "",
      email: "",
      firstNote: "Пришлёт ссылку",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("returns field errors and saves nothing", async () => {
    const result = await createContact({ name: "  ", email: "нет-собаки" });

    expect(result).toEqual({
      ok: false,
      fieldErrors: {
        name: "Укажи имя",
        email: "В почте должен быть знак @",
      },
      canRetry: false,
    });
    expect(contactsRepo.createContact).not.toHaveBeenCalled();
  });

  it("turns an unexpected failure into a retryable message", async () => {
    vi.mocked(contactsRepo.createContact).mockRejectedValue(new Error("busy"));

    expect(await createContact({ name: "Марк" })).toEqual({
      ok: false,
      error: "Не удалось сохранить контакт",
      canRetry: true,
    });
  });
});

describe("updateContact action", () => {
  it("updates an existing contact", async () => {
    vi.mocked(contactsRepo.updateContact).mockResolvedValue(true);

    const result = await updateContact({ id: 7, name: "Марк Орлов-Соколов" });

    expect(result).toEqual({ ok: true, contactId: 7 });
    expect(contactsRepo.updateContact).toHaveBeenCalledWith(7, {
      name: "Марк Орлов-Соколов",
      metContext: "",
      phone: "",
      email: "",
    });
  });

  it("says when the contact is gone", async () => {
    vi.mocked(contactsRepo.updateContact).mockResolvedValue(false);

    expect(await updateContact({ id: 7, name: "Марк" })).toEqual({
      ok: false,
      error: "Такого контакта больше нет",
      canRetry: false,
    });
  });

  it("turns an unexpected failure into a retryable message", async () => {
    vi.mocked(contactsRepo.updateContact).mockRejectedValue(new Error("busy"));

    expect(await updateContact({ id: 7, name: "Марк" })).toEqual({
      ok: false,
      error: "Не удалось сохранить изменения",
      canRetry: true,
    });
  });
});

describe("deleteNote action", () => {
  it("deletes the note and refreshes the page", async () => {
    vi.mocked(notesRepo.deleteNote).mockResolvedValue(true);

    expect(await deleteNote({ noteId: 5 })).toEqual({ ok: true });
    expect(notesRepo.deleteNote).toHaveBeenCalledWith(5);
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("says when the note is already gone", async () => {
    vi.mocked(notesRepo.deleteNote).mockResolvedValue(false);

    expect(await deleteNote({ noteId: 5 })).toEqual({
      ok: false,
      error: "Этой заметки уже нет",
      canRetry: false,
    });
  });

  it("turns an unexpected failure into a retryable message", async () => {
    vi.mocked(notesRepo.deleteNote).mockRejectedValue(new Error("locked"));

    expect(await deleteNote({ noteId: 5 })).toEqual({
      ok: false,
      error: "Не удалось удалить заметку",
      canRetry: true,
    });
  });
});

describe("deleteContact action", () => {
  it("deletes the contact with its notes", async () => {
    vi.mocked(contactsRepo.deleteContact).mockResolvedValue(true);

    expect(await deleteContact({ contactId: 9 })).toEqual({ ok: true });
    expect(contactsRepo.deleteContact).toHaveBeenCalledWith(9);
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("says when the contact is already gone", async () => {
    vi.mocked(contactsRepo.deleteContact).mockResolvedValue(false);

    expect(await deleteContact({ contactId: 9 })).toEqual({
      ok: false,
      error: "Такого контакта больше нет",
      canRetry: false,
    });
  });

  it("refuses a broken id without touching the database", async () => {
    expect(await deleteContact({ contactId: 0 })).toMatchObject({ ok: false });
    expect(contactsRepo.deleteContact).not.toHaveBeenCalled();
  });

  it("turns an unexpected failure into a retryable message", async () => {
    vi.mocked(contactsRepo.deleteContact).mockRejectedValue(
      new Error("locked"),
    );

    expect(await deleteContact({ contactId: 9 })).toEqual({
      ok: false,
      error: "Не удалось удалить контакт",
      canRetry: true,
    });
  });
});

describe("action logs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("carry ids and lengths, never names, contact details or note texts", async () => {
    vi.stubEnv("LOG_LEVEL", "debug");
    const lines: string[] = [];
    for (const method of ["log", "warn", "error"] as const) {
      vi.spyOn(console, method).mockImplementation((line: unknown) => {
        lines.push(String(line));
      });
    }
    const contact = {
      name: "Анна Петрова",
      metContext: "Соседка по даче",
      phone: "+7 900 555-12-34",
      email: "anna@example.com",
    };
    const note = "Обещала вернуть дрель";
    // Like Drizzle's errors: the query params are in the message.
    const queryError = new Error(
      `Failed query: insert into "contacts" params: ${Object.values(contact).join(",")},${note}`,
      { cause: new Error("database is locked") },
    );

    vi.mocked(contactsRepo.createContact)
      .mockResolvedValueOnce(1000)
      .mockRejectedValueOnce(queryError);
    await createContact({ ...contact, firstNote: note });
    await createContact({ ...contact, firstNote: note });
    await createContact({ ...contact, email: "anna-example.com" });

    vi.mocked(contactsRepo.updateContact)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(queryError);
    await updateContact({ id: 7, ...contact });
    await updateContact({ id: 7, ...contact });
    await updateContact({ id: 7, ...contact });

    vi.mocked(notesRepo.addNote)
      .mockResolvedValueOnce({
        id: 5,
        contactId: 7,
        body: note,
        createdAt: new Date(),
      })
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(queryError);
    await addNote({ contactId: 7, body: note });
    await addNote({ contactId: 7, body: note });
    await addNote({ contactId: 7, body: note });
    await addNote({ contactId: 7, body: note.repeat(300) });

    const output = lines.join("\n");
    // Every path above was logged, so the check below is not empty.
    for (const event of [
      "contact.created",
      "contact.create_failed",
      "contact.rejected",
      "contact.updated",
      "contact.missing",
      "contact.update_failed",
      "note.added",
      "note.contact_missing",
      "note.add_failed",
      "note.rejected",
    ]) {
      expect(output).toContain(event);
    }
    for (const personal of [...Object.values(contact), note]) {
      expect(output).not.toContain(personal);
    }
  });
});
