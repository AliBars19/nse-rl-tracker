"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { syncNseForDates } from "@/lib/actions/admin";
import { readReplayHeader, type ReplayHeader } from "@/lib/replay/header";
import { sortForTeams, sortReplays, ukDateOf, type Colour, type SortTeam } from "@/lib/replay/sort";
import { UPLOAD_STATUS_TEXT, uploadReplayFile, type UploadStatus } from "@/lib/replay/upload-client";
import type { SorterTeam } from "@/lib/view/sorter";
import { Notice, SecondaryButton } from "./ui";

interface Row {
  key: string;
  file: File;
  header: ReplayHeader | null;
  error: string;
  seriesId: string;
  game: number;
  colour: Colour | "auto";
  /** Placed from the lobby round alone (no series score fitted): check it. */
  guess: boolean;
  status: UploadStatus;
  note: string;
}

const selectCls = "h-11 w-full border border-line-strong bg-inset px-2 text-sm disabled:opacity-60";
const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const prettyMap = (m: string) => m.replace(/_P$/, "").replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");

/**
 * Drop every replay from a night in one go. Each file's header (time, score, players) is read
 * in the browser, the files are sorted onto the matching NSE series and game numbers, and the
 * result is shown for review. Nothing is sent until you press Upload.
 */
export function ReplaySorter({ teams }: { teams: SorterTeam[] }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [teamList, setTeamList] = useState(teams);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<{ ok: boolean; text: string } | null>(null);
  const asked = useRef(new Set<string>()); // days we already asked NSE about
  const [forced, setForced] = useState<string>("");
  const [detected, setDetected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const teamKey = forced || detected || "";
  const team = teamList.find((t) => t.key === teamKey) ?? null;

  /** Sort every row that has not been uploaded yet. */
  const resort = (all: Row[], forceKey: string, list: SorterTeam[]): { rows: Row[]; detected: string | null } => {
    const todo = all.filter((r) => r.header && r.status === "queued");
    const replays = todo.map((r) => ({ id: r.key, startedAt: r.header!.startedAt, team0Score: r.header!.team0Score, team1Score: r.header!.team1Score, replayName: r.header!.replayName, players: r.header!.players }));
    const sortTeams: SortTeam[] = list.map((t) => ({ key: t.key, rosterNames: t.rosterNames, series: t.series }));
    const auto = sortForTeams(replays, sortTeams);
    const key = forceKey || auto.teamKey;
    const chosen = key ? sortReplays(replays, sortTeams.find((t) => t.key === key)!) : null;
    const place = new Map(chosen?.placements.map((p) => [p.replayId, p]));
    return {
      detected: auto.teamKey,
      rows: all.map((r) => {
        const p = place.get(r.key);
        if (!p) return r;
        return { ...r, seriesId: p.seriesId ?? "", game: p.gameNumber ?? 1, colour: p.colour ?? "auto", guess: !!p.guess };
      }),
    };
  };

  const add = async (files: FileList | File[]) => {
    const list = [...files].filter((f) => f.name.toLowerCase().endsWith(".replay"));
    if (!list.length) return;
    const fresh: Row[] = await Promise.all(
      list.map(async (file) => {
        const base = { key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`, file, seriesId: "", game: 1, colour: "auto" as const, guess: false, status: "queued" as const, note: "" };
        try {
          return { ...base, header: await readReplayHeader(file), error: "" };
        } catch (e) {
          return { ...base, header: null, error: e instanceof Error ? e.message : "Could not read this file" };
        }
      }),
    );
    const all = [...rows, ...fresh];
    // Replays from a night we have no results for yet: fetch them from NSE ourselves.
    let known = teamList;
    const missing = daysOf(all).filter((d) => !asked.current.has(d) && !known.some((t) => t.series.some((x) => x.date === d)));
    if (missing.length) known = await sync(missing, known);
    const next = resort(all, forced, known);
    setDetected(next.detected);
    setRows(next.rows);
  };

  /** Calendar days (UK) the readable replays were played on. */
  const daysOf = (all: Row[]) => [...new Set(all.flatMap((r) => (r.header ? [ukDateOf(new Date(r.header.startedAt * 1000).toISOString())] : [])))];

  /** Import the NSE results for these days, then return the refreshed series. */
  const sync = async (days: string[], current: SorterTeam[]): Promise<SorterTeam[]> => {
    days.forEach((d) => asked.current.add(d));
    setSyncing(true);
    setSyncNote({ ok: true, text: "Fetching results from NSE…" });
    try {
      const r = await syncNseForDates({ dates: days });
      if (!r.ok) {
        setSyncNote({ ok: false, text: r.error });
        return current;
      }
      setSyncNote({ ok: true, text: r.message });
      setTeamList(r.data ?? current);
      return r.data ?? current;
    } catch (e) {
      setSyncNote({ ok: false, text: e instanceof Error ? e.message : "Could not reach NSE" });
      return current;
    } finally {
      setSyncing(false);
    }
  };

  const refetch = async () => {
    const list = await sync(daysOf(rows), teamList);
    const next = resort(rows, forced, list);
    setDetected(next.detected);
    setRows(next.rows);
  };

  const chooseTeam = (key: string) => {
    setForced(key);
    const next = resort(rows, key, teamList);
    setDetected(next.detected);
    setRows(next.rows);
  };

  const update = (key: string, patch: Partial<Row>) => setRows((cur) => cur.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const seriesOf = (id: string) => team?.series.find((s) => s.id === id);

  const ordered = [...rows].sort((a, b) => (a.header?.startedAt ?? 0) - (b.header?.startedAt ?? 0));
  const ready = ordered.filter((r) => r.header && r.seriesId && (r.status === "queued" || r.status === "failed"));
  // Two files aimed at the same series + game: only the last one would survive.
  const slotCount = new Map<string, number>();
  for (const r of ready) slotCount.set(`${r.seriesId}#${r.game}`, (slotCount.get(`${r.seriesId}#${r.game}`) ?? 0) + 1);
  const clashes = [...slotCount.values()].filter((n) => n > 1).length;
  const unplaced = ordered.filter((r) => r.header && !r.seriesId && r.status === "queued").length;
  const unreadable = ordered.filter((r) => !r.header).length;
  const guesses = ready.filter((r) => r.guess).length;
  const seriesUsed = new Set(ready.map((r) => r.seriesId)).size;

  const start = async () => {
    setBusy(true);
    for (const r of ready) {
      await uploadReplayFile({ file: r.file, seriesId: r.seriesId, gameNumber: r.game, colour: r.colour }, (status, note) => update(r.key, { status, note }));
    }
    setBusy(false);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        role="button"
        tabIndex={0}
        aria-label="Add replay files to sort"
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void add(e.dataTransfer.files); }}
        className={`flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed px-4 py-8 text-center ${over ? "border-accent bg-highlight" : "border-line-strong bg-inset"}`}
      >
        <span className="font-display text-lg font-bold uppercase tracking-[0.06em]">Drop all the night&apos;s .replay files here</span>
        <span className="text-sm text-text-3">Any file names, any order, both teams. Each file is read to work out which series and game it is. Nothing is uploaded until you press Upload.</span>
        <input ref={input} type="file" accept=".replay" multiple hidden onChange={(e) => { if (e.target.files) void add(e.target.files); e.target.value = ""; }} />
      </div>

      {rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-56 flex-col gap-1 text-sm">
              <span className="text-muted">Whose replays are these?</span>
              <select className={selectCls} value={teamKey} disabled={busy || syncing} onChange={(e) => chooseTeam(e.target.value)}>
                {!teamKey && <option value="">Choose a team…</option>}
                {teams.map((t) => <option key={t.key} value={t.key}>{t.name}{!forced && t.key === detected ? " (detected)" : ""}</option>)}
              </select>
            </label>
            <SecondaryButton type="button" disabled={busy || syncing} onClick={refetch}>
              {syncing ? "Fetching…" : "Fetch results from NSE"}
            </SecondaryButton>
          </div>
          {syncNote && <Notice tone={syncNote.ok ? "info" : "error"}>{syncNote.text}</Notice>}

          {!team && <Notice tone="error">Could not tell which team these replays belong to (the scores fit neither team&apos;s series, or both equally). Choose the team above and they will be sorted.</Notice>}
          {team && (
            <Notice tone={unplaced || clashes || unreadable || guesses ? "info" : "ok"}>
              {ready.length} of {ordered.length} replays placed on {seriesUsed} series for {team.name}.
              {guesses > 0 && ` ${guesses} ${guesses === 1 ? "was" : "were"} placed from the lobby name only (not all of that series' games are here): check the game number${guesses === 1 ? "" : "s"}.`}
              {unplaced > 0 && ` ${unplaced} did not fit any series: pick one below or leave them out.`}
              {clashes > 0 && ` ${clashes} game slot${clashes === 1 ? " is" : "s are"} used twice: fix them before uploading.`}
              {unreadable > 0 && ` ${unreadable} file${unreadable === 1 ? " is" : "s are"} not readable replays.`}
            </Notice>
          )}

          <ul className="flex flex-col border border-line">
            {ordered.map((r) => {
              const s = seriesOf(r.seriesId);
              const slot = `${r.seriesId}#${r.game}`;
              const clash = !!r.seriesId && (slotCount.get(slot) ?? 0) > 1 && (r.status === "queued" || r.status === "failed");
              const replaces = !!s && s.taken.includes(r.game) && r.status === "queued";
              const h = r.header;
              const us = h && r.colour !== "auto" ? (r.colour === "blue" ? h.team0Score : h.team1Score) : null;
              const them = h && r.colour !== "auto" ? (r.colour === "blue" ? h.team1Score : h.team0Score) : null;
              const locked = busy || syncing || (r.status !== "queued" && r.status !== "failed");
              return (
                <li key={r.key} className="grid gap-3 border-b border-divider p-3 last:border-b-0 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_90px_110px_minmax(0,1fr)] md:items-center">
                  <span className="min-w-0 text-sm">
                    {h ? (
                      <>
                        <span className="block font-medium">{time.format(new Date(h.startedAt * 1000))}</span>
                        <span className="block truncate text-xs text-muted" title={r.file.name}>
                          {prettyMap(h.mapName)} ·{" "}
                          {us === null || them === null ? (
                            `Blue ${h.team0Score}–${h.team1Score} Orange`
                          ) : (
                            <>
                              {us}–{them} <strong className={us > them ? "text-win" : "text-loss"}>{us > them ? "W" : us < them ? "L" : "D"}</strong>
                            </>
                          )}
                          {h.replayName && ` · ${h.replayName}`}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="block truncate" title={r.file.name}>{r.file.name}</span>
                        <span className="block text-xs text-loss">{r.error}</span>
                      </>
                    )}
                  </span>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="sr-only">Series for {r.file.name}</span>
                    <select className={selectCls} value={r.seriesId} disabled={locked || !h || !team} onChange={(e) => update(r.key, { seriesId: e.target.value, guess: false })}>
                      <option value="">{h ? "Leave out" : "—"}</option>
                      {team?.series.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <span className="text-muted">Game</span>
                    <select className={selectCls} value={r.game} disabled={locked || !r.seriesId} onChange={(e) => update(r.key, { game: Number(e.target.value), guess: false })}>
                      {Array.from({ length: Math.max(9, (s?.ours ?? 0) + (s?.theirs ?? 0)) }, (_, n) => n + 1).map((n) => <option key={n}>{n}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <span className="sr-only">City colour for {r.file.name}</span>
                    <select className={selectCls} value={r.colour} disabled={locked || !r.seriesId} onChange={(e) => update(r.key, { colour: e.target.value as Row["colour"] })}>
                      <option value="auto">Colour: auto</option>
                      <option value="blue">City blue</option>
                      <option value="orange">City orange</option>
                    </select>
                  </label>
                  <span className={`text-sm ${r.status === "failed" ? "text-loss" : r.status === "done" || r.status === "duplicate" ? "text-win" : "text-text-3"}`} aria-live="polite">
                    {r.status === "queued" ? (r.seriesId ? (r.guess ? "Ready (guess)" : "Ready") : h ? "Left out" : "") : UPLOAD_STATUS_TEXT[r.status]}
                    {r.guess && r.status === "queued" && <span className="block text-xs text-muted">From the lobby name only: check the game number</span>}
                    {clash && <span className="block text-xs text-loss">Same game slot as another file</span>}
                    {replaces && !clash && <span className="block text-xs text-muted">Replaces the existing Game {r.game} replay</span>}
                    {r.note && <span className="block text-xs text-muted">{r.note}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy || syncing || ready.length === 0 || clashes > 0}
          onClick={start}
          className="clip-para h-11 cursor-pointer bg-accent px-6 font-display text-sm font-bold tracking-[0.1em] text-on-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "WORKING…" : ready.length ? `UPLOAD ${ready.length} REPLAY${ready.length === 1 ? "" : "S"}` : "UPLOAD"}
        </button>
        {rows.length > 0 && !busy && (
          <SecondaryButton type="button" onClick={() => { setRows([]); setForced(""); setDetected(null); }}>
            Clear
          </SecondaryButton>
        )}
      </div>
    </div>
  );
}
