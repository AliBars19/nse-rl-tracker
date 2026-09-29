import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { adminEmail, supabaseConfigured } from "@/lib/env";
import { sessionClient } from "@/lib/supabase/server";

export interface Viewer {
  signedIn: boolean;
  email: string | null;
  isAdmin: boolean;
}

const ANON: Viewer = { signedIn: false, email: null, isAdmin: false };

/**
 * Who is looking at the page. Admin = signed in AND listed in the `admins` table
 * (and matching ADMIN_EMAIL when that is set). RLS enforces the same rule on writes.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  if (!supabaseConfigured()) return ANON;
  const db = await sessionClient();
  const { data } = await db.auth.getUser();
  const user = data.user;
  if (!user) return ANON;
  const email = user.email?.toLowerCase() ?? null;
  const { data: row } = await db.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  const gate = adminEmail();
  return { signedIn: true, email, isAdmin: !!row && (!gate || gate === email) };
});

/**
 * For admin pages, server actions and route handlers. Non-admins are sent to the sign-in
 * page (route handlers catch this and answer 401).
 */
export async function requireAdmin() {
  const viewer = await getViewer();
  if (!viewer.isAdmin) redirect("/admin/login");
  return { viewer, db: await sessionClient() };
}
