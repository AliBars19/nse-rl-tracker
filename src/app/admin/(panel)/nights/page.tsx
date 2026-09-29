import { AdminCard, Notice } from "@/components/admin/ui";
import { NightForm, type NightFormTeam, type RoundDraft } from "@/components/admin/NightForm";
import { adminDataset } from "@/lib/data/admin";
import type { TeamKey } from "@/lib/domain/types";
import { ctxOf, ourTeam } from "@/lib/engine/context";
import { nightsForSeason } from "@/lib/engine/nights";
import { TIER_NAMES } from "@/lib/engine/rulesets";
import { TEAM_KEYS } from "@/lib/view/team";

export default async function NightsAdmin({ searchParams }: PageProps<"/admin/nights">) {
  const { team } = await searchParams;
  const { ds } = await adminDataset();
  if (!ds) return <Notice>No current season.</Notice>;
  const ctx = ctxOf(ds);
  const teams: NightFormTeam[] = TEAM_KEYS.flatMap((key) => {
    const o = ourTeam(ds, key);
    if (!o) return [];
    const rs = ctx.ruleset(o.teamSeason.tier);
    const nights: NightFormTeam["nights"] = {};
    for (const n of nightsForSeason(ctx, o.team.id, o.teamSeason.tier)) {
      if (n.night.stage !== "league") continue;
      nights[n.night.week] = {
        date: n.night.date,
        rounds: n.rounds.map<RoundDraft>((r) => ({
          round: r.round,
          opponentId: r.ts.opponent?.id ?? null,
          newOpponent: null,
          bye: r.ts.result === "BYE",
          our: r.ts.our,
          opp: r.ts.opp,
          forfeit: r.ts.series.isForfeit,
          nseMatchId: r.ts.series.nseMatchId,
        })),
      };
    }
    return [{ key, name: o.team.name, tierName: TIER_NAMES[o.teamSeason.tier].long, ladder: rs.ladder, roundStyle: rs.roundStyle, nights }];
  });
  const opponents = ds.teams.filter((t) => !t.ourKey).map((t) => ({ id: t.id, name: t.name })).sort((a, b) => a.name.localeCompare(b.name));
  const initial = (TEAM_KEYS.includes(team as TeamKey) ? team : "champions") as TeamKey;

  return (
    <AdminCard title="League night" id="night">
      <p className="m-0 text-sm text-text-3">
        Enter City&apos;s three series for a night. Points are calculated from these results, never typed in. To pull a
        whole night (every team) straight from NSE, use Imports instead.
      </p>
      <NightForm teams={teams} opponents={opponents} initialTeam={initial} />
    </AdminCard>
  );
}
