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

/** Optional extra gate: when set, only this email can use /admin even if listed in `admins`. */
export function adminEmail(): string | undefined {
  return process.env.ADMIN_EMAIL?.trim().toLowerCase() || undefined;
}
