"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";

const NoteInput = z.object({
  teamId: z.string().uuid(),
  opponentId: z.string().uuid(),
  body: z.string().trim().min(1, "Write something first").max(4000),
  path: z.string().startsWith("/"),
});

export async function addNote(_: unknown, form: FormData): Promise<{ error?: string; ok?: boolean }> {
  const parsed = NoteInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid note" };
  const { db } = await requireAdmin();
  const { teamId, opponentId, body, path } = parsed.data;
  const { error } = await db.from("scouting_notes").insert({ team_id: teamId, opponent_id: opponentId, body });
  if (error) return { error: error.message };
  revalidatePath(path);
  return { ok: true };
}

export async function deleteNote(form: FormData): Promise<void> {
  const id = z.string().uuid().parse(form.get("id"));
  const path = z.string().startsWith("/").parse(form.get("path"));
  const { db } = await requireAdmin();
  await db.from("scouting_notes").delete().eq("id", id);
  revalidatePath(path);
}
