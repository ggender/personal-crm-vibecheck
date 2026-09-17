import { beforeEach, describe, expect, it, vi } from "vitest";

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
const { addNote, createContact, updateContact } = await import("./actions");

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
