/**
 * Browser side of a replay upload: send one file to our server (which forwards it to
 * ballchasing), then poll until ballchasing has parsed it and the stats are saved.
 * Shared by the manual uploader and the auto-sort page.
 */

export type UploadStatus = "queued" | "uploading" | "processing" | "done" | "duplicate" | "failed";

export const UPLOAD_STATUS_TEXT: Record<UploadStatus, string> = {
  queued: "Queued",
  uploading: "Uploading…",
  processing: "Processing on ballchasing…",
  done: "Done",
  duplicate: "Duplicate (already on ballchasing)",
  failed: "Failed",
};

export interface UploadRequest {
  file: File;
  seriesId: string;
  gameNumber: number;
  /** The colour City played as, or 'auto' to detect it from roster names. */
  colour: "auto" | "blue" | "orange";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Files go one at a time (sequential keeps us inside ballchasing's rate limits). */
export async function uploadReplayFile(req: UploadRequest, onStatus: (status: UploadStatus, note: string) => void): Promise<UploadStatus> {
  onStatus("uploading", "");
  const body = new FormData();
  body.append("file", req.file);
  body.append("seriesId", req.seriesId);
  body.append("gameNumber", String(req.gameNumber));
  body.append("ourColour", req.colour);
  const res = await fetch("/api/admin/replays/upload", { method: "POST", body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    onStatus("failed", json.error ?? `Upload failed (${res.status})`);
    return "failed";
  }
  onStatus("processing", json.duplicate ? "Already on ballchasing" : "");
  let final: UploadStatus = "failed";
  let note = "Timed out waiting for ballchasing. Reload later: it will finish.";
  for (let attempt = 0; attempt < 40; attempt++) {
    await sleep(attempt < 5 ? 2000 : 4000);
    const p = await fetch("/api/admin/replays/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId: json.gameId }),
    });
    const r = await p.json().catch(() => ({ status: "failed", message: "Bad response" }));
    if (r.status === "pending") continue;
    final = r.status === "ok" ? (json.duplicate ? "duplicate" : "done") : "failed";
    note = [r.message, r.unmatched?.length ? `Link: ${r.unmatched.join(", ")}` : ""].filter(Boolean).join(" · ");
    break;
  }
  onStatus(final, note);
  return final;
}
