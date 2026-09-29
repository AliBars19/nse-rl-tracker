import type { Metadata } from "next";
import { TeamSwitcher } from "@/components/chrome/TeamSwitcher";
import {
  FormPanel,
  Hero,
  LadderPanel,
  LeagueNights,
  LeagueNightsPhone,
  PointsChart,
  RosterPanel,
  Scenarios,
  ScenariosPhone,
  Standings,
  StandingsPhone,
  Tiles,
} from "@/components/dashboard/sections";
import { Main } from "@/components/ui";
import { getViewer } from "@/lib/auth";
import { buildDashboard } from "@/lib/view/dashboard";
import { loadTeamPage } from "@/lib/view/team";

export async function generateMetadata({ params }: PageProps<"/[season]/[team]">): Promise<Metadata> {
  const { season, team } = await params;
  const p = await loadTeamPage(season, team);
  return { title: `${p.team.name} · ${p.ds.season.shortName}` };
}

export default async function DashboardPage({ params }: PageProps<"/[season]/[team]">) {
  const { season, team } = await params;
  const [p, viewer] = await Promise.all([loadTeamPage(season, team), getViewer()]);
  const v = buildDashboard(p);
  const switcher = <TeamSwitcher options={p.teamOptions} current={p.key} />;

  return (
    <Main>
      <Hero v={v} switcher={switcher} />
      <Tiles v={v} />

      {/* Phone order: form, nights, scenarios, standings (Mobile.dc.html). */}
      <div className="flex flex-col gap-5 lg:hidden">
        <FormPanel v={v} />
        <LeagueNightsPhone v={v} />
        {v.scenarios && <ScenariosPhone s={v.scenarios} />}
        <StandingsPhone v={v} fullHref={`${p.base}/standings`} />
      </div>

      <section className="hidden grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-6 lg:grid">
        <div className="flex flex-col gap-6">
          <LeagueNights v={v} isAdmin={viewer.isAdmin} />
          <PointsChart v={v} />
        </div>
        <div className="flex flex-col gap-6">
          <FormPanel v={v} />
          <LadderPanel v={v} />
          <RosterPanel v={v} playersHref={`${p.base}/players`} />
        </div>
      </section>

      {v.scenarios && <Scenarios s={v.scenarios} />}
      <Standings v={v} limit={20} fullHref={`${p.base}/standings`} />
    </Main>
  );
}
