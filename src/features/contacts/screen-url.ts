// The screen state lives in the address: /?q=анн&contact=412&edit=1, /?new=1&name=…,
// /?due=1 for the «Пора написать» list, /?group=3 or /?group=none for one
// group or the contacts without a group, /?groups=1 for the groups panel.
// This file is the only place that reads and builds such addresses.
import type { GroupFilter } from "./data/contacts-repo";

type SearchParams = Record<string, string | string[] | undefined>;

export type ScreenState = {
  q: string;
  isDueList: boolean;
  groupFilter: GroupFilter;
  // Raw value, so a broken link can still say "this contact is gone".
  contactParam: string | null;
  contactId: number | null;
  isNew: boolean;
  isEdit: boolean;
  newName: string;
  isGroupsPanel: boolean;
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

function parseGroupFilter(raw: string | undefined): GroupFilter {
  return raw === "none" ? "none" : parseId(raw);
}

export function readScreenState(params: SearchParams): ScreenState {
  const contactParam = first(params.contact) ?? null;
  return {
    q: first(params.q) ?? "",
    isDueList: first(params.due) === "1",
    groupFilter: parseGroupFilter(first(params.group)),
    contactParam,
    contactId: parseId(contactParam ?? undefined),
    isNew: first(params.new) === "1",
    isEdit: first(params.edit) === "1",
    newName: first(params.name) ?? "",
    isGroupsPanel: first(params.groups) === "1",
  };
}

// A group that is gone (deleted in another tab) or someone else's shows
// everyone, as if no group were chosen.
export function knownGroupFilter(
  filter: GroupFilter,
  groups: readonly { id: number }[],
): GroupFilter {
  if (typeof filter === "number" && !groups.some(({ id }) => id === filter)) {
    return null;
  }
  return filter;
}

export type ScreenTarget = {
  q?: string;
  isDueList?: boolean;
  groupFilter?: GroupFilter;
  contactId?: number | null;
  isEdit?: boolean;
  isNew?: boolean;
  newName?: string;
  isGroupsPanel?: boolean;
};

export function screenHref(target: ScreenTarget): string {
  const params = new URLSearchParams();
  if (target.q) {
    params.set("q", target.q);
  }
  if (target.isDueList) {
    params.set("due", "1");
  }
  if (target.groupFilter != null) {
    params.set("group", String(target.groupFilter));
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
  if (target.isGroupsPanel) {
    params.set("groups", "1");
  }
  const query = params.toString();
  return query === "" ? "/" : `/?${query}`;
}
