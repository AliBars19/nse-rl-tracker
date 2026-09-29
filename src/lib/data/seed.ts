/**
 * Bundled seed data: the site runs on this when Supabase is not configured
 * (local development, previews, or before the database is set up).
 * Regenerate with `npm run seed:build`.
 */
import type { Dataset } from "@/lib/domain/types";
import spring26 from "@/data/seed/spring-26.json";

const SEEDS: Record<string, Dataset> = {
  "spring-26": spring26 as unknown as Dataset,
};

export function seedSeasons(): Dataset["seasons"] {
  return Object.values(SEEDS).map((d) => d.season);
}

export function loadSeed(seasonSlug: string): Dataset | null {
  return SEEDS[seasonSlug] ?? null;
}
