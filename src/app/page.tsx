import { redirect } from "next/navigation";
import { currentSeasonSlug } from "@/lib/data";

// The current season can change in the database, so never bake the redirect in at build time.
export const dynamic = "force-dynamic";

export default async function Home() {
  const season = await currentSeasonSlug();
  if (!season) return <p className="p-8">No seasons yet. Sign in at /admin to add one.</p>;
  redirect(`/${season}/champions`);
}
