import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./data/notes-repo", () => ({
  addNote: vi.fn(),
  deleteNote: vi.fn(),
}));
vi.mock("@/features/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("./data/contacts-repo", () => ({
  createContact: vi.fn(),
  updateContact: vi.fn(),
  deleteContact: vi.fn(),
  markTalked: vi.fn(),
  setKeepInTouchDays: vi.fn(),
  addContactToGroup: vi.fn(),
  removeContactFromGroup: vi.fn(),
}));
vi.mock("./data/groups-repo", () => ({
  createGroup: vi.fn(),
  renameGroup: vi.fn(),
  deleteGroup: vi.fn(),
}));

const { revalidatePath } = await import("next/cache");
const { getCurrentUser } = await import("@/features/auth/session");
const notesRepo = await import("./data/notes-repo");
const contactsRepo = await import("./data/contacts-repo");
const groupsRepo = await import("./data/groups-repo");
const {
  addNote,
  createContact,
  updateContact,
  deleteNote,
  deleteContact,
  markTalked,
  setKeepInTouchDays,
  addContactToGroup,
  removeContactFromGroup,
  createGroup,
  renameGroup,
  deleteGroup,
} = await import("./actions");

// The signed-in user; every repository call gets their id as the owner.
const OWNER = 42;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue({
    id: OWNER,
    email: "owner@example.com",
  });
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
    expect(notesRepo.addNote).toHaveBeenCalledWith(OWNER, 3, "Созвон");
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
    expect(contactsRepo.createContact).toHaveBeenCalledWith(OWNER, {
      name: "Марк Орлов",
      metContext: "Митап",
      phone: "",
      email: "",
      keepInTouchDays: null,
      groupIds: [],
      firstNote: "Пришлёт ссылку",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("saves the ticked groups", async () => {
    vi.mocked(contactsRepo.createContact).mockResolvedValue(1000);

    await createContact({ name: "Марк", groupIds: [3, 5] });

    expect(contactsRepo.createContact).toHaveBeenCalledWith(
      OWNER,
      expect.objectContaining({ groupIds: [3, 5] }),
    );
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
    expect(contactsRepo.updateContact).toHaveBeenCalledWith(OWNER, 7, {
      name: "Марк Орлов-Соколов",
      metContext: "",
      phone: "",
      email: "",
      keepInTouchDays: null,
      groupIds: [],
    });
  });

  it("saves how often to keep in touch", async () => {
    vi.mocked(contactsRepo.updateContact).mockResolvedValue(true);

    await updateContact({ id: 7, name: "Марк", keepInTouchDays: 30 });

    expect(contactsRepo.updateContact).toHaveBeenCalledWith(
      OWNER,
      7,
      expect.objectContaining({ keepInTouchDays: 30 }),
    );
  });

  it("saves the ticked groups", async () => {
    vi.mocked(contactsRepo.updateContact).mockResolvedValue(true);

    await updateContact({ id: 7, name: "Марк", groupIds: [2] });

    expect(contactsRepo.updateContact).toHaveBeenCalledWith(
      OWNER,
      7,
      expect.objectContaining({ groupIds: [2] }),
    );
  });

  it("refuses a rhythm outside the list", async () => {
    expect(
      await updateContact({ id: 7, name: "Марк", keepInTouchDays: 7 }),
    ).toEqual({
      ok: false,
      fieldErrors: { keepInTouchDays: "Выбери из списка, как часто общаться" },
      canRetry: false,
    });
    expect(contactsRepo.updateContact).not.toHaveBeenCalled();
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
    expect(notesRepo.deleteNote).toHaveBeenCalledWith(OWNER, 5);
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
    expect(contactsRepo.deleteContact).toHaveBeenCalledWith(OWNER, 9);
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

describe("markTalked action", () => {
  it("marks that you talked and refreshes the page", async () => {
    vi.mocked(contactsRepo.markTalked).mockResolvedValue(true);

    expect(await markTalked({ contactId: 9 })).toEqual({ ok: true });
    expect(contactsRepo.markTalked).toHaveBeenCalledWith(OWNER, 9);
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("says when the contact is gone", async () => {
    vi.mocked(contactsRepo.markTalked).mockResolvedValue(false);

    expect(await markTalked({ contactId: 9 })).toEqual({
      ok: false,
      error: "Такого контакта больше нет",
      canRetry: false,
    });
  });

  it("refuses a broken id without touching the database", async () => {
    expect(await markTalked({ contactId: 0 })).toMatchObject({ ok: false });
    expect(contactsRepo.markTalked).not.toHaveBeenCalled();
  });

  it("turns an unexpected failure into a retryable message", async () => {
    vi.mocked(contactsRepo.markTalked).mockRejectedValue(new Error("locked"));

    expect(await markTalked({ contactId: 9 })).toEqual({
      ok: false,
      error: "Не удалось отметить",
      canRetry: true,
    });
  });
});

describe("setKeepInTouchDays action", () => {
  it("saves the rhythm and refreshes the page", async () => {
    vi.mocked(contactsRepo.setKeepInTouchDays).mockResolvedValue(true);

    expect(
      await setKeepInTouchDays({ contactId: 9, keepInTouchDays: 30 }),
    ).toEqual({ ok: true });
    expect(contactsRepo.setKeepInTouchDays).toHaveBeenCalledWith(OWNER, 9, 30);
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("stops keeping in touch", async () => {
    vi.mocked(contactsRepo.setKeepInTouchDays).mockResolvedValue(true);

    expect(
      await setKeepInTouchDays({ contactId: 9, keepInTouchDays: null }),
    ).toEqual({ ok: true });
    expect(contactsRepo.setKeepInTouchDays).toHaveBeenCalledWith(
      OWNER,
      9,
      null,
    );
  });

  it("refuses a rhythm outside the list without touching the database", async () => {
    expect(
      await setKeepInTouchDays({ contactId: 9, keepInTouchDays: 7 }),
    ).toEqual({
      ok: false,
      error: "Выбери из списка, как часто общаться",
      canRetry: false,
    });
    expect(contactsRepo.setKeepInTouchDays).not.toHaveBeenCalled();
  });

  it("says when the contact is gone", async () => {
    vi.mocked(contactsRepo.setKeepInTouchDays).mockResolvedValue(false);

    expect(
      await setKeepInTouchDays({ contactId: 9, keepInTouchDays: 30 }),
    ).toEqual({
      ok: false,
      error: "Такого контакта больше нет",
      canRetry: false,
    });
  });

  it("turns an unexpected failure into a retryable message", async () => {
    vi.mocked(contactsRepo.setKeepInTouchDays).mockRejectedValue(
      new Error("locked"),
    );

    expect(
      await setKeepInTouchDays({ contactId: 9, keepInTouchDays: 30 }),
    ).toEqual({
      ok: false,
      error: "Не удалось сохранить, как часто общаться",
      canRetry: true,
    });
  });
});

describe("addContactToGroup action", () => {
  it("adds the contact to the group and refreshes the page", async () => {
    vi.mocked(contactsRepo.addContactToGroup).mockResolvedValue("added");

    expect(await addContactToGroup({ contactId: 9, groupId: 4 })).toEqual({
      ok: true,
    });
    expect(contactsRepo.addContactToGroup).toHaveBeenCalledWith(OWNER, 9, 4);
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("says when the contact is gone", async () => {
    vi.mocked(contactsRepo.addContactToGroup).mockResolvedValue(
      "contact_missing",
    );

    expect(await addContactToGroup({ contactId: 9, groupId: 4 })).toEqual({
      ok: false,
      error: "Такого контакта больше нет",
      canRetry: false,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("says when the group is gone", async () => {
    vi.mocked(contactsRepo.addContactToGroup).mockResolvedValue(
      "group_missing",
    );

    expect(await addContactToGroup({ contactId: 9, groupId: 4 })).toEqual({
      ok: false,
      error: "Такой группы больше нет",
      canRetry: false,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("refuses a broken id without touching the database", async () => {
    expect(await addContactToGroup({ contactId: 9, groupId: 0 })).toMatchObject(
      { ok: false },
    );
    expect(contactsRepo.addContactToGroup).not.toHaveBeenCalled();
  });

  it("turns an unexpected failure into a retryable message", async () => {
    vi.mocked(contactsRepo.addContactToGroup).mockRejectedValue(
      new Error("locked"),
    );

    expect(await addContactToGroup({ contactId: 9, groupId: 4 })).toEqual({
      ok: false,
      error: "Не удалось добавить в группу",
      canRetry: true,
    });
  });
});

describe("removeContactFromGroup action", () => {
  it("takes the contact out of the group and refreshes the page", async () => {
    vi.mocked(contactsRepo.removeContactFromGroup).mockResolvedValue(true);

    expect(await removeContactFromGroup({ contactId: 9, groupId: 4 })).toEqual({
      ok: true,
    });
    expect(contactsRepo.removeContactFromGroup).toHaveBeenCalledWith(
      OWNER,
      9,
      4,
    );
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("says when the contact is gone", async () => {
    vi.mocked(contactsRepo.removeContactFromGroup).mockResolvedValue(false);

    expect(await removeContactFromGroup({ contactId: 9, groupId: 4 })).toEqual({
      ok: false,
      error: "Такого контакта больше нет",
      canRetry: false,
    });
  });

  it("refuses a broken id without touching the database", async () => {
    expect(
      await removeContactFromGroup({ contactId: -1, groupId: 4 }),
    ).toMatchObject({ ok: false });
    expect(contactsRepo.removeContactFromGroup).not.toHaveBeenCalled();
  });

  it("turns an unexpected failure into a retryable message", async () => {
    vi.mocked(contactsRepo.removeContactFromGroup).mockRejectedValue(
      new Error("locked"),
    );

    expect(await removeContactFromGroup({ contactId: 9, groupId: 4 })).toEqual({
      ok: false,
      error: "Не удалось убрать из группы",
      canRetry: true,
    });
  });
});

describe("createGroup action", () => {
  it("creates the group and refreshes the page", async () => {
    vi.mocked(groupsRepo.createGroup).mockResolvedValue({
      id: 4,
      name: "Работа",
    });

    expect(await createGroup({ name: "  Работа " })).toEqual({
      ok: true,
      groupId: 4,
    });
    expect(groupsRepo.createGroup).toHaveBeenCalledWith(OWNER, "Работа");
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("refuses an empty name without touching the database", async () => {
    expect(await createGroup({ name: "  " })).toEqual({
      ok: false,
      error: "Напиши название группы",
      canRetry: false,
    });
    expect(groupsRepo.createGroup).not.toHaveBeenCalled();
  });

  it("says when the owner already has a group with this name", async () => {
    vi.mocked(groupsRepo.createGroup).mockResolvedValue(null);

    expect(await createGroup({ name: " работа" })).toEqual({
      ok: false,
      error: "Группа «работа» уже есть",
      canRetry: false,
    });
  });

  it("turns an unexpected failure into a retryable message", async () => {
    vi.mocked(groupsRepo.createGroup).mockRejectedValue(new Error("busy"));

    expect(await createGroup({ name: "Работа" })).toEqual({
      ok: false,
      error: "Не удалось создать группу",
      canRetry: true,
    });
  });
});

describe("renameGroup action", () => {
  it("renames the group and refreshes the page", async () => {
    vi.mocked(groupsRepo.renameGroup).mockResolvedValue("renamed");

    expect(await renameGroup({ groupId: 4, name: " Друзья " })).toEqual({
      ok: true,
    });
    expect(groupsRepo.renameGroup).toHaveBeenCalledWith(OWNER, 4, "Друзья");
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("refuses an empty name without touching the database", async () => {
    expect(await renameGroup({ groupId: 4, name: "" })).toEqual({
      ok: false,
      error: "Напиши название группы",
      canRetry: false,
    });
    expect(groupsRepo.renameGroup).not.toHaveBeenCalled();
  });

  it("says when another group has this name", async () => {
    vi.mocked(groupsRepo.renameGroup).mockResolvedValue("name_taken");

    expect(await renameGroup({ groupId: 4, name: "Друзья" })).toEqual({
      ok: false,
      error: "Группа «Друзья» уже есть",
      canRetry: false,
    });
  });

  it("says when the group is gone", async () => {
    vi.mocked(groupsRepo.renameGroup).mockResolvedValue("missing");

    expect(await renameGroup({ groupId: 4, name: "Друзья" })).toEqual({
      ok: false,
      error: "Такой группы больше нет",
      canRetry: false,
    });
  });

  it("turns an unexpected failure into a retryable message", async () => {
    vi.mocked(groupsRepo.renameGroup).mockRejectedValue(new Error("busy"));

    expect(await renameGroup({ groupId: 4, name: "Друзья" })).toEqual({
      ok: false,
      error: "Не удалось переименовать группу",
      canRetry: true,
    });
  });
});

describe("deleteGroup action", () => {
  it("deletes the group and refreshes the page", async () => {
    vi.mocked(groupsRepo.deleteGroup).mockResolvedValue(true);

    expect(await deleteGroup({ groupId: 4 })).toEqual({ ok: true });
    expect(groupsRepo.deleteGroup).toHaveBeenCalledWith(OWNER, 4);
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("says when the group is already gone", async () => {
    vi.mocked(groupsRepo.deleteGroup).mockResolvedValue(false);

    expect(await deleteGroup({ groupId: 4 })).toEqual({
      ok: false,
      error: "Такой группы больше нет",
      canRetry: false,
    });
  });

  it("refuses a broken id without touching the database", async () => {
    expect(await deleteGroup({ groupId: 0 })).toMatchObject({ ok: false });
    expect(groupsRepo.deleteGroup).not.toHaveBeenCalled();
  });

  it("turns an unexpected failure into a retryable message", async () => {
    vi.mocked(groupsRepo.deleteGroup).mockRejectedValue(new Error("locked"));

    expect(await deleteGroup({ groupId: 4 })).toEqual({
      ok: false,
      error: "Не удалось удалить группу",
      canRetry: true,
    });
  });
});

describe("without a session", () => {
  const signedOut = {
    ok: false,
    error: "Вход истёк — войди снова",
    canRetry: false,
  };

  beforeEach(() => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
  });

  it("every action refuses without touching the data", async () => {
    expect(await addNote({ contactId: 3, body: "Созвон" })).toEqual(signedOut);
    expect(await createContact({ name: "Марк" })).toEqual(signedOut);
    expect(await updateContact({ id: 7, name: "Марк" })).toEqual(signedOut);
    expect(await deleteNote({ noteId: 5 })).toEqual(signedOut);
    expect(await deleteContact({ contactId: 9 })).toEqual(signedOut);
    expect(await markTalked({ contactId: 9 })).toEqual(signedOut);
    expect(
      await setKeepInTouchDays({ contactId: 9, keepInTouchDays: 30 }),
    ).toEqual(signedOut);
    expect(await addContactToGroup({ contactId: 9, groupId: 4 })).toEqual(
      signedOut,
    );
    expect(await removeContactFromGroup({ contactId: 9, groupId: 4 })).toEqual(
      signedOut,
    );
    expect(await createGroup({ name: "Работа" })).toEqual(signedOut);
    expect(await renameGroup({ groupId: 4, name: "Работа" })).toEqual(
      signedOut,
    );
    expect(await deleteGroup({ groupId: 4 })).toEqual(signedOut);

    for (const repoFunction of [
      notesRepo.addNote,
      notesRepo.deleteNote,
      contactsRepo.createContact,
      contactsRepo.updateContact,
      contactsRepo.deleteContact,
      contactsRepo.markTalked,
      contactsRepo.setKeepInTouchDays,
      contactsRepo.addContactToGroup,
      contactsRepo.removeContactFromGroup,
      groupsRepo.createGroup,
      groupsRepo.renameGroup,
      groupsRepo.deleteGroup,
    ]) {
      expect(repoFunction).not.toHaveBeenCalled();
    }
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("when the session cannot be checked", () => {
  it("answers with the action's retryable message", async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new Error("db down"));

    expect(await addNote({ contactId: 3, body: "Созвон" })).toEqual({
      ok: false,
      error: "Не удалось сохранить заметку",
      canRetry: true,
    });
    expect(await markTalked({ contactId: 9 })).toEqual({
      ok: false,
      error: "Не удалось отметить",
      canRetry: true,
    });
    expect(notesRepo.addNote).not.toHaveBeenCalled();
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

    vi.mocked(contactsRepo.markTalked)
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(queryError);
    await markTalked({ contactId: 7 });
    await markTalked({ contactId: 7 });

    vi.mocked(contactsRepo.setKeepInTouchDays)
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(queryError);
    await setKeepInTouchDays({ contactId: 7, keepInTouchDays: 30 });
    await setKeepInTouchDays({ contactId: 7, keepInTouchDays: 30 });

    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
    await addNote({ contactId: 7, body: note });

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
      "contact.talked",
      "contact.talk_failed",
      "contact.keep_in_touch_set",
      "contact.keep_in_touch_failed",
      "session.missing",
    ]) {
      expect(output).toContain(event);
    }
    for (const personal of [...Object.values(contact), note]) {
      expect(output).not.toContain(personal);
    }
  });

  it("carry group ids and lengths, never group names", async () => {
    vi.stubEnv("LOG_LEVEL", "debug");
    const lines: string[] = [];
    for (const method of ["log", "warn", "error"] as const) {
      vi.spyOn(console, method).mockImplementation((line: unknown) => {
        lines.push(String(line));
      });
    }
    const name = "Бывшие коллеги из Ромашки";
    const queryError = new Error(
      `Failed query: insert into "groups" params: ${name}`,
      { cause: new Error("database is locked") },
    );

    vi.mocked(groupsRepo.createGroup)
      .mockResolvedValueOnce({ id: 4, name })
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(queryError);
    await createGroup({ name });
    await createGroup({ name });
    await createGroup({ name });
    await createGroup({ name: name.repeat(10) });

    vi.mocked(groupsRepo.renameGroup)
      .mockResolvedValueOnce("renamed")
      .mockResolvedValueOnce("name_taken")
      .mockResolvedValueOnce("missing")
      .mockRejectedValueOnce(queryError);
    for (let i = 0; i < 4; i++) {
      await renameGroup({ groupId: 4, name });
    }

    vi.mocked(groupsRepo.deleteGroup)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(queryError);
    for (let i = 0; i < 3; i++) {
      await deleteGroup({ groupId: 4 });
    }

    vi.mocked(contactsRepo.createContact).mockResolvedValueOnce(1000);
    await createContact({ name: "Марк", groupIds: [4, 5] });

    vi.mocked(contactsRepo.addContactToGroup)
      .mockResolvedValueOnce("added")
      .mockResolvedValueOnce("contact_missing")
      .mockResolvedValueOnce("group_missing")
      .mockRejectedValueOnce(queryError);
    for (let i = 0; i < 4; i++) {
      await addContactToGroup({ contactId: 7, groupId: 4 });
    }
    await addContactToGroup({ contactId: 7, groupId: 0 });

    vi.mocked(contactsRepo.removeContactFromGroup)
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(queryError);
    await removeContactFromGroup({ contactId: 7, groupId: 4 });
    await removeContactFromGroup({ contactId: 7, groupId: 4 });

    const output = lines.join("\n");
    for (const event of [
      "contact.group_added",
      "contact.group_add_failed",
      "contact.group_removed",
      "contact.group_remove_failed",
      "contact.rejected",
      "group.created",
      "group.name_taken",
      "group.create_failed",
      "group.rejected",
      "group.renamed",
      "group.missing",
      "group.rename_failed",
      "group.deleted",
      "group.delete_failed",
    ]) {
      expect(output).toContain(event);
    }
    expect(output).toContain("groupCount=2");
    expect(output).not.toContain(name);
    expect(output).not.toContain("Ромашк");
  });
});
