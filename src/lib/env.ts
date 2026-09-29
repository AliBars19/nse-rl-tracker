/**
 * Environment access. Supabase is optional: without it the site serves the bundled
 * seed data read-only, which is handy for local work and preview deployments.
 *
 * Supabase renamed its keys (anon -> publishable, service_role -> secret); both names work.
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

/** Server only. Used by scripts, never by request handlers. */
export function supabaseSecretKey(): string | undefined {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || undefined;
}

/** Server only. */
export function ballchasingToken(): string | undefined {
  return process.env.BALLCHASING_TOKEN || undefined;
}

/** Optional extra gate: when set, only this email can use /admin even if listed in `admins`. */
export function adminEmail(): string | undefined {
  return process.env.ADMIN_EMAIL?.trim().toLowerCase() || undefined;
}
