import "server-only";
import { cache } from "react";
import type { Dataset, Season } from "@/lib/domain/types";
import { supabaseConfigured } from "@/lib/env";
import { publicClient } from "@/lib/supabase/server";
import { loadSeed, seedSeasons } from "./seed";
import { listSeasonsFromDb, loadDatasetFromDb } from "./supabase";

/** Where the data comes from, shown in the footer so it is never a mystery. */
export function dataSource(): "supabase" | "seed" {
  return supabaseConfigured() ? "supabase" : "seed";
}

/** One load per request; every page derives what it needs from this. */
export const getDataset = cache(async (seasonSlug: string): Promise<Dataset | null> => {
  if (supabaseConfigured()) return loadDatasetFromDb(publicClient(), seasonSlug);
  return loadSeed(seasonSlug);
});

export const getSeasons = cache(async (): Promise<Season[]> => {
  if (supabaseConfigured()) return listSeasonsFromDb(publicClient());
  return seedSeasons();
});

export async function currentSeasonSlug(): Promise<string | null> {
  const seasons = await getSeasons();
  return (seasons.find((s) => s.isCurrent) ?? seasons.at(-1))?.slug ?? null;
}
