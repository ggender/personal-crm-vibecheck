"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { createContact, updateContact } from "../actions";
import type { Contact } from "../data/contacts-repo";
import { formatKeepInTouch } from "../format";
import { screenHref } from "../screen-url";
import { KEEP_IN_TOUCH_DAYS } from "../validation";

type ContactFormProps = {
  query: string;
  isDueList: boolean;
  // Editing an existing contact, or a new one with an optional suggested name.
  contact?: Contact;
  suggestedName?: string;
};

type Values = {
  name: string;
  metContext: string;
  phone: string;
  email: string;
  // "" means "не следить"; otherwise a number of days as text.
  keepInTouchDays: string;
  firstNote: string;
};

const FIELD_ORDER = [
  "name",
  "metContext",
  "phone",
  "email",
  "keepInTouchDays",
  "firstNote",
];

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <Label
      htmlFor={htmlFor}
      className="text-xs font-semibold tracking-wider text-muted-foreground uppercase"
    >
      {children}
    </Label>
  );
}

export function ContactForm({
  query,
  isDueList,
  contact,
  suggestedName = "",
}: ContactFormProps) {
  const router = useRouter();
  const isEdit = contact !== undefined;
  const [values, setValues] = useState<Values>({
    name: contact?.name ?? suggestedName,
    metContext: contact?.metContext ?? "",
    phone: contact?.phone ?? "",
    email: contact?.email ?? "",
    keepInTouchDays: contact?.keepInTouchDays?.toString() ?? "",
    firstNote: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const savingRef = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const set = (field: keyof Values) => (value: string) =>
    setValues((previous) => ({ ...previous, [field]: value }));

  const showErrors = (nextErrors: Record<string, string>) => {
    setErrors(nextErrors);
    const firstField = FIELD_ORDER.find((field) => field in nextErrors);
    if (firstField) {
      document.getElementById(`contact-${firstField}`)?.focus();
    }
  };

  const submit = () => {
    if (savingRef.current) {
      return;
    }
    savingRef.current = true;
    setErrors({});
    setFormError(null);
    const input = {
      ...values,
      keepInTouchDays:
        values.keepInTouchDays === "" ? null : Number(values.keepInTouchDays),
    };
    startTransition(async () => {
      try {
        const result = isEdit
          ? await updateContact({ id: contact.id, ...input })
          : await createContact(input);
        if (result.ok) {
          // A new contact is shown without the search and the «Пора
          // написать» list, so it is visible.
          startTransition(() =>
            router.push(
              screenHref({
                q: isEdit ? query : "",
                isDueList: isEdit && isDueList,
                contactId: result.contactId,
              }),
            ),
          );
        } else if ("fieldErrors" in result) {
          showErrors(result.fieldErrors);
        } else {
          setFormError(result.error);
        }
      } catch {
        setFormError("Не удалось сохранить: приложение не отвечает");
      } finally {
        savingRef.current = false;
      }
    });
  };

  const fieldProps = (field: keyof Values) => ({
    id: `contact-${field}`,
    name: field,
    value: values[field],
    "aria-invalid": field in errors,
    "aria-describedby": field in errors ? `error-${field}` : undefined,
    onChange: (
      event: ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => set(field)(event.target.value),
  });

  const fieldError = (field: keyof Values) =>
    errors[field] && (
      <p
        id={`error-${field}`}
        role="alert"
        className="text-sm text-destructive"
      >
        {errors[field]}
      </p>
    );

  return (
    <form
      // Our own checks show Russian messages under the field, so the
      // browser's built-in bubbles must not intercept anything. The buttons
      // are type="button": before the page comes alive a real submit button
      // would make the browser send the form itself, with the typed values
      // landing in the address bar.
      noValidate
      className="mx-auto w-full max-w-2xl space-y-5 p-4 sm:p-6"
      onKeyDown={(event) => {
        const target = event.target as HTMLElement;
        if (event.key === "Enter" && target.tagName === "INPUT") {
          event.preventDefault();
          submit();
        }
      }}
    >
      <h2 className="font-heading text-3xl leading-tight font-semibold">
        {isEdit ? "Изменить контакт" : "Новый контакт"}
      </h2>

      <div className="space-y-1.5">
        <FieldLabel htmlFor="contact-name">
          Имя — единственное обязательное
        </FieldLabel>
        <Input ref={nameRef} {...fieldProps("name")} className="h-9" />
        {fieldError("name")}
      </div>

      <div className="space-y-1.5">
        <FieldLabel htmlFor="contact-metContext">Откуда знакомы</FieldLabel>
        <Input
          {...fieldProps("metContext")}
          placeholder="Например: конференция ProductCamp, 2025"
          className="h-9"
        />
        {fieldError("metContext")}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <FieldLabel htmlFor="contact-phone">Телефон</FieldLabel>
          <Input
            {...fieldProps("phone")}
            type="tel"
            placeholder="можно потом"
            className="h-9"
          />
          {fieldError("phone")}
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="contact-email">Почта</FieldLabel>
          <Input
            {...fieldProps("email")}
            type="email"
            placeholder="можно потом"
            className="h-9"
          />
          {fieldError("email")}
        </div>
      </div>

      <div className="space-y-1.5">
        <FieldLabel htmlFor="contact-keepInTouchDays">
          Как часто общаться
        </FieldLabel>
        <NativeSelect
          {...fieldProps("keepInTouchDays")}
          className="w-full *:data-[slot=native-select]:h-9 sm:w-64"
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
        {fieldError("keepInTouchDays")}
      </div>

      {!isEdit && (
        <div className="space-y-1.5">
          <FieldLabel htmlFor="contact-firstNote">
            О чём договорились
          </FieldLabel>
          <Textarea
            {...fieldProps("firstNote")}
            placeholder="Необязательно: первая заметка"
            className="min-h-20 bg-card text-base md:text-sm"
          />
          {fieldError("firstNote")}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="lg" disabled={isPending} onClick={submit}>
          {isPending ? "Сохраняю…" : isEdit ? "Сохранить" : "Добавить"}
        </Button>
        <Link
          href={screenHref({
            q: query,
            isDueList,
            contactId: isEdit ? contact.id : undefined,
          })}
          scroll={false}
          className={buttonVariants({ variant: "ghost", size: "lg" })}
        >
          Отмена
        </Link>
      </div>

      <div role="alert">
        {formError && (
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-destructive">
            <span>{formError}. Введённое на месте.</span>
            <Button
              type="button"
              variant="link"
              size="sm"
              disabled={isPending}
              onClick={submit}
              className="h-auto px-0 text-destructive underline"
            >
              Повторить
            </Button>
          </p>
        )}
      </div>
    </form>
  );
}
