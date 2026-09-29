import Link from "next/link";
import { AdminCard, Notice } from "@/components/admin/ui";
import { NewSeasonForm, SeasonFinishedToggle } from "@/components/admin/SeasonForm";
import { adminDataset } from "@/lib/data/admin";
import { ctxOf, seasonSeries } from "@/lib/engine/context";
import { nightsForSeason } from "@/lib/engine/nights";
import { replayCoverage } from "@/lib/engine/players";
import { TIER_NAMES } from "@/lib/engine/rulesets";
import { ballchasingToken } from "@/lib/env";
import { TEAM_KEYS } from "@/lib/view/team";
import { ourTeam } from "@/lib/engine/context";

export default async function AdminHome() {
  const { ds, seasons } = await adminDataset();
  if (!ds) {
    return (
      <AdminCard title="Create the first season" id="first">
        <Notice>The database has no seasons yet. Load supabase/seed.sql for Spring 26, or create a season here.</Notice>
        <NewSeasonForm />
      </AdminCard>
    );
  }
  const ctx = ctxOf(ds);
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="m-0 font-display text-4xl font-bold uppercase">{ds.season.name}</h1>
        <span className="text-sm text-muted">{seasons.length} season{seasons.length === 1 ? "" : "s"} in the database</span>
      </div>
      {!ballchasingToken() && <Notice tone="error">BALLCHASING_TOKEN is not set, so replay uploads will fail. Add it in Vercel → Settings → Environment Variables.</Notice>}

      <div className="grid gap-6 md:grid-cols-2">
        {TEAM_KEYS.map((key) => {
          const o = ourTeam(ds, key);
          if (!o) return <AdminCard key={key} title={`City ${key}`}><Notice>Not set up for this season.</Notice></AdminCard>;
          const season = seasonSeries(ctx, o.team.id, o.teamSeason.tier);
          const nights = nightsForSeason(ctx, o.team.id, o.teamSeason.tier);
          const cov = replayCoverage(ctx, season);
          const mismatches = nights.filter((n) => n.mismatch);
          const upcoming = ds.upcoming.find((u) => u.teamId === o.team.id);
          return (
            <AdminCard key={key} title={o.team.name} id={`t-${key}`} right={<span className="text-sm text-muted">{TIER_NAMES[o.teamSeason.tier].long}</span>}>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <dt className="text-muted">League nights</dt><dd className="m-0">{nights.length}</dd>
                <dt className="text-muted">Series</dt><dd className="m-0">{season.filter((s) => s.result !== "BYE").length}</dd>
                <dt className="text-muted">Replays with stats</dt><dd className="m-0">{cov.processed} / {cov.total} games</dd>
                <dt className="text-muted">Next night</dt><dd className="m-0">{upcoming ? `Week ${upcoming.week}` : "Not set"}</dd>
              </dl>
              {mismatches.length > 0 ? (
                <Notice tone="error">
                  Engine and NSE sheet disagree: {mismatches.map((n) => `${n.night.label} (engine ${n.computed?.points}, sheet ${n.sheet?.points})`).join("; ")}.
                </Notice>
              ) : (
                <Notice tone="ok">Calculated points match the NSE sheet for every night.</Notice>
              )}
              <div className="flex flex-wrap gap-3 text-sm">
                <Link href={`/admin/nights?team=${key}`}>Enter a night</Link>
                <Link href="/admin/replays">Upload replays</Link>
                <Link href={`/${ds.season.slug}/${key}`}>Open dashboard</Link>
              </div>
            </AdminCard>
          );
        })}
      </div>

      <AdminCard title="Season" id="season">
        <p className="m-0 text-sm text-text-3">
          {ds.season.isFinished ? "Finished: the site says “Finished 6th”." : "In progress: the site says “Currently 6th”."}
        </p>
        <SeasonFinishedToggle seasonId={ds.season.id} finished={ds.season.isFinished} />
      </AdminCard>

      <AdminCard title="New season" id="new-season">
        <NewSeasonForm />
      </AdminCard>
    </>
  );
}
