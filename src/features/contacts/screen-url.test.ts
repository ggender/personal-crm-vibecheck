import { describe, expect, it } from "vitest";
import { readScreenState, screenHref } from "./screen-url";

describe("readScreenState", () => {
  it("reads an empty address as the start screen", () => {
    expect(readScreenState({})).toEqual({
      q: "",
      contactParam: null,
      contactId: null,
      isNew: false,
      isEdit: false,
      newName: "",
    });
  });

  it("reads every part of the screen", () => {
    expect(
      readScreenState({ q: "анн", contact: "412", edit: "1" }),
    ).toMatchObject({
      q: "анн",
      contactParam: "412",
      contactId: 412,
      isEdit: true,
    });
    expect(readScreenState({ new: "1", name: "Марк Орлов" })).toMatchObject({
      isNew: true,
      newName: "Марк Орлов",
    });
  });

  it.each(["abc", "0", "-3", "1.5", "12abc", "", "99999999999999999999"])(
    "keeps a broken contact id %j but gives no number",
    (raw) => {
      expect(readScreenState({ contact: raw })).toMatchObject({
        contactParam: raw,
        contactId: null,
      });
    },
  );

  it("takes the first value of a repeated parameter", () => {
    expect(
      readScreenState({ q: ["анн", "бор"], contact: ["7", "8"] }),
    ).toMatchObject({
      q: "анн",
      contactId: 7,
    });
  });
});

describe("screenHref", () => {
  it("builds the start screen address", () => {
    expect(screenHref({})).toBe("/");
    expect(screenHref({ q: "" })).toBe("/");
  });

  it("keeps a fixed parameter order and encodes values", () => {
    expect(screenHref({ q: "анна пет", contactId: 412, isEdit: true })).toBe(
      "/?q=%D0%B0%D0%BD%D0%BD%D0%B0+%D0%BF%D0%B5%D1%82&contact=412&edit=1",
    );
    expect(screenHref({ isNew: true, newName: "Марк & Ко" })).toBe(
      "/?new=1&name=%D0%9C%D0%B0%D1%80%D0%BA+%26+%D0%9A%D0%BE",
    );
  });

  it("round-trips through readScreenState", () => {
    const href = screenHref({ q: "100% _", contactId: 5 });
    const params = Object.fromEntries(
      new URL(href, "http://localhost").searchParams,
    );
    expect(readScreenState(params)).toMatchObject({
      q: "100% _",
      contactId: 5,
    });
  });
});
