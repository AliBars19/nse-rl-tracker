"use client";

import { useState } from "react";
import { clearUpcoming, saveUpcoming } from "@/lib/actions/admin";
import type { TeamKey } from "@/lib/domain/types";
import { useAction } from "./ActionForm";
import { Field, inputCls, PrimaryButton, SecondaryButton } from "./ui";

export function UpcomingForm({
  teamKey,
  initial,
  opponents,
}: {
  teamKey: TeamKey;
  initial: { week: number; date: string | null; r1OpponentId: string | null; saved: boolean };
  opponents: Array<{ id: string; name: string }>;
}) {
  const [f, setF] = useState(initial);
  const a = useAction();
  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); a.run(() => saveUpcoming({ teamKey, week: f.week, date: f.date || null, r1OpponentId: f.r1OpponentId })); }}>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Week" htmlFor={`${teamKey}-uw`}><input id={`${teamKey}-uw`} type="number" min={1} max={20} className={inputCls} value={f.week} onChange={(e) => setF({ ...f, week: Number(e.target.value) })} /></Field>
        <Field label="Date" htmlFor={`${teamKey}-ud`}><input id={`${teamKey}-ud`} type="date" className={inputCls} value={f.date ?? ""} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Round 1 opponent" htmlFor={`${teamKey}-uo`} hint="From the NSE draw. Leave as TBC if unknown.">
          <select id={`${teamKey}-uo`} className={inputCls} value={f.r1OpponentId ?? ""} onChange={(e) => setF({ ...f, r1OpponentId: e.target.value || null })}>
            <option value="">TBC</option>
            {opponents.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </Field>
      </div>
      <div className="flex flex-wrap gap-3">
        <PrimaryButton type="submit" pending={a.pending}>Save preview</PrimaryButton>
        {initial.saved && <SecondaryButton type="button" onClick={() => a.run(() => clearUpcoming(teamKey))}>Clear</SecondaryButton>}
      </div>
      {a.message}
    </form>
  );
}
