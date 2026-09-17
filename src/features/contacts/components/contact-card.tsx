import { Pencil, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import type { Contact } from "../data/contacts-repo";
import type { Note } from "../data/notes-repo";
import { formatTodayLabel } from "../format";
import { screenHref } from "../screen-url";
import { NoteForm } from "./note-form";
import { NotesFeed } from "./notes-feed";

type ContactCardProps = {
  contact: Contact;
  notes: Note[];
  now: Date;
  query: string;
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
export function ContactCard({ contact, notes, now, query }: ContactCardProps) {
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
      </dl>
      <div className="flex flex-wrap gap-2">
        <Link
          href={screenHref({ q: query, contactId: contact.id, isEdit: true })}
          scroll={false}
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          <Pencil aria-hidden />
          Изменить
        </Link>
        <Button variant="destructive" size="lg" disabled>
          <Trash2 aria-hidden />
          Удалить контакт
        </Button>
      </div>
    </article>
  );
}
