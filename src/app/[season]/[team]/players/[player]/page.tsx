import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlayersView } from "@/components/players/PlayersView";
import { loadTeamPage } from "@/lib/view/team";

async function load(season: string, team: string, player: string) {
  const p = await loadTeamPage(season, team);
  const onRoster = p.ds.roster.some(
    (r) => r.teamId === p.team.id && p.ds.players.find((x) => x.id === r.playerId)?.slug === player,
  );
  if (!onRoster) notFound();
  return p;
}

export async function generateMetadata({ params }: PageProps<"/[season]/[team]/players/[player]">): Promise<Metadata> {
  const { season, team, player } = await params;
  const p = await load(season, team, player);
  return { title: `${p.ds.players.find((x) => x.slug === player)?.nickname} · ${p.team.name}` };
}

export default async function PlayerPage({ params, searchParams }: PageProps<"/[season]/[team]/players/[player]">) {
  const { season, team, player } = await params;
  const { scope } = await searchParams;
  return <PlayersView p={await load(season, team, player)} playerSlug={player} scope={scope === "totals" ? "totals" : "game"} />;
}
