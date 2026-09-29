"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { SecondaryButton } from "./ui";

type Status = "queued" | "uploading" | "processing" | "done" | "duplicate" | "failed";

interface Item {
  key: string;
  file: File;
  game: number;
  colour: "auto" | "blue" | "orange";
  status: Status;
  note: string;
}

const STATUS_TEXT: Record<Status, string> = {
  queued: "Queued",
  uploading: "Uploading…",
  processing: "Processing on ballchasing…",
  done: "Done",
  duplicate: "Duplicate (already on ballchasing)",
  failed: "Failed",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Drag-and-drop .replay files onto a series. Files go one at a time (sequential keeps
 * us inside ballchasing's rate limits), then each game is polled until parsed.
 */
export function ReplayUploader({ seriesId, gamesPlayed, taken }: { seriesId: string; gamesPlayed: number; taken: number[] }) {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const add = (files: FileList | File[]) => {
    const list = [...files].filter((f) => f.name.toLowerCase().endsWith(".replay"));
    const used = new Set([...taken, ...items.map((i) => i.game)]);
    const next: Item[] = [];
    for (const file of list.sort((a, b) => a.lastModified - b.lastModified)) {
      let g = 1;
      while (used.has(g) && g < gamesPlayed) g++;
      used.add(g);
      next.push({ key: `${file.name}-${file.size}-${Math.random()}`, file, game: g, colour: "auto", status: "queued", note: "" });
    }
    setItems((cur) => [...cur, ...next]);
  };

  const update = (key: string, patch: Partial<Item>) => setItems((cur) => cur.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const start = async () => {
    setBusy(true);
    for (const item of items.filter((i) => i.status === "queued" || i.status === "failed")) {
      update(item.key, { status: "uploading", note: "" });
      const body = new FormData();
      body.append("file", item.file);
      body.append("seriesId", seriesId);
      body.append("gameNumber", String(item.game));
      body.append("ourColour", item.colour);
      const res = await fetch("/api/admin/replays/upload", { method: "POST", body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        update(item.key, { status: "failed", note: json.error ?? `Upload failed (${res.status})` });
        continue;
      }
      update(item.key, { status: "processing", note: json.duplicate ? "Already on ballchasing" : "" });
      let final: Status = "failed";
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
      update(item.key, { status: final, note });
    }
    setBusy(false);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        role="button"
        tabIndex={0}
        aria-label="Add replay files"
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
        className={`flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed px-4 py-8 text-center ${over ? "border-accent bg-highlight" : "border-line-strong bg-inset"}`}
      >
        <span className="font-display text-lg font-bold uppercase tracking-[0.06em]">Drop .replay files here</span>
        <span className="text-sm text-text-3">or click to choose. Files are numbered Game 1, 2, 3… in the order they were saved.</span>
        <input ref={input} type="file" accept=".replay" multiple hidden onChange={(e) => e.target.files && add(e.target.files)} />
      </div>

      {items.length > 0 && (
        <ul className="flex flex-col border border-line">
          {items.map((i) => (
            <li key={i.key} className="grid gap-3 border-b border-divider p-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_110px_140px_minmax(0,1.2fr)] md:items-center">
              <span className="truncate text-sm" title={i.file.name}>{i.file.name}</span>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted">Game</span>
                <select className="h-11 border border-line-strong bg-inset px-2" value={i.game} disabled={busy || i.status !== "queued"} onChange={(e) => update(i.key, { game: Number(e.target.value) })}>
                  {Array.from({ length: Math.max(gamesPlayed, 1) }, (_, n) => n + 1).map((n) => <option key={n}>{n}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted">City</span>
                <select className="h-11 border border-line-strong bg-inset px-2" value={i.colour} disabled={busy || i.status !== "queued"} onChange={(e) => update(i.key, { colour: e.target.value as Item["colour"] })}>
                  <option value="auto">Auto</option>
                  <option value="blue">Blue</option>
                  <option value="orange">Orange</option>
                </select>
              </label>
              <span className={`text-sm ${i.status === "failed" ? "text-loss" : i.status === "done" || i.status === "duplicate" ? "text-win" : "text-text-3"}`} aria-live="polite">
                {STATUS_TEXT[i.status]}
                {i.note && <span className="block text-xs text-muted">{i.note}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy || !items.some((i) => i.status === "queued" || i.status === "failed")}
          onClick={start}
          className="clip-para h-11 cursor-pointer bg-accent px-6 font-display text-sm font-bold tracking-[0.1em] text-on-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "WORKING…" : "UPLOAD"}
        </button>
        {items.length > 0 && !busy && (
          <SecondaryButton type="button" onClick={() => setItems(items.filter((i) => i.status === "queued" || i.status === "failed"))}>
            Clear finished
          </SecondaryButton>
        )}
      </div>
    </div>
  );
}
