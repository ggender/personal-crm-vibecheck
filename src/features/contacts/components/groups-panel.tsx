import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { GroupFilter } from "../data/contacts-repo";
import type { GroupWithCount } from "../data/groups-repo";
import { screenHref } from "../screen-url";
import { GroupRow } from "./group-row";
import { NewGroupField } from "./new-group-field";

type GroupsPanelProps = {
  groups: GroupWithCount[];
  query: string;
  isDueList: boolean;
  groupFilter: GroupFilter;
};

// The right panel at /?groups=1: create, rename and delete groups.
export function GroupsPanel({
  groups,
  query,
  isDueList,
  groupFilter,
}: GroupsPanelProps) {
  return (
    <article
      aria-labelledby="groups-heading"
      className="mx-auto w-full max-w-2xl space-y-5 p-4 sm:p-6"
    >
      <h2
        id="groups-heading"
        className="font-heading text-3xl leading-tight font-semibold"
      >
        Группы
      </h2>
      <NewGroupField focusOnMount />
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Групп пока нет. Например: «Работа», «Семья», «Соседи».
        </p>
      ) : (
        <ul aria-label="Все группы" className="divide-y border-y">
          {groups.map((group) => (
            <GroupRow key={group.id} group={group} />
          ))}
        </ul>
      )}
      <p className="text-sm text-muted-foreground">
        В какие группы входит человек, отмечается в его карточке: «Изменить» →
        «Группы». Один человек может быть в нескольких группах.
      </p>
      <Link
        href={screenHref({ q: query, isDueList, groupFilter })}
        scroll={false}
        className={buttonVariants({ variant: "outline", size: "lg" })}
      >
        Готово
      </Link>
    </article>
  );
}
