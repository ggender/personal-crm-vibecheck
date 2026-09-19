"use client";

import { X } from "lucide-react";
import {
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { Button } from "@/components/ui/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { addContactToGroup, removeContactFromGroup } from "../actions";
import type { Group } from "../data/groups-repo";

type GroupChange = { groupId: number; isAdded: boolean };

type SaveError = { message: string; canRetry: boolean; change: GroupChange };

// The groups of the contact in the card: each with a × to take it out, and
// «Добавить в группу» for the rest. Every change is saved at once.
export function ContactGroupChips({
  contactId,
  contactGroupIds,
  groups,
}: {
  contactId: number;
  contactGroupIds: number[];
  // All groups of the owner, alphabetically.
  groups: Group[];
}) {
  const [shownIds, applyChange] = useOptimistic(
    contactGroupIds,
    (ids: number[], { groupId, isAdded }: GroupChange) =>
      isAdded ? [...ids, groupId] : ids.filter((id) => id !== groupId),
  );
  const [error, setError] = useState<SaveError | null>(null);
  const [isPending, startTransition] = useTransition();
  const addRef = useRef<HTMLSelectElement>(null);
  // The × that had the focus is gone: the focus goes to «Добавить в группу».
  const isFocusToAddRef = useRef(false);

  useEffect(() => {
    if (isFocusToAddRef.current && addRef.current) {
      isFocusToAddRef.current = false;
      addRef.current.focus();
    }
  });

  const save = (change: GroupChange) => {
    setError(null);
    startTransition(async () => {
      applyChange(change);
      const input = { contactId, groupId: change.groupId };
      try {
        const result = change.isAdded
          ? await addContactToGroup(input)
          : await removeContactFromGroup(input);
        if (!result.ok) {
          setError({
            message: result.error,
            canRetry: result.canRetry,
            change,
          });
        }
      } catch {
        // The request itself failed: the app is stopped or unreachable.
        setError({
          message: change.isAdded
            ? "Не удалось добавить в группу: приложение не отвечает"
            : "Не удалось убрать из группы: приложение не отвечает",
          canRetry: true,
          change,
        });
      }
    });
  };

  const contactGroups = groups.filter((group) => shownIds.includes(group.id));
  const otherGroups = groups.filter((group) => !shownIds.includes(group.id));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {contactGroups.length === 0 && (
        <span className="mr-1 text-muted-foreground">без группы</span>
      )}
      {contactGroups.map((group) => (
        <span
          key={group.id}
          className="inline-flex max-w-full items-center gap-0.5 rounded-md bg-secondary py-0.5 pr-0.5 pl-2 text-secondary-foreground"
        >
          <span className="min-w-0 wrap-anywhere">{group.name}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Убрать из группы «${group.name}»`}
            title="Убрать из группы"
            onClick={() => {
              isFocusToAddRef.current = true;
              save({ groupId: group.id, isAdded: false });
            }}
          >
            <X aria-hidden />
          </Button>
        </span>
      ))}
      {otherGroups.length > 0 && (
        <>
          <label htmlFor="contact-group-add" className="sr-only">
            Добавить в группу
          </label>
          <NativeSelect
            ref={addRef}
            id="contact-group-add"
            size="sm"
            value=""
            onChange={(event) => {
              if (event.target.value !== "") {
                save({ groupId: Number(event.target.value), isAdded: true });
              }
            }}
            aria-describedby="contact-group-error"
          >
            <NativeSelectOption value="">Добавить в группу…</NativeSelectOption>
            {otherGroups.map((group) => (
              <NativeSelectOption key={group.id} value={group.id}>
                {group.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </>
      )}
      <div id="contact-group-error" role="alert" className="basis-full">
        {error && (
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-destructive">
            <span>{error.message}</span>
            {error.canRetry && (
              <Button
                type="button"
                variant="link"
                size="sm"
                disabled={isPending}
                onClick={() => save(error.change)}
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
