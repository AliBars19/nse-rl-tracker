"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { TeamKey } from "@/lib/domain/types";
import { switchTeamHref } from "./nav";

export interface TeamSwitcherOption {
  key: TeamKey;
  label: string;
  short: string;
}

/**
 * Team switcher shown at the top of every page. Switching keeps you on the same page.
 * 'solid' = parallelogram tabs (dashboard, scouting, players), 'outline' = boxed (matches),
 * both collapse to a two-column grid on phones.
 */
export function TeamSwitcher({
  options,
  current,
  variant = "solid",
}: {
  options: TeamSwitcherOption[];
  current: TeamKey;
  variant?: "solid" | "outline";
}) {
  const pathname = usePathname();
  return (
    <div role="group" aria-label="Team" className="grid grid-cols-2 gap-2 md:flex">
      {options.map((o) => {
        const active = o.key === current;
        const cls =
          variant === "solid"
            ? active
              ? "bg-accent text-on-accent font-bold hover:text-on-accent hover:bg-accent-hover"
              : "bg-panel text-text-2 font-semibold hover:text-text hover:bg-panel-raised"
            : active
              ? "bg-line text-text font-bold border border-accent hover:text-text"
              : "bg-panel text-text-2 font-semibold border border-line-strong hover:text-text";
        return (
          <Link
            key={o.key}
            href={switchTeamHref(pathname, o.key)}
            aria-current={active ? "page" : undefined}
            className={
              "flex h-11 items-center justify-center whitespace-nowrap px-2 font-display text-[13px] md:px-[18px] uppercase tracking-[0.06em] no-underline transition-soft md:text-sm md:tracking-[0.08em] " +
              (variant === "solid" ? "md:clip-para " : "") +
              cls
            }
          >
            <span className="md:hidden">{o.short}</span>
            <span className="hidden md:inline">{o.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
