import type { Metadata } from "next";
import Link from "next/link";
import { TeamSwitcher } from "@/components/chrome/TeamSwitcher";
import { Standings } from "@/components/dashboard/sections";
import { Main } from "@/components/ui";
import { buildDashboard } from "@/lib/view/dashboard";
import { loadTeamPage } from "@/lib/view/team";

export async function generateMetadata({ params }: PageProps<"/[season]/[team]/standings">): Promise<Metadata> {
  const { season, team } = await params;
  const p = await loadTeamPage(season, team);
  return { title: `${p.tierName} standings · ${p.ds.season.shortName}` };
}

export default async function StandingsPage({ params }: PageProps<"/[season]/[team]/standings">) {
  const { season, team } = await params;
  const p = await loadTeamPage(season, team);
  const v = buildDashboard(p);
  const departed = v.standings.departed;
  return (
    <Main>
      <TeamSwitcher options={p.teamOptions} current={p.key} />
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="m-0 font-display text-4xl font-bold uppercase lg:text-5xl">{v.tierName} standings</h1>
        <span className="text-text-3">{p.ds.season.name} · from the NSE standings sheet</span>
      </div>
      <Standings v={v} className="block" />
      {departed.length > 0 && (
        <p className="m-0 text-sm text-text-3">
          Also in {v.tierName} this season: {departed.map((r) => r.team.shortName).join(", ")}.
        </p>
      )}
      <Link href={p.base} className="text-sm">← Back to the dashboard</Link>
    </Main>
  );
}
