import { describe, expect, it } from "vitest";
import { knownGroupFilter, readScreenState, screenHref } from "./screen-url";

describe("readScreenState", () => {
  it("reads an empty address as the start screen", () => {
    expect(readScreenState({})).toEqual({
      q: "",
      contactParam: null,
      contactId: null,
      isDueList: false,
      groupFilter: null,
      isNew: false,
      isEdit: false,
      newName: "",
      isGroupsPanel: false,
    });
  });

  it("reads the «Пора написать» list", () => {
    expect(readScreenState({ due: "1", q: "анн" })).toMatchObject({
      isDueList: true,
      q: "анн",
    });
    expect(readScreenState({ due: "yes" })).toMatchObject({ isDueList: false });
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

  it("keeps the «Пора написать» list next to the search", () => {
    expect(screenHref({ isDueList: true })).toBe("/?due=1");
    expect(screenHref({ q: "анн", isDueList: true, contactId: 5 })).toBe(
      "/?q=%D0%B0%D0%BD%D0%BD&due=1&contact=5",
    );
    expect(screenHref({ isDueList: false, contactId: 5 })).toBe("/?contact=5");
  });

  it("round-trips through readScreenState", () => {
    const href = screenHref({ q: "100% _", contactId: 5, isDueList: true });
    const params = Object.fromEntries(
      new URL(href, "http://localhost").searchParams,
    );
    expect(readScreenState(params)).toMatchObject({
      q: "100% _",
      contactId: 5,
      isDueList: true,
    });
  });
});

describe("groups in the address", () => {
  it("reads one group or the contacts without a group", () => {
    expect(readScreenState({ group: "3" })).toMatchObject({ groupFilter: 3 });
    expect(readScreenState({ group: "none" })).toMatchObject({
      groupFilter: "none",
    });
    for (const raw of ["", "abc", "0", "-1", "1.5", "99999999999999999999"]) {
      expect(readScreenState({ group: raw })).toMatchObject({
        groupFilter: null,
      });
    }
  });

  it("reads the groups panel", () => {
    expect(readScreenState({ groups: "1" })).toMatchObject({
      isGroupsPanel: true,
    });
    expect(readScreenState({ groups: "yes" })).toMatchObject({
      isGroupsPanel: false,
    });
  });

  it("keeps the group next to the search and the «Пора написать» list", () => {
    expect(screenHref({ groupFilter: 3 })).toBe("/?group=3");
    expect(screenHref({ groupFilter: "none" })).toBe("/?group=none");
    expect(screenHref({ groupFilter: null })).toBe("/");
    expect(
      screenHref({ q: "анн", isDueList: true, groupFilter: 3, contactId: 5 }),
    ).toBe("/?q=%D0%B0%D0%BD%D0%BD&due=1&group=3&contact=5");
    expect(screenHref({ groupFilter: 3, isNew: true })).toBe("/?group=3&new=1");
    expect(screenHref({ groupFilter: 3, isGroupsPanel: true })).toBe(
      "/?group=3&groups=1",
    );
  });

  it("round-trips through readScreenState", () => {
    for (const groupFilter of [3, "none"] as const) {
      const params = Object.fromEntries(
        new URL(screenHref({ groupFilter, isGroupsPanel: true }), "http://x")
          .searchParams,
      );
      expect(readScreenState(params)).toMatchObject({
        groupFilter,
        isGroupsPanel: true,
      });
    }
  });
});

describe("knownGroupFilter", () => {
  const groups = [{ id: 3 }, { id: 8 }];

  it("keeps a group that exists and the contacts without a group", () => {
    expect(knownGroupFilter(8, groups)).toBe(8);
    expect(knownGroupFilter("none", groups)).toBe("none");
    expect(knownGroupFilter(null, groups)).toBeNull();
  });

  it("shows everyone for a group that is gone or someone else's", () => {
    expect(knownGroupFilter(5, groups)).toBeNull();
    expect(knownGroupFilter(3, [])).toBeNull();
  });
});
