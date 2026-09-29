"use client";

import { useState } from "react";
import { linkReplayName } from "@/lib/actions/admin";
import { useAction } from "./ActionForm";
import { SecondaryButton } from "./ui";

export interface UnlinkedName {
  displayName: string;
  gameIds: string[];
  platform: string | null;
}

/** Replay names on City's side that are not linked to a roster player yet. */
export function LinkNames({ names, roster }: { names: UnlinkedName[]; roster: Array<{ id: string; nickname: string }> }) {
  const a = useAction();
  const [choice, setChoice] = useState<Record<string, string>>({});
  if (!names.length) return <p className="m-0 text-sm text-text-3">Every City player in these replays is linked.</p>;
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col border border-line">
        {names.map((n) => (
          <li key={n.displayName} className="flex flex-wrap items-center gap-3 border-b border-divider p-3 last:border-b-0">
            <span className="min-w-40 grow text-sm">
              <strong>{n.displayName}</strong>
              <span className="block text-xs text-muted">{n.gameIds.length} game{n.gameIds.length === 1 ? "" : "s"}{n.platform ? ` · ${n.platform}` : ""}</span>
            </span>
            <label className="sr-only" htmlFor={`link-${n.displayName}`}>Roster player for {n.displayName}</label>
            <select
              id={`link-${n.displayName}`}
              className="h-11 border border-line-strong bg-inset px-2 text-sm"
              value={choice[n.displayName] ?? ""}
              onChange={(e) => setChoice({ ...choice, [n.displayName]: e.target.value })}
            >
              <option value="">Choose player…</option>
              {roster.map((p) => <option key={p.id} value={p.id}>{p.nickname}</option>)}
            </select>
            <SecondaryButton
              type="button"
              disabled={!choice[n.displayName] || a.pending}
              onClick={() => a.run(() => linkReplayName({ gameIds: n.gameIds, displayName: n.displayName, playerId: choice[n.displayName], remember: true }))}
            >
              Link
            </SecondaryButton>
          </li>
        ))}
      </ul>
      {a.message}
      <p className="m-0 text-xs text-muted">Linking also saves the player&apos;s platform ID, so their next replays match automatically.</p>
    </div>
  );
}
