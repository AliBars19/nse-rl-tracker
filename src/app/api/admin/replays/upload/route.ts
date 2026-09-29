import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { BallchasingError, uploadReplay } from "@/lib/ballchasing/client";

export const maxDuration = 60;

const Meta = z.object({
  seriesId: z.string().uuid(),
  gameNumber: z.coerce.number().int().min(1).max(9),
  /** Colour City played as, or 'auto' to detect from roster names. */
  ourColour: z.enum(["auto", "blue", "orange"]),
});

/** One .replay per request (Vercel caps request bodies at ~4.5 MB; replays are ~1–2 MB). */
export async function POST(req: Request) {
  let db;
  try {
    ({ db } = await requireAdmin());
  } catch {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  const form = await req.formData();
  const file = form.get("file");
  const meta = Meta.safeParse({ seriesId: form.get("seriesId"), gameNumber: form.get("gameNumber"), ourColour: form.get("ourColour") });
  if (!(file instanceof File) || !meta.success) return NextResponse.json({ error: "Missing file or fields" }, { status: 400 });
  if (!file.name.toLowerCase().endsWith(".replay")) return NextResponse.json({ error: "Only .replay files" }, { status: 400 });

  const { data: series } = await db.from("series").select("id, home_team_id, teams:home_team_id(our_key)").eq("id", meta.data.seriesId).single();
  if (!series) return NextResponse.json({ error: "Series not found" }, { status: 404 });
  const homeIsOurs = !!(series.teams as unknown as { our_key: string | null } | null)?.our_key;

  try {
    const visibility = (process.env.BALLCHASING_VISIBILITY as "public" | "unlisted" | "private" | undefined) ?? "unlisted";
    const { id, duplicate } = await uploadReplay(file, file.name, visibility);
    const { ourColour } = meta.data;
    const homeColour = ourColour === "auto" ? null : homeIsOurs ? ourColour : ourColour === "blue" ? "orange" : "blue";

    // The same replay may already be attached somewhere; re-point it at this game.
    await db.from("games").delete().eq("ballchasing_id", id);
    const { data: game, error } = await db
      .from("games")
      .upsert(
        {
          series_id: meta.data.seriesId,
          game_number: meta.data.gameNumber,
          ballchasing_id: id,
          ballchasing_status: "pending",
          home_colour: homeColour,
          processed_at: null,
        },
        { onConflict: "series_id,game_number" },
      )
      .select("id")
      .single();
    if (error) throw error;
    return NextResponse.json({ gameId: game.id, ballchasingId: id, duplicate });
  } catch (e) {
    const status = e instanceof BallchasingError ? e.status : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload failed" }, { status: status >= 400 ? status : 500 });
  }
}
