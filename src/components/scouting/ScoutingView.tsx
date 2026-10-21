import Link from "next/link";
import { TeamSwitcher } from "@/components/chrome/TeamSwitcher";
import { Main, Placeholder, resBorderTop, resText, Tag } from "@/components/ui";
import { getNotes } from "@/lib/data/notes";
import { buildScouting } from "@/lib/view/scouting";
import type { TeamPage } from "@/lib/view/team";
import { CaptainsNotes } from "./CaptainsNotes";
import { OpponentList } from "./OpponentList";

export async function ScoutingView({ p, oppSlug }: { p: TeamPage; oppSlug: string | null }) {
  const v = buildScouting(p, oppSlug);
  const base = `${p.base}/scouting`;
  const s = v.selected;
  const notes = s ? await getNotes(p.team.id, s.team.id) : null;

  const items = v.opponents.map((o) => ({ slug: o.team.slug, name: o.team.shortName, meta: o.meta, w: o.w, l: o.l }));
  const ourShort = "CITY";
  const oppShort = s?.team.shortName.toUpperCase() ?? "";

  return (
    <Main className="lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start lg:gap-7">
      <div className="order-2 lg:order-1">
        <OpponentList items={items} selected={s?.team.slug ?? null} base={base} />
      </div>

      <div className="order-1 flex flex-col gap-5 lg:order-2 lg:gap-7">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <TeamSwitcher options={p.teamOptions} current={p.key} />
          <span className="text-sm text-text-3">Scouting opponents faced this season</span>
        </div>

        {!s ? (
          <Placeholder>No opponents yet this season.</Placeholder>
        ) : (
          <>
            <section className="flex flex-col gap-6 border border-line bg-panel px-4 py-5 md:flex-row md:items-center md:justify-between md:gap-8 md:px-8 md:py-7" aria-labelledby="h2h">
              <div className="flex flex-col gap-3">
                <Tag tone="accent" className="self-start">HEAD TO HEAD</Tag>
                <h1 id="h2h" className="m-0 font-display text-[40px] font-bold uppercase leading-[0.95] md:text-[60px]">{s.team.shortName}</h1>
                <p className="m-0 text-[15px] text-text-3 md:text-base">{s.their.line}</p>
              </div>
              <div className="flex items-center gap-5 self-center" aria-label={`Series ${s.h2h.series.w} to ${s.h2h.series.l}, games ${s.h2h.games.w} to ${s.h2h.games.l}`}>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs tracking-[0.14em] text-muted">{ourShort}</span>
                  <span className="font-display text-[56px] font-bold leading-none text-win md:text-[72px]">{s.h2h.series.w}</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs tracking-[0.14em] text-muted">SERIES</span>
                  <span className="font-display text-[32px] text-disabled">–</span>
                  <span className="whitespace-nowrap font-mono text-[13px] text-text-3">Games {s.h2h.games.w}–{s.h2h.games.l}</span>
                </div>
                <div className="flex max-w-[140px] flex-col items-center gap-1">
                  <span className="truncate text-xs tracking-[0.14em] text-muted" title={oppShort}>{oppShort}</span>
                  <span className="font-display text-[56px] font-bold leading-none text-loss md:text-[72px]">{s.h2h.series.l}</span>
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-[14px]" aria-labelledby="past-games">
              <h2 id="past-games" className="h-section text-lg md:text-[22px]">Past games against {s.team.shortName}</h2>
              <div className="grid gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
                {s.meetings.map((m) => (
                  <Link
                    key={m.ts.series.id}
                    href={`${p.base}/matches/${m.nightSlug}?series=${m.ts.series.id}`}
                    className={`flex flex-col gap-[10px] border border-line border-t-[3px] bg-panel px-[22px] py-5 text-text no-underline transition-soft hover:bg-panel-raised hover:text-text ${resBorderTop(m.win ? "W" : "L")}`}
                  >
                    <span className="text-xs tracking-[0.14em] text-muted">{m.when}</span>
                    <span className="text-sm text-text-2">{m.round}</span>
                    <span className="flex items-baseline gap-3">
                      <span className={`font-display text-[44px] font-bold leading-none ${resText(m.win ? "W" : "L")}`}>{m.score}</span>
                      <span className={`font-display text-lg font-bold ${resText(m.win ? "W" : "L")}`}>{m.win ? "WIN" : "LOSS"}</span>
                    </span>
                    <span className="text-[13px] text-text-3">{m.effect}</span>
                  </Link>
                ))}
              </div>
            </section>

            <section className="grid gap-5 md:grid-cols-2 md:gap-6">
              <div className="flex flex-col gap-4 border border-line bg-panel px-4 py-5 md:px-6" aria-labelledby="their-season">
                <h2 id="their-season" className="h-section text-lg md:text-[22px]">Their season</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" style={{ gridTemplateColumns: undefined }}>
                  {s.their.weeks.map((w) => (
                    <div key={w.label} className="flex flex-col gap-[6px] border border-line bg-inset p-[14px]">
                      <span className="text-xs tracking-[0.12em] text-muted">{w.label}</span>
                      <span className={`font-display text-[32px] font-bold leading-none ${w.points === "—" ? "text-disabled" : ""}`}>{w.points}</span>
                      <span className="text-xs text-text-3">{w.note}</span>
                    </div>
                  ))}
                </div>
                {s.their.summary && <p className="m-0 text-sm leading-normal text-text-3">{s.their.summary}</p>}
              </div>

              <div className="flex flex-col gap-[14px] border border-line bg-panel px-4 py-5 md:px-6" aria-labelledby="patterns">
                <h2 id="patterns" className="h-section text-lg md:text-[22px]">Patterns</h2>
                <ul className="flex flex-col gap-[14px]">
                  {s.patterns.map((t) => (
                    <li key={t} className="flex items-start gap-3">
                      <span aria-hidden className="mt-[7px] h-2 w-2 shrink-0 bg-accent" />
                      <span className="text-[15px] leading-normal text-pattern">{t}</span>
                    </li>
                  ))}
                </ul>
                {s.insights ? (
                  <div className="mt-[6px] flex flex-col gap-3 border-t border-line pt-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="m-0 font-display text-base font-bold uppercase tracking-[0.06em]">Their players vs City</h3>
                      <span className="text-xs text-muted">{s.coverage.processed} / {s.coverage.total} games with replays</span>
                    </div>
                    <p className="m-0 text-sm leading-normal text-text-3">
                      City won <strong className="text-win">{s.insights.cityGames.won}</strong> and lost <strong className="text-loss">{s.insights.cityGames.lost}</strong> of the games with replays.
                      {s.insights.topScorer && (
                        <>
                          {" "}Their top scorer is <strong className="text-text">{s.insights.topScorer.name}</strong> with {s.insights.topScorer.goals} {s.insights.topScorer.goals === 1 ? "goal" : "goals"} in {s.insights.topScorer.gp} {s.insights.topScorer.gp === 1 ? "game" : "games"}.
                        </>
                      )}{" "}
                      As a team they average {s.insights.team.goals.toFixed(1)} goals, {s.insights.team.shots.toFixed(1)} shots and {s.insights.team.saves.toFixed(1)} saves a game against us.
                    </p>
                    <div role="table" aria-label={`${s.team.shortName} players against City, per game`}>
                      <div role="row" className="grid grid-cols-[minmax(0,1fr)_repeat(6,38px)] border-b border-line py-2 text-xs tracking-[0.12em] text-muted">
                        <span role="columnheader">PLAYER</span>
                        {["GP", "G", "A", "SV", "SH", "SCORE"].map((h) => (
                          <span role="columnheader" key={h} className="text-right">{h}</span>
                        ))}
                      </div>
                      {s.insights.players.map((r) => (
                        <div role="row" key={r.name} className="grid h-11 grid-cols-[minmax(0,1fr)_repeat(6,38px)] items-center border-b border-divider font-mono text-text-2">
                          <span role="cell" className="truncate font-sans text-text">{r.name}</span>
                          {[r.gp.toString(), r.goals.toFixed(1), r.assists.toFixed(1), r.saves.toFixed(1), r.shots.toFixed(1), r.score.toFixed(0)].map((x, j) => (
                            <span role="cell" key={j} className="text-right">{x}</span>
                          ))}
                        </div>
                      ))}
                    </div>
                    <span className="text-xs text-muted">Per game, against City. Names are the in-game names from the replays.</span>
                  </div>
                ) : (
                  <Placeholder className="mt-[6px]" right={`${s.coverage.processed} / ${s.coverage.total} games`}>
                    Top scorer, shots and saves vs City appear once replays are uploaded.
                  </Placeholder>
                )}
              </div>
            </section>

            {notes && (
              <CaptainsNotes notes={notes} teamId={p.team.id} opponentId={s.team.id} path={`${base}/${s.team.slug}`} />
            )}
          </>
        )}
      </div>
    </Main>
  );
}
