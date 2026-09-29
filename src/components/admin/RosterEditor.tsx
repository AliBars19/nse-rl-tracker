"use client";

import { useState } from "react";
import { addRosterPlayer, removeRosterPlayer, savePlatformIds } from "@/lib/actions/admin";
import type { TeamKey } from "@/lib/domain/types";
import { useAction } from "./ActionForm";
import { Field, inputCls, PrimaryButton, SecondaryButton } from "./ui";

export interface RosterRow {
  playerId: string;
  nickname: string;
  role: string;
  platformIds: string;
}

function PlatformIds({ row }: { row: RosterRow }) {
  const [text, setText] = useState(row.platformIds);
  const a = useAction();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <label className="sr-only" htmlFor={`pid-${row.playerId}`}>Platform IDs for {row.nickname}</label>
        <input id={`pid-${row.playerId}`} className={inputCls} placeholder="steam:7656…, epic:abc123" value={text} onChange={(e) => setText(e.target.value)} />
        <SecondaryButton type="button" disabled={a.pending} onClick={() => a.run(() => savePlatformIds({ playerId: row.playerId, text }))}>Save</SecondaryButton>
      </div>
      {a.message}
    </div>
  );
}

export function RosterEditor({ teamKey, rows }: { teamKey: TeamKey; rows: RosterRow[] }) {
  const add = useAction();
  const remove = useAction();
  const [f, setF] = useState({ nickname: "", role: "player" as "leader" | "player" | "sub", url: "" });
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col border border-line">
        {rows.map((r) => (
          <li key={r.playerId} className="grid gap-3 border-b border-divider p-3 last:border-b-0 md:grid-cols-[180px_minmax(0,1fr)_auto] md:items-start">
            <span className="flex flex-col">
              <strong className="text-[15px]">{r.nickname}</strong>
              <span className="text-xs text-muted">{r.role}</span>
            </span>
            <PlatformIds row={r} />
            <SecondaryButton type="button" disabled={remove.pending} onClick={() => remove.run(() => removeRosterPlayer(teamKey, r.playerId))}>Remove</SecondaryButton>
          </li>
        ))}
      </ul>
      {remove.message}
      <form
        className="grid gap-3 md:grid-cols-[minmax(0,1fr)_140px_minmax(0,1fr)_auto] md:items-end"
        onSubmit={(e) => { e.preventDefault(); add.run(() => addRosterPlayer({ teamKey, nickname: f.nickname, role: f.role, nseProfileUrl: f.url || null })); }}
      >
        <Field label="Nickname" htmlFor={`${teamKey}-nick`}><input id={`${teamKey}-nick`} required className={inputCls} value={f.nickname} onChange={(e) => setF({ ...f, nickname: e.target.value })} /></Field>
        <Field label="Role" htmlFor={`${teamKey}-role`}>
          <select id={`${teamKey}-role`} className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as "player" })}>
            <option value="leader">Leader</option><option value="player">Player</option><option value="sub">Sub</option>
          </select>
        </Field>
        <Field label="NSE profile URL" htmlFor={`${teamKey}-url`}><input id={`${teamKey}-url`} type="url" className={inputCls} value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} /></Field>
        <PrimaryButton type="submit" pending={add.pending}>Add</PrimaryButton>
      </form>
      {add.message}
    </div>
  );
}
