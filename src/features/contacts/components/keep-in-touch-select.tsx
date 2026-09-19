"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { setKeepInTouchDays } from "../actions";
import { formatKeepInTouch } from "../format";
import { KEEP_IN_TOUCH_DAYS } from "../validation";

type SaveError = {
  message: string;
  canRetry: boolean;
  keepInTouchDays: number | null;
};

// How often to keep in touch, under the name in the card: saved as soon as
// it is chosen. If saving fails, the select goes back to what is saved.
export function KeepInTouchSelect({
  contactId,
  keepInTouchDays,
}: {
  contactId: number;
  keepInTouchDays: number | null;
}) {
  const [shownDays, setShownDays] = useOptimistic(keepInTouchDays);
  const [error, setError] = useState<SaveError | null>(null);
  const [isPending, startTransition] = useTransition();

  const save = (days: number | null) => {
    setError(null);
    startTransition(async () => {
      setShownDays(days);
      try {
        const result = await setKeepInTouchDays({
          contactId,
          keepInTouchDays: days,
        });
        if (!result.ok) {
          setError({
            message: result.error,
            canRetry: result.canRetry,
            keepInTouchDays: days,
          });
        }
      } catch {
        // The request itself failed: the app is stopped or unreachable.
        setError({
          message:
            "Не удалось сохранить, как часто общаться: приложение не отвечает",
          canRetry: true,
          keepInTouchDays: days,
        });
      }
    });
  };

  return (
    <>
      <label htmlFor="keep-in-touch" className="sr-only">
        Как часто общаться
      </label>
      <NativeSelect
        id="keep-in-touch"
        size="sm"
        value={shownDays?.toString() ?? ""}
        onChange={(event) =>
          save(event.target.value === "" ? null : Number(event.target.value))
        }
        aria-invalid={error !== null}
        aria-describedby="keep-in-touch-error"
      >
        <NativeSelectOption value="">
          {formatKeepInTouch(null)}
        </NativeSelectOption>
        {KEEP_IN_TOUCH_DAYS.map((days) => (
          <NativeSelectOption key={days} value={days}>
            {formatKeepInTouch(days)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {/* Last in the line, under the status and «Пообщались». */}
      <div
        id="keep-in-touch-error"
        role="alert"
        className="order-last basis-full"
      >
        {error && (
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-destructive">
            <span>{error.message}</span>
            {error.canRetry && (
              <Button
                type="button"
                variant="link"
                size="sm"
                disabled={isPending}
                onClick={() => save(error.keepInTouchDays)}
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
