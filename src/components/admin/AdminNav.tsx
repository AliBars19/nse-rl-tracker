"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/nights", label: "Nights" },
  { href: "/admin/replays", label: "Replays" },
  { href: "/admin/imports", label: "Imports" },
  { href: "/admin/roster", label: "Roster" },
  { href: "/admin/upcoming", label: "Upcoming" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="-mx-4 overflow-x-auto border-b border-line bg-header px-4 lg:mx-0 lg:px-12">
      <ul className="flex gap-1">
        {LINKS.map((l) => {
          const active = l.href === "/admin" ? path === "/admin" : path.startsWith(l.href);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={
                  "flex h-12 items-center whitespace-nowrap border-b-[3px] px-4 font-display text-sm font-semibold uppercase tracking-[0.08em] no-underline " +
                  (active ? "border-accent text-text hover:text-text" : "border-transparent text-muted hover:text-text-2")
                }
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
