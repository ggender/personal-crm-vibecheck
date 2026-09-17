import type { Note } from "../data/notes-repo";
import { deleteNoteQuestion, formatNoteDate } from "../format";
import { DeleteNoteButton } from "./delete-dialogs";

type NotesFeedProps = {
  notes: Note[];
  now: Date;
};

export function NotesFeed({ notes, now }: NotesFeedProps) {
  return (
    <section aria-labelledby="notes-heading">
      <h3 id="notes-heading" className="sr-only">
        Заметки
      </h3>
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Заметок пока нет. Запиши, о чём договорились.
        </p>
      ) : (
        <ol className="space-y-4">
          {notes.map((note) => (
            <li key={note.id} className="border-l-2 border-border pl-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  <time dateTime={note.createdAt.toISOString()}>
                    {formatNoteDate(note.createdAt, now)}
                  </time>
                </p>
                <DeleteNoteButton
                  noteId={note.id}
                  question={deleteNoteQuestion(note.createdAt, now)}
                />
              </div>
              <p className="mt-0.5 text-sm wrap-anywhere whitespace-pre-wrap">
                {note.body}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
