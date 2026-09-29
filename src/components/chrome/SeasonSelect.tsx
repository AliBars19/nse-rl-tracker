"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { switchSeasonHref } from "./nav";

export interface SeasonOption {
  slug: string;
  name: string;
}

/** "NSE Spring 26 ▾": switches season and keeps the current team and section. */
export function SeasonSelect({ seasons, current }: { seasons: SeasonOption[]; current: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = seasons.find((s) => s.slug === current);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="h-11 cursor-pointer border border-line-strong bg-panel px-4 text-sm font-medium text-text transition-soft hover:border-muted"
      >
        {active?.name ?? current} <span aria-hidden>▾</span>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label="Season"
          className="absolute right-0 z-30 mt-1 min-w-full border border-line-strong bg-panel py-1 shadow-xl"
        >
          {seasons.map((s) => (
            <li key={s.slug} role="option" aria-selected={s.slug === current}>
              <Link
                href={switchSeasonHref(pathname, s.slug)}
                onClick={() => setOpen(false)}
                className={
                  "block whitespace-nowrap px-4 py-3 text-sm no-underline " +
                  (s.slug === current ? "bg-highlight text-accent" : "text-text hover:bg-inset hover:text-text")
                }
              >
                {s.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
