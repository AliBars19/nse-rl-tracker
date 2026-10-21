"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { readReplayHeader } from "@/lib/replay/header";
import { UPLOAD_STATUS_TEXT, uploadReplayFile, type UploadStatus as Status } from "@/lib/replay/upload-client";
import { SecondaryButton } from "./ui";

interface Item {
  key: string;
  file: File;
  game: number;
  colour: "auto" | "blue" | "orange";
  status: Status;
  note: string;
}

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

  const add = async (files: FileList | File[]) => {
    const list = [...files].filter((f) => f.name.toLowerCase().endsWith(".replay"));
    // Number games by when each match started (read from the file), not by file dates, which
    // copying or zipping scrambles. Unreadable files fall back to their file date.
    const timed = await Promise.all(
      list.map(async (file) => ({ file, at: await readReplayHeader(file).then((h) => h.startedAt * 1000, () => file.lastModified) })),
    );
    const used = new Set([...taken, ...items.map((i) => i.game)]);
    const next: Item[] = [];
    for (const { file } of timed.sort((a, b) => a.at - b.at)) {
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
      await uploadReplayFile(
        { file: item.file, seriesId, gameNumber: item.game, colour: item.colour },
        (status, note) => update(item.key, { status, note }),
      );
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
        onDrop={(e) => { e.preventDefault(); setOver(false); void add(e.dataTransfer.files); }}
        className={`flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed px-4 py-8 text-center ${over ? "border-accent bg-highlight" : "border-line-strong bg-inset"}`}
      >
        <span className="font-display text-lg font-bold uppercase tracking-[0.06em]">Drop .replay files here</span>
        <span className="text-sm text-text-3">or click to choose. Files are numbered Game 1, 2, 3… in the order the matches were played (read from each file).</span>
        <input ref={input} type="file" accept=".replay" multiple hidden onChange={(e) => e.target.files && void add(e.target.files)} />
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
                {UPLOAD_STATUS_TEXT[i.status]}
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
