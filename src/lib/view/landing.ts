import "server-only";
import { getDataset, getSeasons } from "@/lib/data";
import { ctxOf, ourTeam } from "@/lib/engine/context";
import { TIER_NAMES } from "@/lib/engine/rulesets";
import { standingsTable } from "@/lib/engine/standings";
import { ordinal } from "@/lib/engine/stats";
import { TEAM_KEYS } from "./team";

export interface LandingTeam {
  key: string;
  name: string; // 'City Champions'
  tier: string; // 'Division 2'
  /** '6th of 16 · 20 pts' (or 'No results yet') */
  standing: string;
  href: string;
}

export interface LandingSeason {
  slug: string;
  name: string;
  status: "finished" | "in-progress";
  /** Marked current in the admin; listed first and highlighted. */
  isCurrent: boolean;
  teams: LandingTeam[];
}

/** Seasons for the landing page, current season first, then newest first. */
export async function buildLanding(): Promise<LandingSeason[]> {
  const seasons = await getSeasons();
  const ordered = [...seasons].sort(
    (a, b) => Number(b.isCurrent) - Number(a.isCurrent) || b.slug.localeCompare(a.slug),
  );
  return Promise.all(
    ordered.map(async (s) => {
      const ds = await getDataset(s.slug);
      const teams: LandingTeam[] = [];
      if (ds) {
        const ctx = ctxOf(ds);
        for (const key of TEAM_KEYS) {
          const o = ourTeam(ds, key);
          if (!o) continue;
          const table = standingsTable(ctx, o.teamSeason.tier);
          const row = table.rows.find((r) => r.team.id === o.team.id);
          teams.push({
            key,
            name: o.team.name,
            tier: TIER_NAMES[o.teamSeason.tier].long,
            standing: row?.position
              ? `${ordinal(row.position)} of ${table.rows.length} · ${row.total} pts`
              : "No results yet",
            href: `/${s.slug}/${key}`,
          });
        }
      }
      return {
        slug: s.slug,
        name: s.name,
        status: s.isFinished ? "finished" : "in-progress",
        isCurrent: s.isCurrent,
        teams,
      } satisfies LandingSeason;
    }),
  );
}
