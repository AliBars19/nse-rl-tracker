import Link from "next/link";
import { Avatar, Panel, PanelHeader, resBg, resBorderLeft, resBorderTop, resText, StatTile, Tag } from "@/components/ui";
import type { ScenarioPreview } from "@/lib/engine/preview";
import type { Effect } from "@/lib/engine/points";
import { cellText } from "@/lib/engine/standings";
import { shortPlayoffNote } from "@/lib/import/sheet";
import type { DashboardView } from "@/lib/view/dashboard";

// ------------------------------------------------------------------ hero

export function Hero({ v, switcher }: { v: DashboardView; switcher: React.ReactNode }) {
  const { hero } = v;
  return (
    <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
      <div className="flex flex-col gap-5 lg:gap-4">
        {switcher}
        <div className="flex flex-col gap-2 lg:gap-4">
          <h1 className="m-0 font-display text-[44px] font-bold uppercase leading-[0.95] lg:text-[84px] lg:leading-[0.92] lg:tracking-[-0.01em]">
            {hero.name}
          </h1>
          <p className="m-0 text-[15px] leading-[1.45] text-text-3 lg:hidden">{hero.phoneSummary}</p>
          <p className="m-0 hidden text-[17px] text-text-3 lg:block">{hero.summary}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:flex lg:gap-3">
        <div className="flex flex-col gap-1 border border-line bg-panel p-4 lg:w-[180px] lg:gap-[6px] lg:px-6 lg:py-5">
          <span className="text-[11px] tracking-[0.16em] text-muted lg:text-xs">FINAL RANK</span>
          <span className="font-display text-5xl font-bold leading-none lg:text-[64px]">
            {hero.rank ?? "—"}
            {hero.field && <span className="text-lg text-muted lg:text-2xl">/{hero.field}</span>}
          </span>
        </div>
        <div className="clip-cut-sm flex flex-col gap-1 bg-accent p-4 text-on-accent lg:clip-cut lg:w-[200px] lg:gap-[6px] lg:px-6 lg:py-5">
          <span className="text-[11px] font-semibold tracking-[0.16em] lg:text-xs">
            <span className="lg:hidden">POINTS</span>
            <span className="hidden lg:inline">SEASON POINTS</span>
          </span>
          <span className="font-display text-5xl font-bold leading-none lg:text-[64px]">
            {hero.points}
            <span className="hidden text-xl font-semibold lg:inline"> pts</span>
          </span>
        </div>
      </div>
    </section>
  );
}

export function Tiles({ v }: { v: DashboardView }) {
  return (
    <section aria-label="Season stats" className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-4">
      {v.tiles.map((t) => (
        <StatTile
          key={t.label}
          label={<><span className="lg:hidden">{t.phoneLabel}</span><span className="hidden lg:inline">{t.label}</span></>}
          value={t.value}
          note={<><span className="lg:hidden">{t.phoneNote}</span><span className="hidden lg:inline">{t.note}</span></>}
        />
      ))}
    </section>
  );
}

// ------------------------------------------------------------------ league nights

function Legend() {
  return (
    <div className="flex gap-4 text-[13px] text-text-3">
      <span className="flex items-center gap-[6px]"><span className="h-[10px] w-[10px] bg-win" aria-hidden />W win</span>
      <span className="flex items-center gap-[6px]"><span className="h-[10px] w-[10px] bg-loss" aria-hidden />L loss</span>
    </div>
  );
}

export function LeagueNights({ v, isAdmin }: { v: DashboardView; isAdmin: boolean }) {
  return (
    <Panel aria-labelledby="league-nights" className="hidden lg:block">
      <PanelHeader id="league-nights" title="League nights" right={<Legend />} />
      <div className="flex flex-col">
        {v.weeks.map((wk) => (
          <div key={wk.key} className="grid grid-cols-[110px_minmax(0,1fr)_150px] items-center gap-5 border-b border-divider px-6 py-5 last:border-b-0">
            <div className="flex flex-col gap-1">
              <Link href={wk.href} className="font-display text-xl font-bold tracking-[0.04em] text-text no-underline hover:text-accent">
                {wk.name}
              </Link>
              <span className="text-[13px] text-muted">{wk.date}</span>
            </div>
            <div className="grid grid-cols-3 gap-[10px]">
              {wk.rounds.map((r) => (
                <div key={r.key} className={`flex flex-col gap-[6px] border border-line border-t-[3px] bg-inset px-[14px] py-3 ${resBorderTop(r.res)}`}>
                  <span className="truncate text-[11px] uppercase tracking-[0.12em] text-muted">{r.label}</span>
                  <span className="truncate text-[15px] font-semibold" title={r.opp}>{r.opp}</span>
                  <span className={`font-mono text-lg font-semibold ${resText(r.res)}`}>
                    {r.res === "BYE" ? "BYE" : `${r.res} ${r.score}`}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="font-display text-[40px] font-bold leading-none text-accent">
                {wk.points === null ? "—" : `+${wk.points}`}
              </span>
              <span className="text-right text-xs text-text-3">{wk.path}</span>
              {isAdmin && wk.mismatch && <span className="text-right text-[11px] text-loss">{wk.mismatch}</span>}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function LeagueNightsPhone({ v }: { v: DashboardView }) {
  return (
    <section aria-labelledby="league-nights-phone" className="flex flex-col gap-3 lg:hidden">
      <h2 id="league-nights-phone" className="h-section text-lg">League nights</h2>
      {v.weeks.map((wk) => (
        <Panel as="div" key={wk.key}>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="flex flex-col gap-[2px]">
              <Link href={wk.href} className="font-display text-[17px] font-bold text-text no-underline">
                {wk.name.charAt(0) + wk.name.slice(1).toLowerCase()}
              </Link>
              <span className="text-xs text-muted">{wk.date} · {wk.path}</span>
            </div>
            <span className="font-display text-3xl font-bold text-accent">{wk.points === null ? "—" : `+${wk.points}`}</span>
          </div>
          {wk.rounds.map((r) => (
            <div key={r.key} className={`flex min-h-14 items-center justify-between gap-3 border-b border-l-[3px] border-b-divider px-4 last:border-b-0 ${resBorderLeft(r.res)}`}>
              <span className="flex min-w-0 flex-col gap-[2px]">
                <span className="text-[11px] uppercase tracking-[0.12em] text-muted">{r.label}</span>
                <span className="truncate text-[15px] font-semibold">{r.opp}</span>
              </span>
              <span className={`shrink-0 font-mono text-[17px] font-semibold ${resText(r.res)}`}>
                {r.res === "BYE" ? "BYE" : `${r.res} ${r.score}`}
              </span>
            </div>
          ))}
        </Panel>
      ))}
    </section>
  );
}

export function PointsChart({ v }: { v: DashboardView }) {
  const n = v.weeks.length || 1;
  return (
    <Panel aria-labelledby="points-chart" className="hidden flex-col gap-5 px-6 py-5 lg:flex">
      <div className="flex items-baseline justify-between">
        <h2 id="points-chart" className="h-section">Points per night</h2>
        <span className="text-[13px] text-muted">{v.chart.caption}</span>
      </div>
      <div
        role="img"
        aria-label={`Points per night: ${v.weeks.map((w) => `${w.short} ${w.points ?? "no data"}`).join(", ")}`}
        className="grid h-[200px] items-end gap-6 border-b border-line-strong bg-[linear-gradient(var(--border)_1px,transparent_1px)] bg-[length:100%_40px]"
        style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
      >
        {v.weeks.map((w) => (
          <div key={w.key} className="flex flex-col items-center gap-2">
            <span className="font-mono text-base font-semibold">{w.points ?? "—"}</span>
            <div className="clip-bar w-[64%] bg-accent" style={{ height: `${((w.points ?? 0) / v.chart.max) * 160}px` }} />
          </div>
        ))}
      </div>
      <div className="-mt-[10px] grid gap-6" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }} aria-hidden>
        {v.weeks.map((w) => (
          <span key={w.key} className="text-center text-[13px] tracking-[0.08em] text-text-3">{w.short}</span>
        ))}
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------------ right column

export function FormPanel({ v }: { v: DashboardView }) {
  return (
    <Panel aria-labelledby="form" className="flex flex-col gap-3 p-4 lg:gap-[14px] lg:px-6 lg:py-5">
      <h2 id="form" className="h-section text-lg lg:text-[22px]">Form</h2>
      {v.form.length ? (
        <ol className="grid grid-cols-5 gap-[6px] lg:gap-2">
          {v.form.map((f) => (
            <li key={f.key} className="flex flex-col items-center gap-1 lg:gap-[6px]">
              <span
                aria-label={`${f.res === "W" ? "Win" : "Loss"} ${f.score} against ${f.opp}`}
                className={`flex h-11 w-full items-center justify-center font-display text-xl font-bold text-on-accent lg:h-12 lg:text-[22px] ${resBg(f.res)}`}
              >
                {f.res}
              </span>
              <span className="hidden text-xs font-semibold text-text-2 lg:block" aria-hidden>{f.tag}</span>
              <span className="font-mono text-[11px] text-text-3 lg:text-xs lg:text-muted" aria-hidden>{f.score}</span>
            </li>
          ))}
        </ol>
      ) : (
        <span className="text-sm text-muted">No series yet.</span>
      )}
      <span className="hidden text-xs text-muted lg:block">Newest first, playoffs included</span>
    </Panel>
  );
}

export function LadderPanel({ v }: { v: DashboardView }) {
  return (
    <Panel aria-labelledby="ladder" className="hidden flex-col gap-[14px] px-6 py-5 lg:flex">
      <div className="flex flex-col gap-1">
        <h2 id="ladder" className="h-section">How nights score</h2>
        <span className="text-[13px] text-text-3">
          {v.ladder ? `${v.ladder.tierName} · your record after Round 2 decides your Round 3 match` : `${v.tierName} · points ladder not confirmed yet`}
        </span>
      </div>
      {v.ladder ? (
        <div className="flex flex-col gap-[6px]">
          {v.ladder.rows.map((l) => (
            <div
              key={l.path}
              className={`grid grid-cols-[minmax(0,1fr)_56px_64px] items-center gap-[10px] border px-3 py-[10px] ${l.hits ? "border-highlight-line bg-highlight" : "border-line bg-inset"}`}
            >
              <span className="text-sm text-text">
                {l.path}
                {l.extra && <span className="text-muted"> {l.extra}</span>}
              </span>
              <span className="text-right font-mono text-base font-semibold">{l.pts}</span>
              <span className="text-right text-xs font-semibold text-accent">{l.hits}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="m-0 border border-dashed border-line-strong bg-inset px-4 py-[14px] text-[13px] leading-relaxed text-text-3">
          {v.ladderNote}
        </p>
      )}
    </Panel>
  );
}

export function RosterPanel({ v, playersHref }: { v: DashboardView; playersHref: string }) {
  return (
    <Panel aria-labelledby="roster" className="hidden flex-col gap-3 px-6 py-5 lg:flex">
      <div className="flex items-baseline justify-between">
        <h2 id="roster" className="h-section">Roster</h2>
        <span className="text-xs text-muted">Stats unlock with replays</span>
      </div>
      <ul className="flex flex-col">
        {v.roster.map((p) => (
          <li key={p.slug} className="flex items-center justify-between border-b border-divider py-[10px] last:border-b-0">
            <Link href={`${playersHref}/${p.slug}`} className="flex items-center gap-3 text-text no-underline hover:text-accent">
              <Avatar name={p.name} />
              <span className="flex flex-col">
                <span className="text-[15px] font-semibold">{p.name}</span>
                <span className="text-xs text-muted">{p.role}</span>
              </span>
            </Link>
            <span className={`font-mono text-[13px] ${p.line ? "text-text-2" : "text-muted"}`}>{p.line ?? "— G · — A · — Sv"}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// ------------------------------------------------------------------ scenarios

const effectColour = (e: Effect) => (e === "promoted" ? "text-accent" : e === "relegated" ? "text-loss" : "text-text-3");
const effectBorder = (e: Effect) => (e === "promoted" ? "border-l-accent" : e === "relegated" ? "border-l-loss" : "border-l-text-3");

function Headline({ s }: { s: ScenarioPreview }) {
  const h = s.scenarios.headline;
  return (
    <>
      Win all three rounds{h.r1Opponent ? <>, starting with <strong>{h.r1Opponent}</strong>,</> : ""}{" "}
      {h.promotedTo ? (
        <>and you are <strong className="text-accent">promoted to {h.promotedTo}</strong>.</>
      ) : (
        <>for the maximum <strong className="text-accent">{h.maxPoints} points</strong>.</>
      )}
    </>
  );
}

function gapColour(gap: number) {
  return gap > 0 ? "text-loss" : gap < 0 ? "text-win" : "text-text-2";
}

export function Scenarios({ s }: { s: ScenarioPreview }) {
  const going = `Going in: ${s.scenarios.goingIn.text}`;
  return (
    <Panel aria-labelledby="scenarios" className="hidden lg:block">
      <div className="flex items-center justify-between border-b border-line px-6 py-5">
        <div className="flex items-center gap-[14px]">
          <h2 id="scenarios" className="h-section">Scenarios</h2>
          <Tag>{s.weekLabel} PREVIEW</Tag>
          {s.archived && <span className="text-xs text-muted">Season over: this is how {s.weekLabel.toLowerCase().replace("week", "Week")} looked going in</span>}
        </div>
        <span className="text-sm text-text-3">
          {going}
          {s.r1Opponent ? ` · Round 1 vs ${s.r1Opponent}` : " · Round 1 opponent TBC"}
        </span>
      </div>
      <div className="grid grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] gap-6 p-6">
        <div className="flex flex-col gap-[14px]">
          <div className="flex items-center gap-[14px] border border-highlight-line bg-highlight px-[18px] py-[14px]">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="var(--accent)" strokeWidth="2" aria-hidden className="shrink-0">
              <path d="M10 16V4M4 10l6-6 6 6" />
            </svg>
            <span className="text-[15px] leading-[1.45]"><Headline s={s} /></span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {s.scenarios.groups.map((g) => (
              <div key={g.bracket} className="flex flex-col border border-line bg-inset">
                <div className="flex flex-col gap-[2px] border-b border-line px-4 py-3">
                  <span className="font-display text-lg font-bold">{g.title}</span>
                  <span className="text-xs text-muted">{g.how}</span>
                </div>
                {g.outcomes.map((o) => (
                  <div
                    key={o.key}
                    className={`flex flex-col gap-1 border-b border-l-[3px] border-b-divider px-4 py-3 last:border-b-0 ${effectBorder(o.effect)} ${o.effect === "promoted" ? "bg-highlight" : ""}`}
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="text-[13px] text-text-2">{o.label}</span>
                      <span className="font-mono text-[15px] font-semibold text-accent">+{o.points}</span>
                    </div>
                    <span className="font-display text-2xl font-bold leading-[1.1]">{o.total} pts</span>
                    <span className={`text-[13px] font-semibold ${effectColour(o.effect)}`}>{o.effectText}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-[10px]">
          <span className="text-xs tracking-[0.14em] text-muted">RIVALS WITHIN REACH</span>
          {s.scenarios.rivals.length ? (
            s.scenarios.rivals.map((r) => (
              <div key={r.teamId} className="flex flex-col gap-1 border border-line bg-inset px-[14px] py-3">
                <div className="flex items-baseline justify-between gap-[10px]">
                  <span className="text-[15px] font-semibold">{r.name}</span>
                  <span className={`shrink-0 font-mono text-sm ${gapColour(r.gap)}`}>{r.total} pts · {r.gapText}</span>
                </div>
                <span className="text-[13px] text-text-3">{r.note}</span>
              </div>
            ))
          ) : (
            <span className="text-[13px] text-text-3">No team is within reach this week.</span>
          )}
          <span className="text-xs text-muted">
            Top 4 get byes in Rounds 1 and 2 of playoffs, 5th–8th in Round 1. Tiebreak rules to confirm with NSE.
          </span>
        </div>
      </div>
    </Panel>
  );
}

export function ScenariosPhone({ s }: { s: ScenarioPreview }) {
  return (
    <Panel aria-labelledby="scenarios-phone" className="lg:hidden">
      <div className="flex flex-col gap-1 border-b border-line px-4 py-[14px]">
        <div className="flex items-center justify-between">
          <h2 id="scenarios-phone" className="h-section text-lg">Scenarios</h2>
          <Tag>{s.weekLabel} PREVIEW</Tag>
        </div>
        <span className="text-xs text-muted">
          Going in: {s.scenarios.goingIn.text}
          {s.archived && " · season over"}
        </span>
      </div>
      <div className="mx-4 my-[14px] border border-highlight-line bg-highlight px-[14px] py-3 text-sm leading-[1.45]">
        <Headline s={s} />
      </div>
      {s.scenarios.outcomes.map((o) => (
        <div
          key={o.key}
          className={`grid min-h-14 grid-cols-[minmax(0,1fr)_48px_64px] items-center gap-2 border-l-[3px] border-t border-t-divider px-4 ${effectBorder(o.effect)} ${o.effect === "promoted" ? "bg-highlight" : ""}`}
        >
          <span className="flex flex-col gap-[2px]">
            <span className="text-sm font-semibold">{o.plain}</span>
            <span className={`text-xs font-semibold ${effectColour(o.effect)}`}>{o.effectText.replace("Division ", "Div ")}</span>
          </span>
          <span className="text-right font-mono text-sm font-semibold text-accent">+{o.points}</span>
          <span className="text-right font-display text-[17px] font-bold">{o.total}</span>
        </div>
      ))}
    </Panel>
  );
}

// ------------------------------------------------------------------ standings

/** Full table (desktop dashboard, and the /standings page at every width). */
export function Standings({ v, limit, fullHref, className = "hidden lg:block" }: { v: DashboardView; limit?: number; fullHref?: string; className?: string }) {
  const t = v.standings;
  const ours = t.rows.find((r) => r.isOurs);
  const shown = limit && t.rows.length > limit ? t.rows.slice(0, limit) : t.rows;
  const rows = ours && !shown.includes(ours) ? [...shown, ours] : shown;
  const cols = `64px minmax(0,1fr) repeat(${t.weeks.length}, 80px) 100px ${t.rows.some((r) => r.playoffNote) ? "150px" : "0px"}`;
  return (
    <Panel aria-labelledby="standings" className={className}>
      <PanelHeader id="standings" title={`${v.tierName} standings`} right={<span className="text-[13px] text-muted">Promoted / relegated teams shown as —</span>} />
      <div className="overflow-x-auto">
      <div role="table" aria-label={`${v.tierName} standings`} className="min-w-[720px]">
        <div role="row" className="grid border-b border-line px-6 py-3 text-xs tracking-[0.14em] text-muted" style={{ gridTemplateColumns: cols }}>
          <span role="columnheader">POS</span>
          <span role="columnheader">TEAM</span>
          {t.weeks.map((w) => (
            <span role="columnheader" key={w.week} className="text-center">{w.label}</span>
          ))}
          <span role="columnheader" className="text-center">TOTAL</span>
          <span role="columnheader" className="text-right">{t.rows.some((r) => r.playoffNote) ? "PLAYOFFS" : ""}</span>
        </div>
        {rows.map((row) => (
          <div
            role="row"
            key={row.team.id}
            className={`grid h-11 items-center border-b border-l-4 border-b-divider px-6 last:border-b-0 ${row.isOurs ? "border-l-accent bg-highlight" : "border-l-transparent"}`}
            style={{ gridTemplateColumns: cols }}
          >
            <span role="cell" className="font-mono font-semibold text-text-3">{row.position}</span>
            <span role="cell" className={`truncate text-[15px] ${row.isOurs ? "font-bold text-accent" : "font-medium text-text"}`}>{row.team.shortName}</span>
            {t.weeks.map((w) => (
              <span role="cell" key={w.week} className="text-center font-mono text-text-2">{cellText(row.cells[w.week])}</span>
            ))}
            <span role="cell" className="text-center font-display text-lg font-bold">{row.total}</span>
            <span role="cell" className="text-right text-[13px] text-text-3">{shortPlayoffNote(row.playoffNote)}</span>
          </div>
        ))}
      </div>
      </div>
      {fullHref && rows.length < t.rows.length && (
        <Link href={fullHref} className="flex h-12 items-center justify-center border-t border-line text-sm font-semibold no-underline">
          All {t.rows.length} teams
        </Link>
      )}
    </Panel>
  );
}

export function StandingsPhone({ v, fullHref }: { v: DashboardView; fullHref: string }) {
  const t = v.standings;
  const top = t.rows.slice(0, 8);
  const ours = t.rows.find((r) => r.isOurs);
  const rows = ours && !top.includes(ours) ? [...top, ours] : top;
  return (
    <Panel aria-labelledby="standings-phone" className="lg:hidden">
      <div className="flex items-baseline justify-between border-b border-line px-4 py-[14px]">
        <h2 id="standings-phone" className="h-section text-lg">{v.tierName}</h2>
        <span className="text-xs text-muted">Top 8 · pts</span>
      </div>
      <ol>
        {rows.map((row) => (
          <li
            key={row.team.id}
            className={`grid h-11 grid-cols-[36px_minmax(0,1fr)_44px] items-center border-b border-l-[3px] border-b-divider px-4 ${row.isOurs ? "border-l-accent bg-highlight" : "border-l-transparent"}`}
          >
            <span className="font-mono text-text-3">{row.position}</span>
            <span className={`truncate text-sm ${row.isOurs ? "font-bold text-accent" : "font-medium"}`}>{row.team.shortName}</span>
            <span className="text-right font-display text-[17px] font-bold">{row.total}</span>
          </li>
        ))}
      </ol>
      <Link href={fullHref} className="flex h-12 items-center justify-center text-sm font-semibold no-underline">
        Full standings
      </Link>
    </Panel>
  );
}
