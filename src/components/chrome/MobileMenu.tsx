"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { switchSeasonHref } from "./nav";
import type { SeasonOption } from "./SeasonSelect";

/** Phone menu: season picker and admin link (the four sections live in the tab row). */
export function MobileMenu({ seasons, current, isAdmin }: { seasons: SeasonOption[]; current: string; isAdmin: boolean }) {
  const pathname = usePathname();
  // Remember which page the menu was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (fn: (o: boolean) => boolean) => setOpenOn(fn(open) ? pathname : null);

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-11 cursor-pointer items-center justify-center border border-line-strong bg-transparent text-text"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          {open ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3 5h14M3 10h14M3 15h14" />}
        </svg>
      </button>
      {open && (
        <div id="mobile-menu" className="absolute inset-x-0 top-[60px] z-30 border-b border-line bg-header px-4 pb-4 shadow-xl">
          <p className="label mb-2 mt-3">Season</p>
          <ul className="flex flex-col">
            {seasons.map((s) => (
              <li key={s.slug}>
                <Link
                  href={switchSeasonHref(pathname, s.slug)}
                  aria-current={s.slug === current ? "page" : undefined}
                  className={
                    "flex min-h-11 items-center border-b border-divider text-[15px] no-underline " +
                    (s.slug === current ? "text-accent" : "text-text")
                  }
                >
                  {s.name}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/admin" className="mt-3 flex min-h-11 items-center text-sm text-text-3 no-underline">
            {isAdmin ? "Admin" : "Sign in"}
          </Link>
        </div>
      )}
    </>
  );
}
