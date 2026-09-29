import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/chrome/Logo";
import { buildLanding, type LandingSeason } from "@/lib/view/landing";

// Seasons are added from the admin area, so always read them fresh.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "City Esports · Rocket League Tracker" },
};

const STATUS: Record<LandingSeason["status"], string> = {
  "in-progress": "IN PROGRESS",
  finished: "FINISHED",
};

export default async function Home() {
  const seasons = await buildLanding();

  return (
    <div className="flex min-h-dvh flex-col bg-app">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-accent focus:px-4 focus:py-2 focus:text-on-accent">
        Skip to content
      </a>
      <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-line bg-header px-4 lg:h-[72px] lg:px-12">
        <Logo href="/" />
        <Link href="/admin" className="text-sm text-text-3 hover:text-text">Admin</Link>
      </header>

      <main id="main" className="mx-auto flex w-full max-w-[1440px] grow flex-col gap-8 px-4 pb-12 pt-8 lg:gap-10 lg:px-12 lg:pt-14">
        <section className="flex flex-col gap-3">
          <span className="clip-para-sm self-start bg-accent px-[14px] py-[6px] font-display text-[13px] font-bold tracking-[0.14em] text-on-accent">
            CITY, UNIVERSITY OF LONDON
          </span>
          <h1 className="m-0 font-display text-[44px] font-bold uppercase leading-[0.95] lg:text-[84px] lg:leading-[0.92]">
            Pick a season
          </h1>
          <p className="m-0 max-w-2xl text-[15px] leading-normal text-text-3 lg:text-[17px]">
            City Champions and City Commanders in the NSE Rocket League weekly tournament: standings,
            scouting, match nights and player stats. Switch seasons any time from the top right.
          </p>
        </section>

        {seasons.length === 0 ? (
          <p className="m-0 border border-dashed border-line-strong bg-inset px-4 py-[14px] text-text-3">
            No seasons yet. Sign in at <Link href="/admin">/admin</Link> to create one.
          </p>
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2 lg:gap-6" aria-label="Seasons">
            {seasons.map((s) => {
              const current = s.isCurrent;
              return (
                <li key={s.slug} className={`flex flex-col border bg-panel ${current ? "border-highlight-line" : "border-line"}`}>
                  <div className={`flex items-center justify-between gap-3 border-b px-4 py-4 lg:px-6 lg:py-5 ${current ? "border-highlight-line bg-highlight" : "border-line"}`}>
                    <h2 className="m-0 font-display text-2xl font-bold uppercase tracking-[0.04em] lg:text-[30px]">{s.name}</h2>
                    <span className={`shrink-0 px-3 py-1 font-display text-xs font-bold tracking-[0.14em] ${current ? "bg-accent text-on-accent" : "bg-line text-text-2"}`}>
                      {STATUS[s.status]}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    {s.teams.map((t) => (
                      <Link
                        key={t.key}
                        href={t.href}
                        className="group flex min-h-[72px] items-center justify-between gap-4 border-b border-divider px-4 text-text no-underline transition-soft last:border-b-0 hover:bg-inset hover:text-text lg:px-6"
                      >
                        <span className="flex flex-col gap-[2px]">
                          <span className="text-[17px] font-semibold">{t.name}</span>
                          <span className="text-[13px] text-text-3">{t.tier} · {t.standing}</span>
                        </span>
                        <span aria-hidden className="font-display text-xl font-bold text-accent transition-transform group-hover:translate-x-1">→</span>
                      </Link>
                    ))}
                    {s.teams.length === 0 && <span className="px-4 py-5 text-sm text-muted lg:px-6">No City teams set up for this season.</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
