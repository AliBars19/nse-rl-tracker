import "server-only";
import { getViewer } from "@/lib/auth";
import { sessionClient } from "@/lib/supabase/server";

/** Captain's notes are admin-only (RLS), so they are read with the viewer's session. */
export async function getNotes(teamId: string, opponentId: string) {
  const viewer = await getViewer();
  if (!viewer.isAdmin) return null;
  const db = await sessionClient();
  const { data } = await db
    .from("scouting_notes")
    .select("id, body, created_at")
    .eq("team_id", teamId)
    .eq("opponent_id", opponentId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((n) => ({ id: n.id as string, body: n.body as string, createdAt: n.created_at as string }));
}
