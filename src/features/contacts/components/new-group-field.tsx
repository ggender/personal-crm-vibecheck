"use client";

import { Plus } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createGroup } from "../actions";
import { createGroupInput, firstIssueMessage } from "../validation";

type NewGroupFieldProps = {
  // Gets the id of the new group, e.g. to tick it in the contact form.
  onCreated?: (groupId: number) => void;
  focusOnMount?: boolean;
};

type SaveError = { message: string; canRetry: boolean };

// «Новая группа» + «Создать группу», in the groups panel and in the contact
// form. Not a <form> of its own: in the contact form it would be nested.
export function NewGroupField({
  onCreated,
  focusOnMount = false,
}: NewGroupFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const savingRef = useRef(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<SaveError | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (focusOnMount) {
      inputRef.current?.focus();
    }
  }, [focusOnMount]);

  const create = () => {
    if (savingRef.current) {
      return;
    }
    const check = createGroupInput.safeParse({ name });
    if (!check.success) {
      setError({ message: firstIssueMessage(check.error), canRetry: false });
      inputRef.current?.focus();
      return;
    }
    savingRef.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const result = await createGroup({ name });
        if (result.ok) {
          // Clear together with the new group appearing in the list.
          startTransition(() => {
            setName("");
            onCreated?.(result.groupId);
          });
        } else {
          setError({ message: result.error, canRetry: result.canRetry });
        }
      } catch {
        // The request itself failed: the app is stopped or unreachable.
        setError({
          message: "Не удалось создать группу: приложение не отвечает",
          canRetry: true,
        });
      } finally {
        savingRef.current = false;
        inputRef.current?.focus();
      }
    });
  };

  return (
    <div className="space-y-1.5">
      <label htmlFor="group-new" className="sr-only">
        Новая группа
      </label>
      <div className="flex flex-wrap gap-2">
        <Input
          ref={inputRef}
          id="group-new"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            // Enter creates the group; in the contact form it must not save
            // the contact as well.
            if (event.key === "Enter") {
              event.preventDefault();
              event.stopPropagation();
              create();
            }
          }}
          readOnly={isPending}
          placeholder="Новая группа"
          aria-invalid={error !== null}
          aria-describedby="group-new-status"
          className="h-9 min-w-0 flex-1 basis-48"
        />
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={isPending}
          onClick={create}
        >
          <Plus aria-hidden />
          {isPending ? "Создаю…" : "Создать группу"}
        </Button>
      </div>
      <div id="group-new-status" role="alert">
        {error && (
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-destructive">
            <span>
              {error.message}
              {error.canRetry && ". Название на месте."}
            </span>
            {error.canRetry && (
              <Button
                type="button"
                variant="link"
                size="sm"
                disabled={isPending}
                onClick={create}
                className="h-auto px-0 text-destructive underline"
              >
                Повторить
              </Button>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
