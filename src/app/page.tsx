import { Plus } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { ContactCard } from "@/features/contacts/components/contact-card";
import { ContactForm } from "@/features/contacts/components/contact-form";
import { ContactList } from "@/features/contacts/components/contact-list";
import {
  ContactMissing,
  StartHint,
} from "@/features/contacts/components/empty-states";
import { SearchInput } from "@/features/contacts/components/search-input";
import {
  countContacts,
  getContact,
  searchContacts,
} from "@/features/contacts/data/contacts-repo";
import { listNotes } from "@/features/contacts/data/notes-repo";
import { splitSearchQuery } from "@/features/contacts/normalize-name";
import {
  readScreenState,
  screenHref,
  type ScreenState,
} from "@/features/contacts/screen-url";
import { log } from "@/lib/log";

async function loadScreen(screen: ScreenState) {
  try {
    const startedAt = performance.now();
    const [contacts, total, card] = await Promise.all([
      searchContacts(screen.q),
      countContacts(),
      loadCard(screen.contactId),
    ]);
    log.debug("contacts", "contacts.searched", {
      queryLength: screen.q.length,
      resultCount: contacts.length,
      ms: Math.round(performance.now() - startedAt),
    });
    return { contacts, total, card };
  } catch (error) {
    log.error("db", "page.load_failed", error);
    throw error;
  }
}

async function loadCard(contactId: number | null) {
  if (contactId === null) {
    return null;
  }
  const [contact, notes] = await Promise.all([
    getContact(contactId),
    listNotes(contactId),
  ]);
  return contact ? { contact, notes } : null;
}

export default async function HomePage({ searchParams }: PageProps<"/">) {
  // The database is read on every request, never at build time.
  await connection();
  const screen = readScreenState(await searchParams);
  const { contacts, total, card } = await loadScreen(screen);
  const isCardRequested = screen.contactParam !== null;
  const now = new Date();

  let rightPanel: ReactNode;
  if (screen.isNew) {
    rightPanel = (
      <ContactForm key="new" query={screen.q} suggestedName={screen.newName} />
    );
  } else if (card && screen.isEdit) {
    rightPanel = (
      <ContactForm
        key={`edit-${card.contact.id}`}
        query={screen.q}
        contact={card.contact}
      />
    );
  } else if (card) {
    rightPanel = (
      <ContactCard
        contact={card.contact}
        notes={card.notes}
        now={now}
        query={screen.q}
      />
    );
  } else if (isCardRequested) {
    rightPanel = <ContactMissing query={screen.q} />;
  } else {
    rightPanel = <StartHint />;
  }

  return (
    <div className="flex min-h-dvh flex-col md:h-dvh">
      <header className="flex h-11 shrink-0 items-center border-b bg-card px-4">
        <h1 className="font-heading text-lg font-semibold">
          <Link
            href="/"
            className="rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Личная CRM
          </Link>
        </h1>
      </header>
      <main className="grid flex-1 grid-cols-1 md:min-h-0 md:grid-cols-[minmax(18rem,36%)_1fr]">
        <section
          aria-label="Список контактов"
          className="flex max-h-[45dvh] min-h-0 flex-col border-b bg-card md:max-h-none md:border-r md:border-b-0"
        >
          <div className="flex items-center gap-2 border-b p-3">
            <SearchInput
              query={screen.q}
              focusOnLoad={!isCardRequested && !screen.isNew}
            />
            <Link
              href={screenHref({ q: screen.q, isNew: true })}
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
          <ContactList
            contacts={contacts}
            total={total}
            query={screen.q}
            isSearching={splitSearchQuery(screen.q).length > 0}
            selectedId={card ? card.contact.id : null}
          />
        </section>
        <section
          aria-label="Карточка контакта"
          className="min-h-0 md:overflow-y-auto"
        >
          {rightPanel}
        </section>
      </main>
    </div>
  );
}
