import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ScoutingView } from "@/components/scouting/ScoutingView";
import { opponentList } from "@/lib/engine/scouting";
import { loadTeamPage } from "@/lib/view/team";

export async function generateMetadata({ params }: PageProps<"/[season]/[team]/scouting/[opp]">): Promise<Metadata> {
  const { season, team, opp } = await params;
  const p = await loadTeamPage(season, team);
  const o = p.ds.teams.find((t) => t.slug === opp);
  return { title: o ? `${p.team.shortName} vs ${o.shortName}` : "Scouting" };
}

export default async function OpponentPage({ params }: PageProps<"/[season]/[team]/scouting/[opp]">) {
  const { season, team, opp } = await params;
  const p = await loadTeamPage(season, team);
  if (!opponentList(p.season).some((o) => o.team.slug === opp)) notFound();
  return <ScoutingView p={p} oppSlug={opp} />;
}
