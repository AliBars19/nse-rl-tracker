"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export interface OpponentItem {
  slug: string;
  name: string;
  meta: string;
  w: number;
  l: number;
}

/** Scouting sidebar: searchable opponent list, sorted by meetings. */
export function OpponentList({ items, selected, base }: { items: OpponentItem[]; selected: string | null; base: string }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? items.filter((i) => i.name.toLowerCase().includes(needle)) : items;
  }, [items, q]);

  return (
    <aside className="flex flex-col border border-line bg-panel" aria-labelledby="opponents">
      <div className="flex flex-col gap-3 border-b border-line px-5 pb-4 pt-5">
        <h2 id="opponents" className="h-section text-lg lg:text-[22px]">Opponents</h2>
        <label htmlFor="opp-search" className="text-xs tracking-[0.14em] text-muted">SEARCH</label>
        <input
          id="opp-search"
          type="search"
          placeholder="Team name"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-11 border border-line-strong bg-inset px-3 text-[15px] text-text placeholder:text-disabled"
        />
        <span className="text-xs text-muted" aria-live="polite">
          {shown.length === items.length ? `${items.length} opponents · sorted by meetings` : `${shown.length} of ${items.length} opponents`}
        </span>
      </div>
      <ul className="max-h-[420px] overflow-y-auto lg:max-h-none">
        {shown.map((o) => {
          const sel = o.slug === selected;
          const colour = o.w > o.l ? "text-win" : o.w < o.l ? "text-loss" : "text-text-2";
          return (
            <li key={o.slug}>
              <Link
                href={`${base}/${o.slug}`}
                aria-current={sel ? "page" : undefined}
                scroll={false}
                className={
                  "flex min-h-[60px] items-center justify-between gap-3 border-b border-l-4 border-b-divider px-5 text-text no-underline transition-soft hover:bg-inset hover:text-text " +
                  (sel ? "border-l-accent bg-highlight" : "border-l-transparent")
                }
              >
                <span className="flex flex-col gap-[2px]">
                  <span className="text-[15px] font-semibold">{o.name}</span>
                  <span className="text-xs text-muted">{o.meta}</span>
                </span>
                <span className={`font-mono text-base font-semibold ${colour}`} aria-label={`${o.w} wins, ${o.l} losses`}>
                  {o.w}–{o.l}
                </span>
              </Link>
            </li>
          );
        })}
        {!shown.length && <li className="px-5 py-4 text-sm text-muted">No opponent matches “{q}”.</li>}
      </ul>
    </aside>
  );
}
