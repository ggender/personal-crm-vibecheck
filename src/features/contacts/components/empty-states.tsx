import { UserPlus } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { GroupFilter } from "../data/contacts-repo";
import { screenHref } from "../screen-url";

export function StartHint() {
  return (
    <div className="grid h-full min-h-64 place-items-center p-8 text-center">
      <div className="max-w-sm">
        <h2 className="font-heading text-2xl leading-snug font-semibold">
          С кем ты только что говорил?
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Начни печатать имя — курсор уже в поиске. Или выбери человека из
          списка.
        </p>
      </div>
    </div>
  );
}

export function NoSearchResults({ query }: { query: string }) {
  const name = query.trim();
  return (
    <div className="px-4 py-8 text-center">
      <p className="font-medium">Никого не нашлось</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Проверь имя или добавь нового человека.
      </p>
      <Link
        href={screenHref({ q: query, isNew: true, newName: name })}
        className={buttonVariants({
          variant: "outline",
          className: "mt-4 h-auto max-w-full py-1.5 whitespace-normal",
        })}
      >
        <UserPlus aria-hidden />
        <span className="min-w-0 break-words">Добавить «{name}»</span>
      </Link>
    </div>
  );
}

export function NoOneDue() {
  return (
    <div className="px-4 py-8 text-center">
      <p className="font-medium">Сейчас никому не пора писать</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Как часто общаться с человеком, задаётся в его карточке: «Изменить» →
        «Как часто общаться».
      </p>
    </div>
  );
}

export function NoDueSearchResults({ query }: { query: string }) {
  return (
    <div className="px-4 py-8 text-center">
      <p className="font-medium">
        Среди тех, кому пора написать, никого не нашлось
      </p>
      <Link
        href={screenHref({ q: query })}
        className={buttonVariants({ variant: "outline", className: "mt-4" })}
      >
        Искать среди всех
      </Link>
    </div>
  );
}

// groupName is null for «Без группы».
export function EmptyGroup({ groupName }: { groupName: string | null }) {
  return (
    <div className="px-4 py-8 text-center">
      <p className="font-medium wrap-anywhere">
        {groupName === null
          ? "Все контакты разложены по группам"
          : `В группе «${groupName}» пока никого`}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        В какие группы входит человек, отмечается в его карточке: «Изменить» →
        «Группы».
      </p>
    </div>
  );
}

export function NoGroupSearchResults({
  query,
  groupName,
}: {
  query: string;
  groupName: string | null;
}) {
  return (
    <div className="px-4 py-8 text-center">
      <p className="font-medium wrap-anywhere">
        {groupName === null
          ? "Среди контактов без группы никого не нашлось"
          : `В группе «${groupName}» никого не нашлось`}
      </p>
      <Link
        href={screenHref({ q: query })}
        className={buttonVariants({ variant: "outline", className: "mt-4" })}
      >
        Искать среди всех
      </Link>
    </div>
  );
}

export function NoContactsYet() {
  return (
    <div className="px-4 py-8 text-center">
      <p className="font-medium">Контактов пока нет</p>
      <Link
        href={screenHref({ isNew: true })}
        className={buttonVariants({ variant: "outline", className: "mt-4" })}
      >
        <UserPlus aria-hidden />
        Добавить первого
      </Link>
    </div>
  );
}

export function ContactMissing({
  query,
  isDueList,
  groupFilter,
}: {
  query: string;
  isDueList: boolean;
  groupFilter: GroupFilter;
}) {
  return (
    <div className="grid h-full min-h-64 place-items-center p-8 text-center">
      <div className="max-w-sm">
        <h2 className="font-heading text-2xl leading-snug font-semibold">
          Такого контакта больше нет
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Возможно, его удалили в другой вкладке или ссылка неправильная. Список
          контактов работает как обычно.
        </p>
        <Link
          href={screenHref({ q: query, isDueList, groupFilter })}
          className={buttonVariants({ variant: "outline", className: "mt-4" })}
        >
          К списку
        </Link>
      </div>
    </div>
  );
}
