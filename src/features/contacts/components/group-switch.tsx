import { Plus, Settings2 } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { GroupFilter } from "../data/contacts-repo";
import type { GroupWithCount } from "../data/groups-repo";
import { screenHref } from "../screen-url";

type GroupSwitchProps = {
  groups: GroupWithCount[];
  groupFilter: GroupFilter;
  query: string;
  isDueList: boolean;
  // The open card stays open when the group changes.
  contactId: number | null;
  isGroupsPanel: boolean;
};

// «Все группы · Работа 40 · Друзья 12 · Без группы» above the list; the
// numbers are the size of each group, whatever the search.
export function GroupSwitch({
  groups,
  groupFilter,
  query,
  isDueList,
  contactId,
  isGroupsPanel,
}: GroupSwitchProps) {
  const option = (isActive: boolean) =>
    buttonVariants({ variant: isActive ? "secondary" : "ghost", size: "xs" });
  const filterHref = (filter: GroupFilter) =>
    screenHref({ q: query, isDueList, groupFilter: filter, contactId });
  const panelHref = screenHref({
    q: query,
    isDueList,
    groupFilter,
    isGroupsPanel: true,
  });

  if (groups.length === 0) {
    return (
      <div className="border-b px-3 py-1.5">
        <Link
          href={panelHref}
          scroll={false}
          aria-current={isGroupsPanel ? "page" : undefined}
          className={option(isGroupsPanel)}
        >
          <Plus aria-hidden />
          Создать группу
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-1 border-b px-3 py-1.5">
      {/* One scrolling row on a phone, so the list keeps its room. */}
      <nav
        aria-label="Какую группу показать"
        className="flex min-w-0 flex-1 gap-1 overflow-x-auto md:flex-wrap"
      >
        <Link
          href={filterHref(null)}
          scroll={false}
          aria-current={groupFilter === null ? "page" : undefined}
          className={option(groupFilter === null)}
        >
          Все группы
        </Link>
        {groups.map((group) => (
          <Link
            key={group.id}
            href={filterHref(group.id)}
            scroll={false}
            aria-current={groupFilter === group.id ? "page" : undefined}
            className={option(groupFilter === group.id)}
          >
            <span className="max-w-40 truncate">{group.name}</span>
            <span className="text-muted-foreground tabular-nums">
              {group.contactCount}
            </span>
          </Link>
        ))}
        <Link
          href={filterHref("none")}
          scroll={false}
          aria-current={groupFilter === "none" ? "page" : undefined}
          className={option(groupFilter === "none")}
        >
          Без группы
        </Link>
      </nav>
      <Link
        href={panelHref}
        scroll={false}
        aria-label="Настроить группы"
        title="Настроить группы"
        aria-current={isGroupsPanel ? "page" : undefined}
        className={buttonVariants({
          variant: isGroupsPanel ? "secondary" : "ghost",
          size: "icon-xs",
        })}
      >
        <Settings2 aria-hidden />
      </Link>
    </div>
  );
}
