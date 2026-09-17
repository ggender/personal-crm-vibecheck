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
const { addNote } = await import("./actions");

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
