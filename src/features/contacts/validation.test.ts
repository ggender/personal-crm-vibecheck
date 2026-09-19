import { describe, expect, it } from "vitest";
import {
  KEEP_IN_TOUCH_DAYS,
  LIMITS,
  addNoteInput,
  createContactInput,
  createGroupInput,
  deleteGroupInput,
  fieldErrors,
  firstIssueMessage,
  markTalkedInput,
  renameGroupInput,
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
      keepInTouchDays: null,
      groupIds: [],
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
      keepInTouchDays: null,
      groupIds: [],
    });
    expect(updateContactInput.safeParse({ name: "Марк" }).success).toBe(false);
  });
});

describe("keepInTouchDays", () => {
  it("means «не следить» when not given", () => {
    expect(createContactInput.parse({ name: "Марк" }).keepInTouchDays).toBe(
      null,
    );
    expect(
      createContactInput.parse({ name: "Марк", keepInTouchDays: null })
        .keepInTouchDays,
    ).toBe(null);
  });

  it("accepts only the rhythms from the list", () => {
    expect(KEEP_IN_TOUCH_DAYS).toEqual([14, 30, 90, 180, 365]);
    for (const days of KEEP_IN_TOUCH_DAYS) {
      expect(
        updateContactInput.parse({ id: 4, name: "Марк", keepInTouchDays: days })
          .keepInTouchDays,
      ).toBe(days);
    }
    for (const days of [7, 0, -30, 30.5, "30", "abc"]) {
      const result = updateContactInput.safeParse({
        id: 4,
        name: "Марк",
        keepInTouchDays: days,
      });
      expect(result.success).toBe(false);
      expect(fieldErrors(result.error!)).toEqual({
        keepInTouchDays: "Выбери из списка, как часто общаться",
      });
    }
  });
});

describe("markTalkedInput", () => {
  it("requires a positive whole contact id", () => {
    expect(markTalkedInput.parse({ contactId: 3 })).toEqual({ contactId: 3 });
    for (const contactId of [0, -1, 1.5, "3", null]) {
      expect(markTalkedInput.safeParse({ contactId }).success).toBe(false);
    }
  });
});

describe("groupIds", () => {
  it("means no groups when not given", () => {
    expect(createContactInput.parse({ name: "Марк" }).groupIds).toEqual([]);
  });

  it("takes the ticked groups when adding and when editing", () => {
    expect(
      createContactInput.parse({ name: "Марк", groupIds: [3, 5] }).groupIds,
    ).toEqual([3, 5]);
    expect(
      updateContactInput.parse({ id: 4, name: "Марк", groupIds: [2] }).groupIds,
    ).toEqual([2]);
  });

  it("refuses anything but positive whole group ids", () => {
    for (const groupIds of [[0], [-2], [1.5], ["3"], [null], "3", 3]) {
      const result = createContactInput.safeParse({ name: "Марк", groupIds });
      expect(result.success).toBe(false);
      expect(fieldErrors(result.error!)).toEqual({
        groupIds: "Не удалось понять, какая это группа",
      });
    }
  });
});

describe("group name", () => {
  it("trims the name", () => {
    expect(createGroupInput.parse({ name: "  Работа \n" })).toEqual({
      name: "Работа",
    });
  });

  it("asks for a name", () => {
    for (const name of ["", "   ", undefined]) {
      const result = createGroupInput.safeParse({ name });
      expect(result.success).toBe(false);
      expect(firstIssueMessage(result.error!)).toBe("Напиши название группы");
    }
  });

  it("accepts exactly 50 characters and refuses more", () => {
    expect(LIMITS.groupName).toBe(50);
    expect(createGroupInput.safeParse({ name: "я".repeat(50) }).success).toBe(
      true,
    );
    const tooLong = createGroupInput.safeParse({ name: "я".repeat(51) });
    expect(tooLong.success).toBe(false);
    expect(firstIssueMessage(tooLong.error!)).toBe(
      "Название группы длиннее 50 знаков — сократи его",
    );
  });

  it("renaming checks the new name the same way", () => {
    expect(renameGroupInput.parse({ groupId: 3, name: " Друзья " })).toEqual({
      groupId: 3,
      name: "Друзья",
    });
    expect(
      firstIssueMessage(
        renameGroupInput.safeParse({ groupId: 3, name: " " }).error!,
      ),
    ).toBe("Напиши название группы");
  });
});

describe("group id", () => {
  it("requires a positive whole group id to rename or delete", () => {
    expect(deleteGroupInput.parse({ groupId: 3 })).toEqual({ groupId: 3 });
    for (const groupId of [0, -1, 1.5, "3", null]) {
      for (const result of [
        deleteGroupInput.safeParse({ groupId }),
        renameGroupInput.safeParse({ groupId, name: "Работа" }),
      ]) {
        expect(result.success).toBe(false);
        expect(firstIssueMessage(result.error!)).toBe(
          "Не удалось понять, какая это группа",
        );
      }
    }
  });
});
