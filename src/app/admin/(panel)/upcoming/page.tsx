import { AdminCard, Notice } from "@/components/admin/ui";
import { UpcomingForm } from "@/components/admin/UpcomingForm";
import { adminDataset } from "@/lib/data/admin";
import { ourTeam } from "@/lib/engine/context";
import { TIER_NAMES } from "@/lib/engine/rulesets";
import { standingsTable } from "@/lib/engine/standings";
import { ctxOf } from "@/lib/engine/context";
import { TEAM_KEYS } from "@/lib/view/team";

export default async function UpcomingAdmin() {
  const { ds } = await adminDataset();
  if (!ds) return <Notice>No current season.</Notice>;
  const ctx = ctxOf(ds);
  return (
    <>
      <Notice>
        The dashboard&apos;s Scenarios section previews the next night from the current standings and the Round 1
        draw. Without an upcoming night it shows the last night&apos;s preview, labelled as archived.
      </Notice>
      {TEAM_KEYS.map((key) => {
        const o = ourTeam(ds, key);
        if (!o) return null;
        const rs = ctx.ruleset(o.teamSeason.tier);
        const up = ds.upcoming.find((u) => u.teamId === o.team.id);
        const lastWeek = Math.max(0, ...ds.nights.filter((n) => n.tier === o.teamSeason.tier).map((n) => n.week));
        const inTier = standingsTable(ctx, o.teamSeason.tier).rows.map((r) => r.team).filter((t) => t.id !== o.team.id);
        const opponents = (inTier.length ? inTier : ds.teams.filter((t) => !t.ourKey)).map((t) => ({ id: t.id, name: t.name })).sort((a, b) => a.name.localeCompare(b.name));
        return (
          <AdminCard key={key} title={`${o.team.name} · next night`} id={`u-${key}`}>
            {!rs.ladder && <Notice tone="error">{TIER_NAMES[o.teamSeason.tier].long} has no confirmed points ladder, so Scenarios stay hidden for this team.</Notice>}
            <UpcomingForm
              teamKey={key}
              opponents={opponents}
              initial={{ week: up?.week ?? lastWeek + 1, date: up?.date ?? null, r1OpponentId: up?.r1OpponentId ?? null, saved: !!up }}
            />
          </AdminCard>
        );
      })}
    </>
  );
}
