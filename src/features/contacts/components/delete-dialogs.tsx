"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { deleteContact, deleteNote } from "../actions";
import { screenHref } from "../screen-url";

type ConfirmState = {
  error: string | null;
  isPending: boolean;
};

function DialogError({ error }: { error: string | null }) {
  return (
    <div role="alert">
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function useConfirm(): ConfirmState & {
  run: (action: () => Promise<{ ok: boolean; error?: string }>) => void;
  reset: () => void;
} {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const busyRef = useRef(false);

  const run = (action: () => Promise<{ ok: boolean; error?: string }>) => {
    if (busyRef.current) {
      return;
    }
    busyRef.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) {
          setError(result.error ?? "Не получилось");
        }
      } catch {
        setError("Не удалось удалить: приложение не отвечает");
      } finally {
        busyRef.current = false;
      }
    });
  };

  return { error, isPending, run, reset: () => setError(null) };
}

export function DeleteNoteButton({
  noteId,
  question,
}: {
  noteId: number;
  question: string;
}) {
  const [open, setOpen] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const { error, isPending, run, reset } = useConfirm();

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          reset();
        }
      }}
    >
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Удалить заметку"
            title="Удалить заметку"
            className="text-muted-foreground opacity-70 hover:text-destructive hover:opacity-100 focus-visible:opacity-100"
          />
        }
      >
        <Trash2 aria-hidden />
      </AlertDialogTrigger>
      <AlertDialogContent initialFocus={cancelRef}>
        <AlertDialogHeader>
          <AlertDialogTitle>{question}</AlertDialogTitle>
          <AlertDialogDescription>
            Вернуть удалённую заметку нельзя.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <DialogError error={error} />
        <AlertDialogFooter>
          <AlertDialogCancel ref={cancelRef} disabled={isPending}>
            Отмена
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={() =>
              run(async () => {
                const result = await deleteNote({ noteId });
                if (result.ok) {
                  setOpen(false);
                  document.getElementById("note-body")?.focus();
                }
                return result;
              })
            }
          >
            {isPending ? "Удаляю…" : "Удалить"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function DeleteContactButton({
  contactId,
  question,
  query,
  isDueList,
}: {
  contactId: number;
  question: string;
  query: string;
  isDueList: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const { error, isPending, run, reset } = useConfirm();

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          reset();
        }
      }}
    >
      <AlertDialogTrigger render={<Button variant="destructive" size="lg" />}>
        <Trash2 aria-hidden />
        Удалить контакт
      </AlertDialogTrigger>
      <AlertDialogContent initialFocus={cancelRef}>
        <AlertDialogHeader>
          <AlertDialogTitle>{question}</AlertDialogTitle>
          <AlertDialogDescription>
            Заметки этого человека удалятся вместе с ним. Вернуть их нельзя.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <DialogError error={error} />
        <AlertDialogFooter>
          <AlertDialogCancel ref={cancelRef} disabled={isPending}>
            Отмена
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={() =>
              run(async () => {
                const result = await deleteContact({ contactId });
                if (result.ok) {
                  setOpen(false);
                  // Back to the list, keeping the current search.
                  router.push(screenHref({ q: query, isDueList }));
                }
                return result;
              })
            }
          >
            {isPending ? "Удаляю…" : "Удалить"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
