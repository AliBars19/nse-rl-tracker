import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/auth";
import type { Dataset, TeamKey } from "@/lib/domain/types";
import { ourTeam } from "@/lib/engine/context";
import { slugify } from "@/lib/import/names";
import { listSeasonsFromDb, loadDatasetFromDb } from "./supabase";

/** Fresh (uncached) dataset for the admin, read with the admin's session. */
export async function adminDataset(seasonSlug?: string): Promise<{ db: SupabaseClient; ds: Dataset | null; seasons: Dataset["seasons"] }> {
  const { db } = await requireAdmin();
  const seasons = await listSeasonsFromDb(db);
  const slug = seasonSlug ?? (seasons.find((s) => s.isCurrent) ?? seasons.at(-1))?.slug;
  const ds = slug ? await loadDatasetFromDb(db, slug) : null;
  return { db, ds, seasons };
}

export function ourTeamOrThrow(ds: Dataset, key: TeamKey) {
  const o = ourTeam(ds, key);
  if (!o) throw new Error(`${key} is not set up for ${ds.season.name}`);
  return o;
}

/** A slug not used by any existing team/player. */
export async function uniqueSlug(db: SupabaseClient, table: "teams" | "players", name: string): Promise<string> {
  const base = slugify(name);
  const { data } = await db.from(table).select("slug").like("slug", `${base}%`);
  const taken = new Set((data ?? []).map((r) => r.slug as string));
  let slug = base;
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;
  return slug;
}
