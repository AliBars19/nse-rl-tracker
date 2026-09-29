import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { MatchesView } from "@/components/matches/MatchesView";
import { getViewer } from "@/lib/auth";
import { buildMatches, defaultNightSlug, nightTabs } from "@/lib/view/matches";
import { loadTeamPage } from "@/lib/view/team";

export async function generateMetadata({ params }: PageProps<"/[season]/[team]/matches/[night]">): Promise<Metadata> {
  const { season, team, night } = await params;
  const p = await loadTeamPage(season, team);
  const label = night === "playoffs" ? "Playoffs" : night.replace("week-", "Week ").replace("stage-1", "Stage 1");
  return { title: `${label} · ${p.team.name}` };
}

export default async function NightPage({ params, searchParams }: PageProps<"/[season]/[team]/matches/[night]">) {
  const { season, team, night } = await params;
  const sp = await searchParams;
  const [p, viewer] = await Promise.all([loadTeamPage(season, team), getViewer()]);
  const tabs = nightTabs(p);
  if (!tabs.some((t) => t.slug === night)) {
    // e.g. switched team onto a night the other team did not play
    const fallback = defaultNightSlug(p);
    if (fallback && fallback !== night) redirect(`${p.base}/matches/${fallback}`);
    notFound();
  }
  const seriesId = typeof sp.series === "string" ? sp.series : null;
  const v = buildMatches(p, night, seriesId);
  if (!v) notFound();
  return <MatchesView p={p} v={v} tabs={tabs} current={night} isAdmin={viewer.isAdmin} />;
}
