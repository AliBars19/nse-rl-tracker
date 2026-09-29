import Link from "next/link";
import { AdminCard, Field, Notice } from "@/components/admin/ui";
import { LinkNames, type UnlinkedName } from "@/components/admin/LinkNames";
import { ReplayUploader } from "@/components/admin/ReplayUploader";
import { SeriesPicker } from "@/components/admin/SeriesPicker";
import { adminDataset } from "@/lib/data/admin";
import { ctxOf, ourTeam, seasonSeries } from "@/lib/engine/context";
import { nightsForSeason } from "@/lib/engine/nights";
import { PLAYOFF_ROUND_NAMES } from "@/lib/engine/stats";
import { ballchasingToken } from "@/lib/env";
import { TEAM_KEYS } from "@/lib/view/team";

export default async function ReplaysAdmin({ searchParams }: PageProps<"/admin/replays">) {
  const { series: seriesParam } = await searchParams;
  const { db, ds } = await adminDataset();
  if (!ds) return <Notice>No current season.</Notice>;
  const ctx = ctxOf(ds);

  const groups: Array<{ label: string; options: Array<{ id: string; label: string }> }> = [];
  for (const key of TEAM_KEYS) {
    const o = ourTeam(ds, key);
    if (!o) continue;
    const labels = new Map<string, string>();
    for (const n of nightsForSeason(ctx, o.team.id, o.teamSeason.tier)) for (const r of n.rounds) labels.set(r.ts.series.id, `${n.night.label} · ${r.title}`);
    const options = seasonSeries(ctx, o.team.id, o.teamSeason.tier)
      .filter((s) => s.opponent && !s.series.isForfeit)
      .map((s) => {
        const done = ds.games.filter((g) => g.seriesId === s.series.id && g.processedAt).length;
        const where = labels.get(s.series.id) ?? (s.series.playoffRound ? PLAYOFF_ROUND_NAMES[s.series.playoffRound] : "Playoffs");
        return { id: s.series.id, label: `${where} · vs ${s.opponent!.shortName} ${s.our}–${s.opp} · ${done}/${(s.our ?? 0) + (s.opp ?? 0)} replays` };
      })
      .reverse();
    groups.push({ label: o.team.name, options });
  }

  const selected = typeof seriesParam === "string" ? ds.series.find((s) => s.id === seriesParam) : undefined;
  let body = <Notice>Pick a series to upload its replays.</Notice>;
  if (selected) {
    const ourId = ds.teams.find((t) => t.ourKey && (t.id === selected.homeTeamId || t.id === selected.awayTeamId))?.id;
    const played = (selected.homeScore ?? 0) + (selected.awayScore ?? 0);
    const games = ds.games.filter((g) => g.seriesId === selected.id).sort((a, b) => a.gameNumber - b.gameNumber);
    const { data: statusRows } = await db.from("games").select("id, ballchasing_status").eq("series_id", selected.id);
    const statusOf = new Map((statusRows ?? []).map((r) => [r.id as string, r.ballchasing_status as string | null]));

    const gameIds = new Set(ds.games.map((g) => g.id));
    const unlinked = new Map<string, UnlinkedName>();
    const { data: unl } = await db
      .from("player_game_stats")
      .select("game_id, display_name, platform, team_id")
      .is("player_id", null)
      .in("team_id", ds.teams.filter((t) => t.ourKey).map((t) => t.id));
    for (const r of unl ?? []) {
      if (!gameIds.has(r.game_id)) continue;
      const name = r.display_name as string;
      const cur: UnlinkedName = unlinked.get(name) ?? { displayName: name, gameIds: [], platform: r.platform as string | null };
      cur.gameIds.push(r.game_id as string);
      unlinked.set(name, cur);
    }
    const roster = ds.roster
      .filter((r) => r.teamId === ourId)
      .map((r) => ds.players.find((p) => p.id === r.playerId)!)
      .map((p) => ({ id: p.id, nickname: p.nickname }));

    body = (
      <>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {Array.from({ length: played }, (_, i) => {
            const g = games.find((x) => x.gameNumber === i + 1);
            const st = g ? (g.processedAt ? "Stats in" : statusOf.get(g.id) === "failed" ? "Failed" : "Processing") : "Missing";
            return (
              <li key={i} className={`flex flex-col gap-1 border p-3 ${g?.processedAt ? "border-line bg-inset" : "border-dashed border-line-strong"}`}>
                <span className="text-xs tracking-[0.14em] text-muted">GAME {i + 1}</span>
                <span className="text-sm">{st}</span>
                {g?.ballchasingId && (
                  <a className="text-xs" href={`https://ballchasing.com/replay/${g.ballchasingId}`} target="_blank" rel="noreferrer">ballchasing ↗</a>
                )}
              </li>
            );
          })}
        </ul>
        <ReplayUploader seriesId={selected.id} gamesPlayed={played} taken={games.filter((g) => g.processedAt).map((g) => g.gameNumber)} />
      </>
    );
    return (
      <>
        <AdminCard title="Replays" id="replays">
          {!ballchasingToken() && <Notice tone="error">BALLCHASING_TOKEN is not set: uploads will fail.</Notice>}
          <Field label="Series" htmlFor="series"><SeriesPicker groups={groups} value={selected.id} /></Field>
          {body}
          <p className="m-0 text-xs text-muted">
            Replays only exist on PC: someone on each team needs to save them (or auto-upload with BakkesMod). Uploads
            are {process.env.BALLCHASING_VISIBILITY ?? "unlisted"} on ballchasing.
          </p>
        </AdminCard>
        <AdminCard title="Link players" id="link">
          <LinkNames names={[...unlinked.values()]} roster={roster} />
          <Link href="/admin/roster" className="text-sm">Edit platform IDs on the Roster page</Link>
        </AdminCard>
      </>
    );
  }
  return (
    <AdminCard title="Replays" id="replays">
      <Field label="Series" htmlFor="series"><SeriesPicker groups={groups} value={null} /></Field>
      {body}
    </AdminCard>
  );
}
