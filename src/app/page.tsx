import { Plus } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { buttonVariants } from "@/components/ui/button";
import { ContactList } from "@/features/contacts/components/contact-list";
import { StartHint } from "@/features/contacts/components/empty-states";
import { SearchInput } from "@/features/contacts/components/search-input";
import {
  countContacts,
  searchContacts,
} from "@/features/contacts/data/contacts-repo";
import { splitSearchQuery } from "@/features/contacts/normalize-name";
import {
  readScreenState,
  screenHref,
  type ScreenState,
} from "@/features/contacts/screen-url";
import { log } from "@/lib/log";

async function loadList(screen: ScreenState) {
  try {
    const startedAt = performance.now();
    const [contacts, total] = await Promise.all([
      searchContacts(screen.q),
      countContacts(),
    ]);
    log.debug("contacts", "contacts.searched", {
      queryLength: screen.q.length,
      resultCount: contacts.length,
      ms: Math.round(performance.now() - startedAt),
    });
    return { contacts, total };
  } catch (error) {
    log.error("db", "page.load_failed", error);
    throw error;
  }
}

export default async function HomePage({ searchParams }: PageProps<"/">) {
  // The database is read on every request, never at build time.
  await connection();
  const screen = readScreenState(await searchParams);
  const { contacts, total } = await loadList(screen);
  const isCardOpen = screen.contactParam !== null;

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
              focusOnLoad={!isCardOpen && !screen.isNew}
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
            selectedId={screen.contactId}
          />
        </section>
        <section
          aria-label="Карточка контакта"
          className="min-h-0 md:overflow-y-auto"
        >
          {screen.isNew ? (
            <p className="p-8 text-muted-foreground">
              Здесь будет форма нового контакта.
            </p>
          ) : (
            <StartHint />
          )}
        </section>
      </main>
    </div>
  );
}
