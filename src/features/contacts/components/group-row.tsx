"use client";

import { Pencil } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { renameGroup } from "../actions";
import type { GroupWithCount } from "../data/groups-repo";
import { deleteGroupQuestion, formatContactCount } from "../format";
import { firstIssueMessage, renameGroupInput } from "../validation";
import { DeleteGroupButton } from "./delete-dialogs";

type SaveError = { message: string; canRetry: boolean };

// One group in the groups panel: its name and size, «Переименовать» and
// «Удалить».
export function GroupRow({ group }: { group: GroupWithCount }) {
  const [isRenaming, setIsRenaming] = useState(false);
  const renameButtonRef = useRef<HTMLButtonElement>(null);
  const wasRenamingRef = useRef(false);

  // Back from renaming, the keyboard lands where it started.
  useEffect(() => {
    if (wasRenamingRef.current && !isRenaming) {
      renameButtonRef.current?.focus();
    }
    wasRenamingRef.current = isRenaming;
  }, [isRenaming]);

  return (
    <li className="py-2.5">
      {isRenaming ? (
        <RenameGroupForm group={group} onDone={() => setIsRenaming(false)} />
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="min-w-0 flex-1 font-medium wrap-anywhere">
            {group.name}
          </span>
          <span className="text-sm text-muted-foreground tabular-nums">
            {formatContactCount(group.contactCount)}
          </span>
          <span className="flex gap-1">
            <Button
              ref={renameButtonRef}
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Переименовать группу «${group.name}»`}
              onClick={() => setIsRenaming(true)}
            >
              <Pencil aria-hidden />
              Переименовать
            </Button>
            <DeleteGroupButton
              groupId={group.id}
              name={group.name}
              question={deleteGroupQuestion(group.name)}
            />
          </span>
        </div>
      )}
    </li>
  );
}

function RenameGroupForm({
  group,
  onDone,
}: {
  group: GroupWithCount;
  onDone: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const savingRef = useRef(false);
  const [name, setName] = useState(group.name);
  const [error, setError] = useState<SaveError | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputId = `group-${group.id}-name`;
  const statusId = `group-${group.id}-status`;

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const save = () => {
    if (savingRef.current) {
      return;
    }
    const check = renameGroupInput.safeParse({ groupId: group.id, name });
    if (!check.success) {
      setError({ message: firstIssueMessage(check.error), canRetry: false });
      inputRef.current?.focus();
      return;
    }
    savingRef.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const result = await renameGroup({ groupId: group.id, name });
        if (result.ok) {
          startTransition(onDone);
        } else {
          setError({ message: result.error, canRetry: result.canRetry });
          inputRef.current?.focus();
        }
      } catch {
        setError({
          message: "Не удалось переименовать: приложение не отвечает",
          canRetry: true,
        });
      } finally {
        savingRef.current = false;
      }
    });
  };

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="sr-only">
        Новое название группы «{group.name}»
      </label>
      <div className="flex flex-wrap gap-2">
        <Input
          ref={inputRef}
          id={inputId}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              save();
            } else if (event.key === "Escape") {
              event.preventDefault();
              onDone();
            }
          }}
          readOnly={isPending}
          aria-invalid={error !== null}
          aria-describedby={statusId}
          className="h-9 min-w-0 flex-1 basis-48"
        />
        <Button type="button" size="lg" disabled={isPending} onClick={save}>
          {isPending ? "Сохраняю…" : "Сохранить"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          disabled={isPending}
          onClick={onDone}
        >
          Отмена
        </Button>
      </div>
      <div id={statusId} role="alert">
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
                onClick={save}
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
