import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { processGame } from "@/lib/ballchasing/process";

export const maxDuration = 30;

/** Poll a game's replay; the client calls this every few seconds until status is not 'pending'. */
export async function POST(req: Request) {
  let db;
  try {
    ({ db } = await requireAdmin());
  } catch {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  const body = z.object({ gameId: z.string().uuid() }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "gameId required" }, { status: 400 });
  try {
    const result = await processGame(db, body.data.gameId);
    if (result.status === "ok") revalidatePath("/", "layout");
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ status: "failed", message: e instanceof Error ? e.message : "Processing failed" }, { status: 500 });
  }
}
