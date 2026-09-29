import Link from "next/link";

export function Logo({ href, compact = false }: { href: string; compact?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-[10px] text-text no-underline hover:text-text lg:gap-[14px]" aria-label="City Esports Rocket League Tracker, home">
      <span aria-hidden className={`clip-logo block bg-accent ${compact ? "h-[26px] w-[26px]" : "h-[34px] w-[34px]"}`} />
      <span className="flex flex-col gap-[2px]">
        <span className={`font-display font-bold tracking-[0.1em] ${compact ? "text-base" : "text-lg"}`}>CITY ESPORTS</span>
        {!compact && <span className="text-[11px] tracking-[0.18em] text-muted">ROCKET LEAGUE TRACKER</span>}
      </span>
    </Link>
  );
}
