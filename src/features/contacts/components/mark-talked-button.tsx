"use client";

import { Check } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { markTalked } from "../actions";

type MarkError = { message: string; canRetry: boolean };

// «Пообщались»: restarts the keep-in-touch clock without writing a note.
function useMarkTalked(contactId: number, onMarked?: () => void) {
  const savingRef = useRef(false);
  const [error, setError] = useState<MarkError | null>(null);
  const [isPending, startTransition] = useTransition();

  const mark = () => {
    if (savingRef.current) {
      return;
    }
    savingRef.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const result = await markTalked({ contactId });
        if (result.ok) {
          onMarked?.();
        } else {
          setError({ message: result.error, canRetry: result.canRetry });
        }
      } catch {
        // The request itself failed: the app is stopped or unreachable.
        setError({
          message: "Не удалось отметить: приложение не отвечает",
          canRetry: true,
        });
      } finally {
        savingRef.current = false;
      }
    });
  };

  return { mark, error, isPending };
}

function MarkTalkedError({
  error,
  isPending,
  onRetry,
  className,
}: {
  error: MarkError | null;
  isPending: boolean;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={className}>
      {error && (
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-destructive">
          <span>{error.message}</span>
          {error.canRetry && (
            <Button
              type="button"
              variant="link"
              size="sm"
              disabled={isPending}
              onClick={onRetry}
              className="h-auto px-0 text-destructive underline"
            >
              Повторить
            </Button>
          )}
        </p>
      )}
    </div>
  );
}

// In the card, next to the keep-in-touch line.
export function MarkTalkedButton({ contactId }: { contactId: number }) {
  const { mark, error, isPending } = useMarkTalked(contactId);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={mark}
      >
        <Check aria-hidden />
        {isPending ? "Отмечаю…" : "Пообщались"}
      </Button>
      <MarkTalkedError
        error={error}
        isPending={isPending}
        onRetry={mark}
        className="basis-full"
      />
    </>
  );
}

// A row of the «Пора написать» list: the row link, a ✓ on its right, and
// what went wrong under it. Once marked, the contact leaves the list.
export function MarkTalkedRow({
  contactId,
  contactName,
  children,
}: {
  contactId: number;
  contactName: string;
  children: ReactNode;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  // The focus would go with the row: it moves on to the next row's ✓.
  const nextButtonRef = useRef<HTMLElement | null>(null);
  const isMarkedRef = useRef(false);
  const { mark, error, isPending } = useMarkTalked(contactId, () => {
    isMarkedRef.current = true;
  });

  useEffect(
    () => () => {
      if (isMarkedRef.current && nextButtonRef.current?.isConnected) {
        nextButtonRef.current.focus();
      }
    },
    [],
  );

  const markFromHere = () => {
    const row = buttonRef.current?.closest("li");
    const neighbour = row?.nextElementSibling ?? row?.previousElementSibling;
    nextButtonRef.current = row?.contains(document.activeElement)
      ? (neighbour?.querySelector<HTMLElement>("[data-mark-talked]") ?? null)
      : null;
    mark();
  };

  return (
    <>
      <div className="relative">
        {children}
        <Button
          ref={buttonRef}
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={isPending}
          onClick={markFromHere}
          aria-label={`Пообщались: ${contactName}`}
          title="Пообщались"
          data-mark-talked=""
          className="absolute top-1/2 right-3 -translate-y-1/2"
        >
          <Check aria-hidden />
        </Button>
      </div>
      <MarkTalkedError
        error={error}
        isPending={isPending}
        onRetry={markFromHere}
        className="px-4 [&>p]:pb-2"
      />
    </>
  );
}
