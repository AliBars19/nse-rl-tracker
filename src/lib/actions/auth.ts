"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseConfigured } from "@/lib/env";
import { sessionClient } from "@/lib/supabase/server";

const Credentials = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export async function signIn(_: unknown, form: FormData): Promise<{ error?: string }> {
  if (!supabaseConfigured()) return { error: "Supabase is not configured yet (see docs/setup.md)." };
  const parsed = Credentials.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const db = await sessionClient();
  const { error } = await db.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Email or password is wrong." };
  redirect("/admin");
}

export async function signOut(): Promise<void> {
  if (supabaseConfigured()) await (await sessionClient()).auth.signOut();
  redirect("/");
}
