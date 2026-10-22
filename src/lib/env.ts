/**
 * Environment access. Supabase is optional: without it the site serves the bundled
 * seed data read-only, which is handy for local work and preview deployments.
 *
 * Supabase renamed the anon key to 'publishable'; both variable names work. No service-role
 * key is needed: admin writes run as the signed-in admin and RLS checks them.
 */
export function supabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || undefined;
}

export function supabasePublicKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || undefined;
}

export function supabaseConfigured(): boolean {
  return !!(supabaseUrl() && supabasePublicKey());
}

/** Server only. */
export function ballchasingToken(): string | undefined {
  return process.env.BALLCHASING_TOKEN || undefined;
}

export type Visibility = "public" | "unlisted" | "private";

/**
 * Turn what someone typed into Vercel into a value ballchasing accepts ('Public', ' public ' and '"public"'
 * all mean public). Anything unrecognised, including empty, is 'unlisted' instead of an "invalid visibility" error.
 */
export function parseVisibility(raw: string | undefined): Visibility {
  const v = (raw ?? "").trim().replace(/^["']+|["']+$/g, "").trim().toLowerCase();
  return v === "public" || v === "unlisted" || v === "private" ? v : "unlisted";
}

/** Server only: how replays are uploaded to ballchasing (BALLCHASING_VISIBILITY, default unlisted). */
export function ballchasingVisibility(): Visibility {
  return parseVisibility(process.env.BALLCHASING_VISIBILITY);
}

/** Optional extra gate: when set, only this email can use /admin even if listed in `admins`. */
export function adminEmail(): string | undefined {
  return process.env.ADMIN_EMAIL?.trim().toLowerCase() || undefined;
}
