import { redirect } from "next/navigation";
import { Main, Placeholder } from "@/components/ui";
import { defaultNightSlug } from "@/lib/view/matches";
import { loadTeamPage } from "@/lib/view/team";

export default async function MatchesIndex({ params }: PageProps<"/[season]/[team]/matches">) {
  const { season, team } = await params;
  const p = await loadTeamPage(season, team);
  const slug = defaultNightSlug(p);
  if (slug) redirect(`${p.base}/matches/${slug}`);
  return (
    <Main>
      <Placeholder>No match nights yet this season.</Placeholder>
    </Main>
  );
}
