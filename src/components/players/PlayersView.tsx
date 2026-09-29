import Link from "next/link";
import { TeamSwitcher } from "@/components/chrome/TeamSwitcher";
import { Avatar, fmt1, Main, Placeholder } from "@/components/ui";
import { leaders, MIN_GAMES_TO_RANK, playerLines, playerProfile, replayCoverage, type PlayerLine } from "@/lib/engine/players";
import type { TeamPage } from "@/lib/view/team";

type Scope = "game" | "totals";

function cells(l: PlayerLine, scope: Scope): string[] {
  if (!l.gp) return ["—", "—", "—", "—", "—", "—", "—"];
  const t = scope === "game" ? l.perGame! : l.totals;
  const n = (x: number) => (scope === "game" ? x.toFixed(1) : String(Math.round(x)));
  return [
    String(l.gp),
    scope === "game" ? t.score.toFixed(0) : String(t.score),
    n(t.goals),
    n(t.assists),
    n(t.saves),
    l.shootingPct === null ? "—" : `${l.shootingPct.toFixed(0)}%`,
    String(l.totals.mvps),
  ];
}

const COLS = ["GP", "SCORE", "G", "A", "SV", "SH%", "MVP"];
const COL_TITLES = ["Games played", "Score", "Goals", "Assists", "Saves", "Shooting percentage", "MVPs"];

export function PlayersView({ p, playerSlug, scope }: { p: TeamPage; playerSlug: string | null; scope: Scope }) {
  const lines = playerLines(p.ctx, p.team.id, p.season);
  const lead = leaders(lines);
  const cov = replayCoverage(p.ctx, p.season);
  const selected = lines.find((l) => l.player.slug === playerSlug) ?? lines[0];
  const profile = selected ? playerProfile(p.ctx, selected.player.id, p.season, p.nights) : null;
  const base = `${p.base}/players`;
  const q = scope === "totals" ? "?scope=totals" : "";
  const roleText = (r: string) => (r === "leader" ? "Team leader" : r === "sub" ? "Sub" : "Player");
  const maxAvg = Math.max(1, ...(profile?.avgByNight.map((n) => n.avg ?? 0) ?? [1]));

  const tiles = selected
    ? [
        ["GAMES", selected.gp ? String(selected.gp) : null],
        ["GOALS / G", selected.perGame ? fmt1(selected.perGame.goals) : null],
        ["ASSISTS / G", selected.perGame ? fmt1(selected.perGame.assists) : null],
        ["SAVES / G", selected.perGame ? fmt1(selected.perGame.saves) : null],
        ["SHOOTING %", selected.shootingPct === null ? null : `${selected.shootingPct.toFixed(0)}%`],
        ["MVPS", selected.gp ? String(selected.totals.mvps) : null],
      ]
    : [];

  return (
    <Main>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <TeamSwitcher options={p.teamOptions} current={p.key} />
        <Placeholder right={`${cov.processed} / ${cov.total} games`} className="py-[10px]">
          Stats fill in from uploaded replays
        </Placeholder>
      </div>

      <div className="flex flex-col gap-1 md:flex-row md:items-baseline md:gap-[18px]">
        <h1 className="m-0 font-display text-5xl font-bold uppercase leading-none md:text-[64px]">Players</h1>
        <span className="text-base text-text-3">
          {lines.length} on the NSE roster · {p.ds.season.shortName}
        </span>
      </div>

      <section aria-label="Leaders" className="grid grid-cols-2 gap-2 md:gap-4 lg:grid-cols-4">
        {lead.map((l) => (
          <div key={l.label} className="flex flex-col gap-2 border border-line border-t-[3px] border-t-accent bg-panel px-4 py-4 md:px-[22px] md:py-5">
            <span className="text-[11px] tracking-[0.16em] text-muted md:text-xs">{l.label}</span>
            {l.line ? (
              <>
                <Link href={`${base}/${l.line.player.slug}${q}`} className="truncate font-display text-[22px] font-bold text-text no-underline hover:text-accent md:text-[26px]">
                  {l.line.player.nickname}
                </Link>
                <span className="font-mono text-sm text-text-2">{fmt1(l.value)} {l.unit}</span>
              </>
            ) : (
              <>
                <span className="font-display text-[22px] font-bold text-disabled md:text-[26px]">[PLAYER]</span>
                <span className="font-mono text-sm text-muted">— {l.unit}</span>
              </>
            )}
          </div>
        ))}
      </section>

      <section className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-6">
        <div className="border border-line bg-panel" aria-labelledby="leaderboard">
          <div className="flex items-center justify-between border-b border-line px-4 py-[18px] md:px-6">
            <h2 id="leaderboard" className="h-section text-lg md:text-[22px]">Leaderboard</h2>
            <div role="group" aria-label="Scope" className="flex gap-[6px]">
              {(["game", "totals"] as const).map((s) => (
                <Link
                  key={s}
                  href={`${selected ? `${base}/${selected.player.slug}` : base}${s === "totals" ? "?scope=totals" : ""}`}
                  scroll={false}
                  aria-current={scope === s ? "true" : undefined}
                  className={
                    "flex h-11 items-center px-[14px] text-[13px] no-underline md:h-9 " +
                    (scope === s ? "border border-accent bg-line font-semibold text-text hover:text-text" : "border border-line-strong font-medium text-text-3 hover:text-text")
                  }
                >
                  {s === "game" ? "Per game" : "Totals"}
                </Link>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto" tabIndex={0} aria-label="Leaderboard, scrolls sideways">
            <div role="table" aria-label="Player leaderboard" className="min-w-[640px]">
              <div role="row" className="grid grid-cols-[minmax(0,1fr)_repeat(7,64px)] border-b border-line px-6 py-3 text-xs tracking-[0.12em] text-muted">
                <span role="columnheader">PLAYER</span>
                {COLS.map((c, i) => (
                  <span role="columnheader" key={c} className="text-right">
                    <abbr title={COL_TITLES[i]} className="no-underline">{c}</abbr>
                  </span>
                ))}
              </div>
              {lines.map((l) => {
                const sel = l === selected;
                return (
                  <div
                    role="row"
                    key={l.player.id}
                    aria-current={sel ? "true" : undefined}
                    className={
                      "relative grid h-16 grid-cols-[minmax(0,1fr)_repeat(7,64px)] items-center border-b border-l-4 border-b-divider px-6 transition-soft hover:bg-inset " +
                      (sel ? "border-l-accent bg-highlight" : "border-l-transparent")
                    }
                  >
                    <span role="cell" className="flex items-center gap-3">
                      <Avatar name={l.player.nickname} />
                      <span className="flex flex-col">
                        {/* Stretched link: the whole row is clickable, but the table keeps its roles. */}
                        <Link href={`${base}/${l.player.slug}${q}`} scroll={false} className="text-[15px] font-semibold text-text no-underline after:absolute after:inset-0 hover:text-text">
                          {l.player.nickname}
                        </Link>
                        <span className="text-xs text-muted">{roleText(l.role)}</span>
                      </span>
                    </span>
                    {cells(l, scope).map((c, i) => (
                      <span role="cell" key={i} className={`text-right font-mono ${c === "—" ? "text-disabled" : l.ranked || i === 0 ? "text-text-2" : "text-muted"}`}>
                        {c}
                      </span>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="px-6 py-[14px] text-xs text-muted">Min. {MIN_GAMES_TO_RANK} games to rank · click a player to open their profile</div>
        </div>

        {selected && profile && (
          <aside className="flex flex-col border border-line bg-panel" aria-labelledby="profile-name">
            <div className="flex items-center gap-4 border-b border-line px-6 py-[22px]">
              <Avatar name={selected.player.nickname} size={64} accent />
              <div className="flex flex-col gap-1">
                <span id="profile-name" className="font-display text-[30px] font-bold uppercase leading-none">{selected.player.nickname}</span>
                <span className="text-sm text-text-3">
                  {roleText(selected.role)} · {p.team.name}
                  {selected.player.nseProfileUrl && (
                    <>
                      {" · "}
                      <a href={selected.player.nseProfileUrl} className="text-text-3 hover:text-text">NSE profile</a>
                    </>
                  )}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-px border-b border-line bg-line">
              {tiles.map(([label, value]) => (
                <div key={label} className="flex flex-col gap-[6px] bg-panel px-[18px] py-4">
                  <span className="text-[11px] tracking-[0.14em] text-muted">{label}</span>
                  <span className={`font-display text-[28px] font-bold leading-none ${value ? "" : "text-disabled"}`}>{value ?? "—"}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-3 border-b border-line px-6 py-5">
              <span className="text-xs tracking-[0.14em] text-muted">AVG SCORE BY NIGHT</span>
              <div
                role="img"
                aria-label={`Average score by night: ${profile.avgByNight.map((n) => `${n.label} ${n.avg === null ? "no replays" : n.avg.toFixed(0)}`).join(", ")}`}
                className="grid h-[120px] items-end gap-4 border-b border-line-strong"
                style={{ gridTemplateColumns: `repeat(${profile.avgByNight.length || 1}, minmax(0, 1fr))` }}
              >
                {profile.avgByNight.map((n) => (
                  <div key={n.label} className="flex h-full flex-col items-center justify-end gap-[6px]">
                    {n.avg === null ? (
                      <div className="h-[70%] w-[60%] border border-dashed border-line-strong bg-inset" />
                    ) : (
                      <>
                        <span className="font-mono text-xs">{n.avg.toFixed(0)}</span>
                        <div className="clip-bar w-[60%] bg-accent" style={{ height: `${(n.avg / maxAvg) * 80}%` }} />
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${profile.avgByNight.length || 1}, minmax(0, 1fr))` }} aria-hidden>
                {profile.avgByNight.map((n) => (
                  <span key={n.label} className="text-center text-xs tracking-[0.08em] text-text-3">{n.label}</span>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-[10px] px-6 py-5">
              <span className="text-xs tracking-[0.14em] text-muted">BEST GAME</span>
              {profile.best ? (
                <div className="flex items-center justify-between border border-line bg-inset px-4 py-[14px]">
                  <span className="flex flex-col gap-[2px]">
                    <span className="text-[15px] font-semibold">{profile.best.opponent} · {profile.best.night}</span>
                    <span className="text-xs text-text-3">{profile.best.goals} G · {profile.best.assists} A · {profile.best.saves} Sv</span>
                  </span>
                  <span className="font-display text-[26px] font-bold">{profile.best.score} pts</span>
                </div>
              ) : (
                <div className="flex items-center justify-between border border-dashed border-line-strong bg-inset px-4 py-[14px]">
                  <span className="flex flex-col gap-[2px]">
                    <span className="text-[15px] font-semibold text-muted">[OPPONENT] · [WEEK]</span>
                    <span className="text-xs text-muted">— G · — A · — Sv</span>
                  </span>
                  <span className="font-display text-[26px] font-bold text-disabled">— pts</span>
                </div>
              )}
            </div>
          </aside>
        )}
      </section>
    </Main>
  );
}
