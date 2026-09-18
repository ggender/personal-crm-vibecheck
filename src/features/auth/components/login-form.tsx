"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMinuteCount } from "@/features/contacts/format";
import { authClient } from "../auth-client";
import { LOGIN_LINK_MINUTES, loginEmail } from "../validation";

type SendError = { message: string; canRetry: boolean };

// Better Auth answers with an HTTP status; the person gets a sentence.
function errorFor(status: number): SendError {
  if (status === 429) {
    return {
      message: "Слишком много попыток — подожди минуту",
      canRetry: false,
    };
  }
  if (status === 400) {
    return {
      message: "Проверь почту — похоже, в ней опечатка",
      canRetry: false,
    };
  }
  return { message: "Не удалось отправить письмо", canRetry: true };
}

export function LoginForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const sendingRef = useRef(false);
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<SendError | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const send = () => {
    if (sendingRef.current) {
      return;
    }
    const check = loginEmail.safeParse(email);
    if (!check.success) {
      setError({
        message: check.error.issues[0]?.message ?? "Проверь почту",
        canRetry: false,
      });
      inputRef.current?.focus();
      return;
    }
    const address = check.data;
    sendingRef.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const result = await authClient.signIn.magicLink({
          email: address,
          callbackURL: "/",
          // Better Auth adds ?error=… when the link is stale or used.
          errorCallbackURL: "/login",
        });
        if (result.error) {
          setError(errorFor(result.error.status));
        } else {
          setSentTo(address);
        }
      } catch {
        // The request itself failed: the app is stopped or unreachable.
        setError({
          message: "Не удалось отправить письмо: приложение не отвечает",
          canRetry: true,
        });
      } finally {
        sendingRef.current = false;
      }
    });
  };

  const otherAddress = () => {
    setSentTo(null);
    setError(null);
    // The field comes back on the next render.
    setTimeout(() => inputRef.current?.focus());
  };

  if (sentTo !== null) {
    return (
      <div className="space-y-4">
        <p role="status" className="text-sm">
          Письмо со ссылкой отправлено на{" "}
          <span className="font-medium break-all">{sentTo}</span>. Ссылка
          действует {formatMinuteCount(LOGIN_LINK_MINUTES)}.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={send}
          >
            {isPending ? "Отправляю…" : "Отправить ещё раз"}
          </Button>
          <Button type="button" variant="ghost" onClick={otherAddress}>
            Другая почта
          </Button>
        </div>
        <div role="alert">
          {error && <p className="text-sm text-destructive">{error.message}</p>}
        </div>
      </div>
    );
  }

  return (
    // The field has no name on purpose: if the form is sent before the page
    // comes alive, the browser has nothing to put into the address bar.
    // noValidate: the messages come from validation.ts, in Russian.
    <form
      noValidate
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="login-email">Почта</Label>
        <Input
          ref={inputRef}
          id="login-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          readOnly={isPending}
          aria-invalid={error !== null}
          aria-describedby="login-status"
          className="h-9"
        />
      </div>
      <Button type="submit" size="lg" disabled={isPending} className="w-full">
        {isPending ? "Отправляю…" : "Получить ссылку для входа"}
      </Button>
      <div id="login-status" role="alert">
        {error && (
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-destructive">
            <span>{error.message}</span>
            {error.canRetry && (
              <Button
                type="button"
                variant="link"
                size="sm"
                disabled={isPending}
                onClick={send}
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
