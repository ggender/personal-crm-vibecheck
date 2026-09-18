import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { screenHref } from "../screen-url";

type ListSwitchProps = {
  query: string;
  isDueList: boolean;
  dueCount: number;
  // The open card stays open when the list changes.
  contactId: number | null;
};

export function ListSwitch({
  query,
  isDueList,
  dueCount,
  contactId,
}: ListSwitchProps) {
  const option = (isActive: boolean) =>
    buttonVariants({ variant: isActive ? "secondary" : "ghost", size: "sm" });

  return (
    <nav
      aria-label="Какие контакты показать"
      className="flex gap-1 border-b px-3 py-2"
    >
      <Link
        href={screenHref({ q: query, contactId })}
        scroll={false}
        aria-current={isDueList ? undefined : "page"}
        className={option(!isDueList)}
      >
        Все
      </Link>
      <Link
        href={screenHref({ q: query, contactId, isDueList: true })}
        scroll={false}
        aria-current={isDueList ? "page" : undefined}
        className={option(isDueList)}
      >
        Пора написать
        <span className="tabular-nums">{dueCount}</span>
      </Link>
    </nav>
  );
}
