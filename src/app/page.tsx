import { Plus } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { logout } from "@/features/auth/actions";
import { requireUser } from "@/features/auth/session";
import { ContactCard } from "@/features/contacts/components/contact-card";
import { ContactForm } from "@/features/contacts/components/contact-form";
import { ContactList } from "@/features/contacts/components/contact-list";
import {
  ContactMissing,
  StartHint,
} from "@/features/contacts/components/empty-states";
import { GroupSwitch } from "@/features/contacts/components/group-switch";
import { GroupsPanel } from "@/features/contacts/components/groups-panel";
import { ListSwitch } from "@/features/contacts/components/list-switch";
import { SearchInput } from "@/features/contacts/components/search-input";
import {
  countContacts,
  getContact,
  listKeepInTouch,
  searchContacts,
  type GroupFilter,
} from "@/features/contacts/data/contacts-repo";
import {
  listContactGroups,
  listGroups,
} from "@/features/contacts/data/groups-repo";
import { listNotes } from "@/features/contacts/data/notes-repo";
import {
  keepInTouchState,
  lastTalkAt,
  selectDue,
} from "@/features/contacts/keep-in-touch";
import { splitSearchQuery } from "@/features/contacts/normalize-name";
import {
  knownGroupFilter,
  readScreenState,
  screenHref,
  type ScreenState,
} from "@/features/contacts/screen-url";
import { log } from "@/lib/log";

async function loadScreen(ownerId: number, screen: ScreenState, now: Date) {
  try {
    const startedAt = performance.now();
    const groups = await listGroups(ownerId);
    const groupFilter = knownGroupFilter(screen.groupFilter, groups);
    const allDue = loadDue(ownerId, "", null, now);
    const [contacts, total, dueCount, card] = await Promise.all([
      screen.isDueList
        ? loadDue(ownerId, screen.q, groupFilter, now)
        : searchContacts(ownerId, screen.q, groupFilter),
      // How many the list would show without the search.
      screen.isDueList
        ? (groupFilter === null
            ? allDue
            : loadDue(ownerId, "", groupFilter, now)
          ).then((due) => due.length)
        : countContacts(ownerId, groupFilter),
      allDue.then((due) => due.length),
      loadCard(ownerId, screen.contactId, now),
    ]);
    log.debug("contacts", "contacts.searched", {
      queryLength: screen.q.length,
      isDueList: screen.isDueList,
      isGroupShown: groupFilter !== null,
      resultCount: contacts.length,
      ms: Math.round(performance.now() - startedAt),
    });
    return { contacts, total, dueCount, card, groups, groupFilter };
  } catch (error) {
    log.error("db", "page.load_failed", error);
    // Next.js prints what is thrown, and Drizzle's error carries the query
    // params (the search text): the error screen gets one without them.
    throw new Error("The screen could not be loaded");
  }
}

async function loadDue(
  ownerId: number,
  query: string,
  group: GroupFilter,
  now: Date,
) {
  return selectDue(await listKeepInTouch(ownerId, query, group), now);
}

async function loadCard(ownerId: number, contactId: number | null, now: Date) {
  if (contactId === null) {
    return null;
  }
  const [contact, notes, groups] = await Promise.all([
    getContact(ownerId, contactId),
    listNotes(ownerId, contactId),
    listContactGroups(ownerId, contactId),
  ]);
  if (!contact) {
    return null;
  }
  const keepInTouch =
    contact.keepInTouchDays === null
      ? null
      : keepInTouchState(
          contact.keepInTouchDays,
          lastTalkAt({
            createdAt: contact.createdAt,
            talkedAt: contact.talkedAt,
            // The feed is newest first.
            lastNoteAt: notes[0]?.createdAt ?? null,
          }),
          now,
        );
  return { contact, notes, groups, keepInTouch };
}

export default async function HomePage({ searchParams }: PageProps<"/">) {
  // The database is read on every request, never at build time.
  await connection();
  const user = await requireUser();
  const screen = readScreenState(await searchParams);
  const now = new Date();
  const { contacts, total, dueCount, card, groups, groupFilter } =
    await loadScreen(user.id, screen, now);
  const isCardRequested = screen.contactParam !== null;

  let rightPanel: ReactNode;
  if (screen.isNew) {
    rightPanel = (
      <ContactForm
        key="new"
        query={screen.q}
        isDueList={screen.isDueList}
        groupFilter={groupFilter}
        groups={groups}
        suggestedName={screen.newName}
      />
    );
  } else if (screen.isGroupsPanel) {
    rightPanel = (
      <GroupsPanel
        groups={groups}
        query={screen.q}
        isDueList={screen.isDueList}
        groupFilter={groupFilter}
      />
    );
  } else if (card && screen.isEdit) {
    rightPanel = (
      <ContactForm
        key={`edit-${card.contact.id}`}
        query={screen.q}
        isDueList={screen.isDueList}
        groupFilter={groupFilter}
        groups={groups}
        contact={card.contact}
        contactGroupIds={card.groups.map((group) => group.id)}
      />
    );
  } else if (card) {
    rightPanel = (
      <ContactCard
        contact={card.contact}
        notes={card.notes}
        groups={card.groups}
        keepInTouch={card.keepInTouch}
        now={now}
        query={screen.q}
        isDueList={screen.isDueList}
        groupFilter={groupFilter}
      />
    );
  } else if (isCardRequested) {
    rightPanel = (
      <ContactMissing
        query={screen.q}
        isDueList={screen.isDueList}
        groupFilter={groupFilter}
      />
    );
  } else {
    rightPanel = <StartHint />;
  }

  return (
    <div className="flex min-h-dvh flex-col md:h-dvh">
      <header className="flex h-11 shrink-0 items-center justify-between gap-3 border-b bg-card px-4">
        <h1 className="font-heading text-lg font-semibold">
          <Link
            href="/"
            className="rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Личная CRM
          </Link>
        </h1>
        <form action={logout} className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm text-muted-foreground">
            {user.email}
          </span>
          <Button type="submit" variant="ghost" size="sm">
            Выйти
          </Button>
        </form>
      </header>
      <main className="grid flex-1 grid-cols-1 md:min-h-0 md:grid-cols-[minmax(18rem,36%)_1fr]">
        {/* Without this, the keyboard has to walk through the whole list. */}
        <a
          href="#contact-panel"
          className="sr-only focus:not-sr-only focus:absolute focus:z-10 focus:m-2 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:ring-3 focus:ring-ring/50"
        >
          Перейти к карточке
        </a>
        <section
          aria-label="Список контактов"
          className="flex max-h-[45dvh] min-h-0 flex-col border-b bg-card md:max-h-none md:border-r md:border-b-0"
        >
          <div className="flex items-center gap-2 border-b p-3">
            <SearchInput
              query={screen.q}
              focusOnLoad={
                !isCardRequested && !screen.isNew && !screen.isGroupsPanel
              }
            />
            <Link
              href={screenHref({
                q: screen.q,
                isDueList: screen.isDueList,
                groupFilter,
                isNew: true,
              })}
              scroll={false}
              aria-label="Добавить контакт"
              title="Добавить контакт"
              aria-current={screen.isNew ? "page" : undefined}
              className={buttonVariants({
                variant: screen.isNew ? "default" : "outline",
                size: "icon-lg",
              })}
            >
              <Plus aria-hidden />
            </Link>
          </div>
          <ListSwitch
            query={screen.q}
            isDueList={screen.isDueList}
            groupFilter={groupFilter}
            dueCount={dueCount}
            contactId={card ? card.contact.id : null}
          />
          <GroupSwitch
            groups={groups}
            groupFilter={groupFilter}
            query={screen.q}
            isDueList={screen.isDueList}
            contactId={card ? card.contact.id : null}
            isGroupsPanel={screen.isGroupsPanel}
          />
          <ContactList
            contacts={contacts}
            total={total}
            query={screen.q}
            isSearching={splitSearchQuery(screen.q).length > 0}
            isDueList={screen.isDueList}
            groupFilter={groupFilter}
            groupName={
              groups.find((group) => group.id === groupFilter)?.name ?? null
            }
            selectedId={card ? card.contact.id : null}
          />
        </section>
        <section
          id="contact-panel"
          tabIndex={-1}
          aria-label="Карточка контакта"
          className="min-h-0 outline-none md:overflow-y-auto"
        >
          {rightPanel}
        </section>
      </main>
    </div>
  );
}
