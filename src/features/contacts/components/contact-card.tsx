import { Pencil } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { Contact, GroupFilter } from "../data/contacts-repo";
import type { Group } from "../data/groups-repo";
import type { Note } from "../data/notes-repo";
import {
  deleteContactQuestion,
  formatKeepInTouch,
  formatKeepInTouchStatus,
  formatTodayLabel,
} from "../format";
import type { KeepInTouchState } from "../keep-in-touch";
import { screenHref } from "../screen-url";
import { DeleteContactButton } from "./delete-dialogs";
import { MarkTalkedButton } from "./mark-talked-button";
import { NoteForm } from "./note-form";
import { NotesFeed } from "./notes-feed";

type ContactCardProps = {
  contact: Contact;
  notes: Note[];
  groups: Group[];
  // null when nobody keeps in touch with this contact on a rhythm.
  keepInTouch: KeepInTouchState | null;
  now: Date;
  query: string;
  isDueList: boolean;
  groupFilter: GroupFilter;
};

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 wrap-anywhere">{children}</dd>
    </div>
  );
}

function NotSet() {
  return <span className="text-muted-foreground">не указано</span>;
}

// Order matters: the note comes before phone and email. This is not an address book.
export function ContactCard({
  contact,
  notes,
  groups,
  keepInTouch,
  now,
  query,
  isDueList,
  groupFilter,
}: ContactCardProps) {
  return (
    <article
      aria-labelledby="contact-name"
      className="mx-auto w-full max-w-2xl space-y-6 p-4 sm:p-6"
    >
      <h2
        id="contact-name"
        className="font-heading text-3xl leading-tight font-semibold wrap-anywhere"
      >
        {contact.name}
      </h2>
      {keepInTouch && (
        <div className="-mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <p
            aria-live="polite"
            className={
              keepInTouch.isDue
                ? "text-sm font-medium"
                : "text-sm text-muted-foreground"
            }
          >
            {formatKeepInTouchStatus(keepInTouch)}
          </p>
          <MarkTalkedButton key={contact.id} contactId={contact.id} />
        </div>
      )}
      <NoteForm
        key={contact.id}
        contactId={contact.id}
        todayLabel={formatTodayLabel(now)}
      />
      <NotesFeed notes={notes} now={now} />
      <dl className="space-y-2 border-t pt-4 text-sm">
        <Detail label="Откуда знакомы">
          {contact.metContext || <NotSet />}
        </Detail>
        <Detail label="Группы">
          {groups.length > 0 ? (
            groups.map((group) => group.name).join(", ")
          ) : (
            <span className="text-muted-foreground">без группы</span>
          )}
        </Detail>
        <Detail label="Телефон">
          {contact.phone ? (
            <a
              href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}
              className="underline-offset-4 hover:underline"
            >
              {contact.phone}
            </a>
          ) : (
            <NotSet />
          )}
        </Detail>
        <Detail label="Почта">
          {contact.email ? (
            <a
              href={`mailto:${contact.email}`}
              className="underline-offset-4 hover:underline"
            >
              {contact.email}
            </a>
          ) : (
            <NotSet />
          )}
        </Detail>
        <Detail label="Как часто общаться">
          {contact.keepInTouchDays === null ? (
            <span className="text-muted-foreground">
              {formatKeepInTouch(null)}
            </span>
          ) : (
            formatKeepInTouch(contact.keepInTouchDays)
          )}
        </Detail>
      </dl>
      <div className="flex flex-wrap gap-2">
        <Link
          href={screenHref({
            q: query,
            isDueList,
            groupFilter,
            contactId: contact.id,
            isEdit: true,
          })}
          scroll={false}
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          <Pencil aria-hidden />
          Изменить
        </Link>
        <DeleteContactButton
          contactId={contact.id}
          query={query}
          isDueList={isDueList}
          groupFilter={groupFilter}
          question={deleteContactQuestion(contact.name, notes.length)}
        />
      </div>
    </article>
  );
}
