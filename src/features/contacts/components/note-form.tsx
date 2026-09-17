"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addNote } from "../actions";
import { LIMITS, firstIssueMessage, noteBody } from "../validation";

type NoteFormProps = {
  contactId: number;
  todayLabel: string;
};

type SaveError = { message: string; canRetry: boolean };

// Show the counter only when the limit gets close.
const COUNTER_FROM = LIMITS.note - 500;

export function NoteForm({ contactId, todayLabel }: NoteFormProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const savingRef = useRef(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState<SaveError | null>(null);
  const [isPending, startTransition] = useTransition();

  // The card is re-mounted per contact, so this runs when a card opens.
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const save = () => {
    if (savingRef.current) {
      return;
    }
    const check = noteBody.safeParse(body);
    if (!check.success) {
      setError({ message: firstIssueMessage(check.error), canRetry: false });
      textareaRef.current?.focus();
      return;
    }
    savingRef.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const result = await addNote({ contactId, body });
        if (result.ok) {
          // Clear together with the new note appearing in the feed.
          startTransition(() => setBody(""));
        } else {
          setError({ message: result.error, canRetry: result.canRetry });
        }
      } catch {
        // The request itself failed: the app is stopped or unreachable.
        setError({
          message: "Не удалось сохранить: приложение не отвечает",
          canRetry: true,
        });
      } finally {
        savingRef.current = false;
        textareaRef.current?.focus();
      }
    });
  };

  const length = body.length;
  const isTooLong = length > LIMITS.note;

  return (
    // The buttons are type="button" on purpose: before the page comes alive
    // a real submit button would make the browser send the form itself and
    // put the note text into the address bar.
    <form className="space-y-2">
      <label htmlFor="note-body" className="sr-only">
        Новая заметка
      </label>
      <Textarea
        ref={textareaRef}
        id="note-body"
        name="body"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        readOnly={isPending}
        placeholder="О чём договорились?"
        aria-invalid={error !== null || isTooLong}
        aria-describedby="note-status"
        className="max-h-80 min-h-24 bg-card text-base md:text-sm"
      />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-xs text-muted-foreground">
          {todayLabel}
          {length >= COUNTER_FROM && (
            <span className={isTooLong ? "font-medium text-destructive" : ""}>
              {" · "}
              {length} из {LIMITS.note} знаков
            </span>
          )}
        </p>
        <Button type="button" size="lg" disabled={isPending} onClick={save}>
          {isPending ? "Сохраняю…" : "Сохранить заметку"}
        </Button>
      </div>
      <div id="note-status" role="alert" className="min-h-0">
        {error && (
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-destructive">
            <span>
              {error.message}
              {error.canRetry && ". Текст на месте."}
            </span>
            {error.canRetry && (
              <Button
                type="button"
                variant="link"
                size="sm"
                disabled={isPending}
                onClick={save}
                className="h-auto px-0 text-destructive underline"
              >
                Повторить
              </Button>
            )}
          </p>
        )}
      </div>
    </form>
  );
}
