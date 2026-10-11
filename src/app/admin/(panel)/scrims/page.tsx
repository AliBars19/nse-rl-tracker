import Link from "next/link";
import { AdminCard, Notice } from "@/components/admin/ui";
import { ScrimForm } from "@/components/admin/ScrimForm";
import { adminDataset } from "@/lib/data/admin";
import { ctxOf, ourTeam } from "@/lib/engine/context";
import { scrimResult, scrimScore, scrimSeries } from "@/lib/engine/scrims";
import { dayDate } from "@/lib/view/dashboard";
import { TEAM_KEYS } from "@/lib/view/team";

/** 'YYYY-MM-DD' and 'HH:MM' of an instant, in UK time (what the admin typed). */
function londonParts(iso: string): { date: string; time: string } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

const RES_WORD = { W: "Win", L: "Loss", D: "Draw" } as const;

export default async function ScrimsAdmin() {
  const { ds } = await adminDataset();
  if (!ds) return <Notice>No current season.</Notice>;
  const ctx = ctxOf(ds);
  const today = londonParts(new Date().toISOString()).date;

  return (
    <>
      <Notice>
        Scrims are practice series outside NSE matchdays. Their replays count towards player stats (leaderboards,
        profiles, the roster), but never towards points, standings, series records, form or scouting. The score is
        optional: without one, the site counts game wins from the uploaded replays.
      </Notice>
      {TEAM_KEYS.map((key) => {
        const o = ourTeam(ds, key);
        if (!o) return null;
        const opponents = ds.teams
          .filter((t) => t.id !== o.team.id)
          .map((t) => ({ id: t.id, name: t.name }))
          .sort((a, b) => a.name.localeCompare(b.name));
        const scrims = scrimSeries(ctx, o.team.id).reverse();
        return (
          <AdminCard key={key} title={`${o.team.name} · scrims`} id={`s-${key}`}>
            <ScrimForm teamKey={key} opponents={opponents} today={today} />
            {scrims.length > 0 ? (
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {scrims.map((s) => {
                  const score = scrimScore(ctx, s);
                  const res = scrimResult(score);
                  const replays = ds.games.filter((g) => g.seriesId === s.series.id && g.processedAt).length;
                  const when = s.series.playedAt ? londonParts(s.series.playedAt) : { date: today, time: "19:00" };
                  return (
                    <li key={s.series.id} className="border border-line bg-inset">
                      <details>
                        <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                          <span className="font-display font-bold uppercase tracking-[0.06em]">
                            {s.series.playedAt ? dayDate(s.series.playedAt) : "Date TBC"} · vs {s.opponent?.shortName ?? "TBC"}
                          </span>
                          <span className={`font-mono text-sm ${res === "W" ? "text-win" : res === "L" ? "text-loss" : "text-muted"}`}>
                            {score ? `${score.our}–${score.opp}${res ? ` ${RES_WORD[res]}` : ""}${score.source === "replays" ? " (from replays)" : ""}` : "No score yet"}
                          </span>
                          <span className="text-sm text-text-3">{replays} {replays === 1 ? "replay" : "replays"}</span>
                          <Link href={`/admin/replays?series=${s.series.id}`} className="ml-auto text-sm">Upload replays</Link>
                        </summary>
                        <div className="border-t border-line px-4 py-4">
                          <ScrimForm
                            teamKey={key}
                            opponents={opponents}
                            today={today}
                            initial={{
                              id: s.series.id,
                              ...when,
                              opponentId: s.opponent?.id ?? "",
                              our: s.series.homeTeamId === o.team.id ? s.series.homeScore : s.series.awayScore,
                              opp: s.series.homeTeamId === o.team.id ? s.series.awayScore : s.series.homeScore,
                            }}
                          />
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="m-0 text-sm text-muted">No scrims yet this season.</p>
            )}
          </AdminCard>
        );
      })}
    </>
  );
}
