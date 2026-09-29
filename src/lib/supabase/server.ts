import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabasePublicKey, supabaseUrl } from "@/lib/env";

/** Client bound to the visitor's session cookies (auth + RLS as that user). */
export async function sessionClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl()!, supabasePublicKey()!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component: cookies are read-only there. proxy.ts refreshes sessions.
        }
      },
    },
  });
}

/** Anonymous client for public reads (no cookies, so it does not make pages per-user). */
export function publicClient(): SupabaseClient {
  return createClient(supabaseUrl()!, supabasePublicKey()!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
