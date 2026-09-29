"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { parsePath, SECTIONS } from "./nav";

/** Main navigation. 'bar' = desktop header, 'tabs' = phone tab row. */
export function NavLinks({ base, variant }: { base: string; variant: "bar" | "tabs" }) {
  const { section } = parsePath(usePathname());
  return (
    <nav
      aria-label="Main"
      className={variant === "bar" ? "flex h-[72px] gap-2" : "flex border-b border-line bg-header"}
    >
      {SECTIONS.map((s) => {
        const active = s.key === section;
        const href = s.key ? `${base}/${s.key}` : base;
        return (
          <Link
            key={s.key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={
              (variant === "bar"
                ? "flex items-center px-[18px] text-[15px] "
                : "flex h-12 grow items-center justify-center text-[13px] ") +
              "border-b-[3px] font-display font-semibold uppercase tracking-[0.08em] no-underline transition-soft " +
              (active ? "border-accent text-text hover:text-text" : "border-transparent text-muted hover:text-text-2")
            }
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
