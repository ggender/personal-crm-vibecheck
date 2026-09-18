"use client";

import { Check } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { markTalked } from "../actions";

type MarkError = { message: string; canRetry: boolean };

// «Пообщались»: restarts the keep-in-touch clock without writing a note.
export function MarkTalkedButton({ contactId }: { contactId: number }) {
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
        if (!result.ok) {
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
      <div role="alert" className="basis-full">
        {error && (
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-destructive">
            <span>{error.message}</span>
            {error.canRetry && (
              <Button
                type="button"
                variant="link"
                size="sm"
                disabled={isPending}
                onClick={mark}
                className="h-auto px-0 text-destructive underline"
              >
                Повторить
              </Button>
            )}
          </p>
        )}
      </div>
    </>
  );
}
