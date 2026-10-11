"use client";

import { useState } from "react";
import { deleteScrim, saveScrim } from "@/lib/actions/admin";
import type { TeamKey } from "@/lib/domain/types";
import { useAction } from "./ActionForm";
import { Field, inputCls, PrimaryButton, SecondaryButton } from "./ui";

const NEW = "__new";

export interface ScrimInitial {
  id: string;
  date: string; // YYYY-MM-DD (London)
  time: string; // HH:MM (London)
  opponentId: string;
  our: number | null;
  opp: number | null;
}

/** Add a scrim (no `initial`) or edit one. Scores are optional: replays fill them in. */
export function ScrimForm({
  teamKey,
  opponents,
  initial,
  today,
}: {
  teamKey: TeamKey;
  opponents: Array<{ id: string; name: string }>;
  initial?: ScrimInitial;
  today: string;
}) {
  const blank = { date: today, time: "19:00", opponentId: "", newOpponent: "", our: "", opp: "" };
  const [f, setF] = useState(
    initial
      ? { ...blank, ...initial, our: initial.our?.toString() ?? "", opp: initial.opp?.toString() ?? "" }
      : blank,
  );
  const a = useAction();
  const id = (s: string) => `${teamKey}-${initial?.id ?? "new"}-${s}`;
  const num = (s: string) => (s.trim() === "" ? null : Number(s));

  const submit = () =>
    a.run(async () => {
      const res = await saveScrim({
        id: initial?.id ?? null,
        teamKey,
        date: f.date,
        time: f.time || null,
        opponentId: f.opponentId && f.opponentId !== NEW ? f.opponentId : null,
        newOpponent: f.opponentId === NEW ? f.newOpponent.trim() || null : null,
        our: num(f.our),
        opp: num(f.opp),
      });
      if (res.ok && !initial) setF(blank);
      return res;
    });

  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div className="grid gap-4 md:grid-cols-[1fr_1fr_2fr_auto]">
        <Field label="Date" htmlFor={id("d")}>
          <input id={id("d")} type="date" required className={inputCls} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </Field>
        <Field label="Time (UK)" htmlFor={id("t")}>
          <input id={id("t")} type="time" className={inputCls} value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />
        </Field>
        <Field label="Opponent" htmlFor={id("o")}>
          <select id={id("o")} required className={inputCls} value={f.opponentId} onChange={(e) => setF({ ...f, opponentId: e.target.value })}>
            <option value="" disabled>Choose a team…</option>
            <option value={NEW}>New team…</option>
            {opponents.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </Field>
        <Field label="Score (games)" htmlFor={id("s")} hint="Optional">
          <span className="flex items-center gap-2">
            <input id={id("s")} aria-label="Our games" type="number" min={0} max={15} className={`${inputCls} w-16`} value={f.our} onChange={(e) => setF({ ...f, our: e.target.value })} />
            <span className="text-muted">–</span>
            <input aria-label="Their games" type="number" min={0} max={15} className={`${inputCls} w-16`} value={f.opp} onChange={(e) => setF({ ...f, opp: e.target.value })} />
          </span>
        </Field>
      </div>
      {f.opponentId === NEW && (
        <Field label="New team name" htmlFor={id("n")} hint="Full name as on NSE, e.g. 'Royal Bears Rocket league'">
          <input id={id("n")} required maxLength={80} className={inputCls} value={f.newOpponent} onChange={(e) => setF({ ...f, newOpponent: e.target.value })} />
        </Field>
      )}
      <div className="flex flex-wrap gap-3">
        <PrimaryButton type="submit" pending={a.pending}>{initial ? "Save scrim" : "Add scrim"}</PrimaryButton>
        {initial && (
          <SecondaryButton
            type="button"
            disabled={a.pending}
            onClick={() => {
              if (confirm("Delete this scrim and the stats from its replays?")) a.run(() => deleteScrim(initial.id));
            }}
          >
            Delete
          </SecondaryButton>
        )}
      </div>
      {a.message}
    </form>
  );
}
