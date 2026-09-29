import { redirect } from "next/navigation";
import { currentSeasonSlug } from "@/lib/data";

export default async function Home() {
  const season = await currentSeasonSlug();
  if (!season) return <p className="p-8">No seasons yet. Sign in at /admin to add one.</p>;
  redirect(`/${season}/champions`);
}
