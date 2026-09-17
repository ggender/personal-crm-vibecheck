import { describe, expect, it } from "vitest";
import {
  LIMITS,
  addNoteInput,
  createContactInput,
  fieldErrors,
  firstIssueMessage,
  updateContactInput,
} from "./validation";

describe("addNoteInput", () => {
  it("trims the note text", () => {
    expect(addNoteInput.parse({ contactId: 3, body: "  Созвон \n" })).toEqual({
      contactId: 3,
      body: "Созвон",
    });
  });

  it("rejects an empty or blank note with a Russian message", () => {
    for (const body of ["", "   \n "]) {
      const result = addNoteInput.safeParse({ contactId: 3, body });
      expect(result.success).toBe(false);
      expect(firstIssueMessage(result.error!)).toBe("Напиши текст заметки");
    }
  });

  it("accepts exactly 5000 characters and refuses more", () => {
    expect(LIMITS.note).toBe(5000);
    expect(
      addNoteInput.safeParse({ contactId: 3, body: "я".repeat(5000) }).success,
    ).toBe(true);

    const tooLong = addNoteInput.safeParse({
      contactId: 3,
      body: "я".repeat(5001),
    });
    expect(tooLong.success).toBe(false);
    expect(firstIssueMessage(tooLong.error!)).toBe(
      "Заметка длиннее 5000 знаков — сократи её",
    );
  });

  it("requires a positive whole contact id", () => {
    for (const contactId of [0, -1, 1.5, "3", null]) {
      expect(addNoteInput.safeParse({ contactId, body: "Текст" }).success).toBe(
        false,
      );
    }
  });
});

describe("createContactInput", () => {
  it("trims everything and fills optional fields", () => {
    expect(
      createContactInput.parse({
        name: "  Марк Орлов ",
        metContext: " Митап по Next.js ",
        phone: " +7 900 555-00-00 ",
        email: " mark@example.com ",
        firstNote: "  Пришлёт ссылку  ",
      }),
    ).toEqual({
      name: "Марк Орлов",
      metContext: "Митап по Next.js",
      phone: "+7 900 555-00-00",
      email: "mark@example.com",
      firstNote: "Пришлёт ссылку",
    });
    expect(createContactInput.parse({ name: "Марк" })).toMatchObject({
      metContext: "",
      phone: "",
      email: "",
      firstNote: "",
    });
  });

  it("names the field with the problem", () => {
    const result = createContactInput.safeParse({
      name: "   ",
      email: "mark.example.com",
    });
    expect(result.success).toBe(false);
    expect(fieldErrors(result.error!)).toEqual({
      name: "Укажи имя",
      email: "В почте должен быть знак @",
    });
  });

  it("accepts an empty email but not a too long one", () => {
    expect(
      createContactInput.safeParse({ name: "Марк", email: "" }).success,
    ).toBe(true);
    const long = createContactInput.safeParse({
      name: "Марк",
      email: `${"я".repeat(LIMITS.email)}@example.com`,
    });
    expect(fieldErrors(long.error!).email).toContain("длиннее");
  });

  it("refuses a name longer than 200 characters", () => {
    expect(
      createContactInput.safeParse({ name: "я".repeat(200) }).success,
    ).toBe(true);
    expect(
      fieldErrors(
        createContactInput.safeParse({ name: "я".repeat(201) }).error!,
      ).name,
    ).toBe("Имя длиннее 200 знаков — сократи его");
  });
});

describe("updateContactInput", () => {
  it("needs a contact id and has no first note", () => {
    expect(updateContactInput.parse({ id: 4, name: "Марк" })).toEqual({
      id: 4,
      name: "Марк",
      metContext: "",
      phone: "",
      email: "",
    });
    expect(updateContactInput.safeParse({ name: "Марк" }).success).toBe(false);
  });
});
