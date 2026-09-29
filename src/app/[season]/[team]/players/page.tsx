import type { Metadata } from "next";
import { PlayersView } from "@/components/players/PlayersView";
import { loadTeamPage } from "@/lib/view/team";

export async function generateMetadata({ params }: PageProps<"/[season]/[team]/players">): Promise<Metadata> {
  const { season, team } = await params;
  const p = await loadTeamPage(season, team);
  return { title: `Players · ${p.team.name}` };
}

export default async function PlayersPage({ params, searchParams }: PageProps<"/[season]/[team]/players">) {
  const { season, team } = await params;
  const { scope } = await searchParams;
  return <PlayersView p={await loadTeamPage(season, team)} playerSlug={null} scope={scope === "totals" ? "totals" : "game"} />;
}
