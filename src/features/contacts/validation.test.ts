import { describe, expect, it } from "vitest";
import { LIMITS, addNoteInput, firstIssueMessage } from "./validation";

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
