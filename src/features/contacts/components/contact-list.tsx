import Link from "next/link";
import type { ContactListItem } from "../data/contacts-repo";
import {
  formatContactCount,
  formatDayCount,
  formatFoundCount,
  initials,
} from "../format";
import { screenHref } from "../screen-url";
import {
  NoContactsYet,
  NoDueSearchResults,
  NoOneDue,
  NoSearchResults,
} from "./empty-states";
import { ScrollToSelected } from "./scroll-to-selected";

type ContactListProps = {
  // In the «Пора написать» list every row knows how long it has been.
  contacts: (ContactListItem & { daysSinceTalk?: number })[];
  total: number;
  query: string;
  isSearching: boolean;
  isDueList: boolean;
  selectedId: number | null;
};

function EmptyList({
  query,
  isSearching,
  isDueList,
}: Pick<ContactListProps, "query" | "isSearching" | "isDueList">) {
  if (isDueList) {
    return isSearching ? <NoDueSearchResults query={query} /> : <NoOneDue />;
  }
  return isSearching ? <NoSearchResults query={query} /> : <NoContactsYet />;
}

export function ContactList({
  contacts,
  total,
  query,
  isSearching,
  isDueList,
  selectedId,
}: ContactListProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p
        aria-live="polite"
        className="border-b px-4 py-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
      >
        {isSearching
          ? formatFoundCount(contacts.length, total)
          : formatContactCount(total)}
      </p>
      {contacts.length === 0 ? (
        <EmptyList
          query={query}
          isSearching={isSearching}
          isDueList={isDueList}
        />
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {contacts.map((contact) => {
            const isSelected = contact.id === selectedId;
            return (
              <li key={contact.id} className="border-b last:border-b-0">
                <Link
                  href={screenHref({
                    q: query,
                    isDueList,
                    contactId: contact.id,
                  })}
                  scroll={false}
                  prefetch={false}
                  aria-current={isSelected ? "page" : undefined}
                  data-contact-id={contact.id}
                  className="flex items-center gap-3 px-4 py-2.5 outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset aria-[current=page]:bg-accent aria-[current=page]:shadow-[inset_3px_0_0_var(--primary)]"
                >
                  <span
                    aria-hidden
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-[0.7rem] font-semibold text-muted-foreground"
                  >
                    {initials(contact.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {contact.name}
                    </span>
                    {contact.metContext !== "" && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {contact.metContext}
                      </span>
                    )}
                  </span>
                  {contact.daysSinceTalk !== undefined && (
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {formatDayCount(contact.daysSinceTalk)}
                      <span className="sr-only"> без общения</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <ScrollToSelected selectedId={selectedId} />
    </div>
  );
}
