// The screen state lives in the address: /?q=анн&contact=412&edit=1, /?new=1&name=…
// This file is the only place that reads and builds such addresses.

type SearchParams = Record<string, string | string[] | undefined>;

export type ScreenState = {
  q: string;
  // Raw value, so a broken link can still say "this contact is gone".
  contactParam: string | null;
  contactId: number | null;
  isNew: boolean;
  isEdit: boolean;
  newName: string;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseId(raw: string | undefined): number | null {
  if (raw === undefined || !/^[1-9]\d*$/.test(raw)) {
    return null;
  }
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}

export function readScreenState(params: SearchParams): ScreenState {
  const contactParam = first(params.contact) ?? null;
  return {
    q: first(params.q) ?? "",
    contactParam,
    contactId: parseId(contactParam ?? undefined),
    isNew: first(params.new) === "1",
    isEdit: first(params.edit) === "1",
    newName: first(params.name) ?? "",
  };
}

export type ScreenTarget = {
  q?: string;
  contactId?: number | null;
  isEdit?: boolean;
  isNew?: boolean;
  newName?: string;
};

export function screenHref(target: ScreenTarget): string {
  const params = new URLSearchParams();
  if (target.q) {
    params.set("q", target.q);
  }
  if (target.contactId != null) {
    params.set("contact", String(target.contactId));
    if (target.isEdit) {
      params.set("edit", "1");
    }
  }
  if (target.isNew) {
    params.set("new", "1");
    if (target.newName) {
      params.set("name", target.newName);
    }
  }
  const query = params.toString();
  return query === "" ? "/" : `/?${query}`;
}
