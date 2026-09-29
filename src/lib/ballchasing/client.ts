import "server-only";
import { ballchasingToken } from "@/lib/env";
import type { BcReplay } from "./map";

/** Overridable for local testing against a fake server. */
const API = process.env.BALLCHASING_API_URL || "https://ballchasing.com/api";

export class BallchasingError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

function token(): string {
  const t = ballchasingToken();
  if (!t) throw new BallchasingError("BALLCHASING_TOKEN is not set", 500);
  return t;
}

/** fetch with backoff on 429 (rate limits depend on the token's patron tier). */
async function call(url: string, init: RequestInit, attempts = 4): Promise<Response> {
  for (let i = 0; ; i++) {
    const res = await fetch(url, { ...init, headers: { Authorization: token(), ...(init.headers ?? {}) }, cache: "no-store" });
    if (res.status !== 429 || i >= attempts - 1) return res;
    const wait = Number(res.headers.get("retry-after")) * 1000 || 500 * 2 ** i;
    await new Promise((r) => setTimeout(r, wait));
  }
}

export async function ping(): Promise<boolean> {
  const res = await call(`${API}/`, { method: "GET" });
  return res.ok;
}

/** Upload a .replay. 201 = new, 409 = duplicate (both return the replay id). */
export async function uploadReplay(
  file: Blob,
  filename: string,
  visibility: "public" | "unlisted" | "private" = "unlisted",
): Promise<{ id: string; duplicate: boolean }> {
  const body = new FormData();
  body.append("file", file, filename);
  const res = await call(`${API}/v2/upload?visibility=${visibility}`, { method: "POST", body });
  const json = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
  if ((res.status === 201 || res.status === 409) && json.id) return { id: json.id, duplicate: res.status === 409 };
  throw new BallchasingError(json.error ?? `Upload failed (${res.status})`, res.status);
}

/** Replay details. status is 'pending' until ballchasing has parsed it. */
export async function getReplay(id: string): Promise<BcReplay & Record<string, unknown>> {
  const res = await call(`${API}/replays/${encodeURIComponent(id)}`, { method: "GET" });
  if (!res.ok) throw new BallchasingError(`Replay lookup failed (${res.status})`, res.status);
  return res.json();
}
