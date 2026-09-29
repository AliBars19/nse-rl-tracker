import type { Metadata } from "next";
import { ScoutingView } from "@/components/scouting/ScoutingView";
import { loadTeamPage } from "@/lib/view/team";

export async function generateMetadata({ params }: PageProps<"/[season]/[team]/scouting">): Promise<Metadata> {
  const { season, team } = await params;
  const p = await loadTeamPage(season, team);
  return { title: `Scouting · ${p.team.name}` };
}

export default async function ScoutingPage({ params }: PageProps<"/[season]/[team]/scouting">) {
  const { season, team } = await params;
  return <ScoutingView p={await loadTeamPage(season, team)} oppSlug={null} />;
}
