import Link from "next/link";
import { TeamSwitcher } from "@/components/chrome/TeamSwitcher";
import { Main, Placeholder, resBorderTop, resText } from "@/components/ui";
import type { MatchesView as View, NightTab } from "@/lib/view/matches";
import type { TeamPage } from "@/lib/view/team";

function Chevron() {
  return (
    <div className="hidden w-7 items-center justify-center text-disabled md:flex" aria-hidden>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 2l6 6-6 6" />
      </svg>
    </div>
  );
}

export function MatchesView({ p, v, tabs, current, isAdmin }: { p: TeamPage; v: View; tabs: NightTab[]; current: string; isAdmin: boolean }) {
  const base = `${p.base}/matches`;
  const sel = v.selected;
  const perRow = Math.min(v.cards.length, 3);

  return (
    <Main>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Night" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          <ul className="flex gap-[6px]">
            {tabs.map((t) => {
              const active = t.slug === current;
              return (
                <li key={t.slug}>
                  <Link
                    href={`${base}/${t.slug}`}
                    aria-current={active ? "page" : undefined}
                    className={
                      "clip-para flex h-11 items-center whitespace-nowrap px-5 font-display text-sm font-bold tracking-[0.1em] no-underline " +
                      (active ? "bg-accent text-on-accent hover:text-on-accent" : "bg-panel text-text-2 hover:text-text")
                    }
                  >
                    {t.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <TeamSwitcher options={p.teamOptions} current={p.key} variant="outline" />
      </div>

      <section className="flex flex-col gap-4" aria-labelledby="night-title">
        <div className="flex flex-col gap-1 md:flex-row md:items-baseline md:gap-4">
          <h1 id="night-title" className="m-0 font-display text-4xl font-bold uppercase leading-none md:text-5xl">{v.title}</h1>
          <span className="text-[15px] text-text-3 md:text-base">{v.dateLine}</span>
        </div>

        <div className="flex flex-col gap-3 md:grid md:items-stretch md:gap-x-0 md:gap-y-3" style={{ gridTemplateColumns: `repeat(${perRow}, minmax(0, 1fr)) 220px` }}>
          {v.cards.map((c, i) => (
            <div
              key={c.ts.series.id}
              className="flex items-stretch"
              style={{ gridColumnStart: (i % perRow) + 1, gridRowStart: Math.floor(i / perRow) + 1 }}
            >
              <Link
                href={`?series=${c.ts.series.id}`}
                scroll={false}
                aria-current={c.focused ? "true" : undefined}
                className={
                  `flex grow flex-col gap-2 border border-t-[3px] px-5 py-[18px] text-text no-underline transition-soft hover:text-text ${resBorderTop(c.res)} ` +
                  (c.focused ? "border-x-line-raised border-b-line-raised bg-panel-raised md:-translate-y-1 md:shadow-[0_8px_24px_rgba(0,0,0,0.35)]" : "border-x-line border-b-line bg-panel hover:bg-panel-raised")
                }
              >
                <span className="text-xs tracking-[0.14em] text-muted">{c.title}</span>
                <span className="text-[17px] font-semibold">{c.opp}</span>
                <span className="flex items-baseline gap-[10px]">
                  <span className={`font-display text-4xl font-bold leading-none ${resText(c.res)}`}>{c.score}</span>
                  {c.res !== "BYE" && (
                    <span className={`font-display text-[15px] font-bold ${resText(c.res)}`}>
                      {c.res === "W" ? "WIN" : "LOSS"}
                      {c.ts.series.isForfeit ? " · FF" : ""}
                    </span>
                  )}
                </span>
                {c.after && <span className="text-[13px] text-text-3">{c.after}</span>}
              </Link>
              {i < v.cards.length - 1 ? <Chevron /> : <div className="hidden w-7 md:block" aria-hidden />}
            </div>
          ))}
          <div
            className="clip-cut flex flex-col justify-center gap-[6px] bg-accent px-[22px] py-[18px] text-on-accent"
            style={{ gridColumnStart: perRow + 1, gridRowStart: 1 }}
          >
            <span className="text-xs font-semibold tracking-[0.14em]">{v.result.label}</span>
            <span className="font-display text-[52px] font-bold leading-none">{v.result.big}</span>
            <span className="text-[13px] font-semibold">{v.result.caption}</span>
          </div>
        </div>
      </section>

      {sel && (
        <section className="flex flex-col border border-line bg-panel" aria-labelledby="series-title">
          <div className="flex flex-col gap-4 border-b border-line px-4 py-5 md:flex-row md:items-center md:justify-between md:px-7 md:py-[22px]">
            <div className="flex flex-col gap-[6px]">
              <span className="text-xs tracking-[0.14em] text-muted">{sel.heading}</span>
              <h2 id="series-title" className="m-0 font-display text-2xl font-bold uppercase md:text-[30px]">
                {p.team.name}{" "}
                {sel.ts.opponent ? (
                  <>
                    <span className={sel.ts.result === "W" ? "text-win" : "text-loss"}>{sel.ts.our}</span>{" "}
                    <span className="text-disabled">–</span>{" "}
                    <span className={sel.ts.result === "W" ? "text-loss" : "text-win"}>{sel.ts.opp}</span> {sel.ts.opponent.shortName}
                  </>
                ) : (
                  <span className="text-muted">· bye</span>
                )}
              </h2>
            </div>
            <div className="flex flex-wrap gap-[10px]">
              {sel.oppSlug && (
                <Link href={`${p.base}/scouting/${sel.oppSlug}`} className="flex h-11 items-center border border-line-strong px-[18px] text-sm font-medium text-text no-underline hover:border-muted hover:text-text">
                  Head to head
                </Link>
              )}
              {isAdmin && sel.ts.opponent && !sel.ts.series.isForfeit && (
                <Link href={`/admin/replays?series=${sel.ts.series.id}`} className="flex h-11 items-center bg-accent px-5 font-display text-sm font-bold tracking-[0.1em] text-on-accent no-underline hover:bg-accent-hover hover:text-on-accent">
                  UPLOAD REPLAYS
                </Link>
              )}
            </div>
          </div>

          {sel.games.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 border-b border-line px-4 py-5 sm:grid-cols-3 md:px-7 md:py-[22px] lg:grid-cols-5">
              {sel.games.map((g) => (
                <div
                  key={g.n}
                  className={`flex flex-col gap-2 bg-inset p-4 ${g.processed ? "border border-line" : "border border-dashed border-line-strong"}`}
                >
                  <span className="text-xs tracking-[0.14em] text-muted">GAME {g.n}</span>
                  {g.processed ? (
                    <span className="font-mono text-[26px] font-semibold">
                      <span className={(g.our ?? 0) > (g.opp ?? 0) ? "text-win" : "text-loss"}>{g.our}</span>
                      <span className="text-disabled"> : </span>
                      <span>{g.opp}</span>
                    </span>
                  ) : (
                    <span className="font-mono text-[26px] font-semibold text-disabled">– : –</span>
                  )}
                  <span className="text-xs text-text-3">{g.processed ? (g.overtime ? "Overtime" : "From replay") : "Awaiting replay"}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="border-b border-line px-4 py-5 md:px-7">
              <Placeholder>
                {sel.ts.series.isForfeit
                  ? "Forfeit: no games were played, so this series is left out of game stats."
                  : "Bye: no match was played."}
              </Placeholder>
            </div>
          )}

          {sel.boards.length > 0 && (
            <div className="grid gap-7 px-4 pb-7 pt-5 md:grid-cols-2 md:px-7 md:pt-[22px]">
              {sel.boards.map((b) => (
                <div key={b.team} className="flex flex-col">
                  <div className="flex items-center gap-[10px] pb-3">
                    <span aria-hidden className={`h-3 w-3 ${b.res === "W" ? "bg-win" : "bg-loss"}`} />
                    <h3 className="m-0 font-display text-lg font-bold uppercase tracking-[0.06em]">{b.team}</h3>
                  </div>
                  <div role="table" aria-label={`${b.team} scoreboard`}>
                    <div role="row" className="grid grid-cols-[minmax(0,1fr)_repeat(5,48px)] border-b border-line py-[10px] text-xs tracking-[0.12em] text-muted md:grid-cols-[minmax(0,1fr)_repeat(5,56px)]">
                      <span role="columnheader">PLAYER</span>
                      <span role="columnheader" className="text-right">SCORE</span>
                      <span role="columnheader" className="text-right"><abbr title="Goals" className="no-underline">G</abbr></span>
                      <span role="columnheader" className="text-right"><abbr title="Assists" className="no-underline">A</abbr></span>
                      <span role="columnheader" className="text-right"><abbr title="Saves" className="no-underline">SV</abbr></span>
                      <span role="columnheader" className="text-right"><abbr title="Shots" className="no-underline">SH</abbr></span>
                    </div>
                    {(b.rows.length ? b.rows : [null, null, null]).map((r, i) => (
                      <div
                        role="row"
                        key={r?.name ?? i}
                        className={`grid h-11 grid-cols-[minmax(0,1fr)_repeat(5,48px)] items-center border-b border-divider font-mono md:grid-cols-[minmax(0,1fr)_repeat(5,56px)] ${r ? "text-text-2" : "text-disabled"}`}
                      >
                        <span role="cell" className={`truncate font-sans ${r ? "text-text" : "text-muted"}`}>{r?.name ?? "Player from replay"}</span>
                        {(r ? [r.score, r.goals, r.assists, r.saves, r.shots] : ["—", "—", "—", "—", "—"]).map((x, j) => (
                          <span role="cell" key={j} className="text-right">{x}</span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </Main>
  );
}
