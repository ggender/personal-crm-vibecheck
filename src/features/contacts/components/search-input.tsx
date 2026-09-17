"use client";

import { LoaderCircle, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useTransition,
} from "react";
import { Input } from "@/components/ui/input";
import { readScreenState, screenHref } from "../screen-url";

// Pause after the last keystroke before asking the server.
const SEARCH_DELAY_MS = 250;

type SearchInputProps = {
  query: string;
  focusOnLoad: boolean;
};

export function SearchInput({ query, focusOnLoad }: SearchInputProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(query);
  const [sentQuery, setSentQuery] = useState(query);
  const [seenQuery, setSeenQuery] = useState(query);

  // The address changed from outside (e.g. a new contact reset the search).
  // Our own requests echo back and must not overwrite what is being typed.
  if (query !== seenQuery) {
    setSeenQuery(query);
    if (query !== sentQuery) {
      setValue(query);
      setSentQuery(query);
    }
  }

  useEffect(() => {
    if (focusOnLoad) {
      inputRef.current?.focus();
    }
  }, [focusOnLoad]);

  const send = (nextQuery: string) => {
    setSentQuery(nextQuery);
    const state = readScreenState(Object.fromEntries(searchParams));
    startTransition(() => {
      router.replace(screenHref({ ...state, q: nextQuery }), { scroll: false });
    });
  };

  const sendTypedValue = useEffectEvent(() => send(value));

  useEffect(() => {
    if (value === sentQuery) {
      return;
    }
    const timer = setTimeout(sendTypedValue, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [value, sentQuery]);

  return (
    <form
      role="search"
      action="/"
      className="relative min-w-0 flex-1"
      onSubmit={(event) => {
        event.preventDefault();
        if (value !== sentQuery) {
          send(value);
        }
      }}
    >
      <label htmlFor="contact-search" className="sr-only">
        Поиск по имени
      </label>
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        ref={inputRef}
        id="contact-search"
        name="q"
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Поиск по имени…"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        aria-busy={isPending}
        className="h-9 bg-background pr-8 pl-8"
      />
      {isPending && (
        <LoaderCircle
          aria-hidden
          className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
        />
      )}
    </form>
  );
}
