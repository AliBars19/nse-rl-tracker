"use client";

import { useMemo, useState } from "react";
import { resText } from "@/components/ui";
import { saveNight, type NightInput } from "@/lib/actions/admin";
import type { TeamKey } from "@/lib/domain/types";
import { nightPoints, roundLabel, type RoundResult } from "@/lib/engine/points";
import type { Ladder } from "@/lib/engine/rulesets";
import { useAction } from "./ActionForm";
import { Field, inputCls, PrimaryButton } from "./ui";

export interface NightFormTeam {
  key: TeamKey;
  name: string;
  tierName: string;
  ladder: Ladder | null;
  roundStyle: "bracket" | "swiss";
  /** Existing nights: week -> { date, rounds } for prefill */
  nights: Record<number, { date: string; rounds: RoundDraft[] }>;
}

export interface RoundDraft {
  round: number;
  opponentId: string | null;
  newOpponent: string | null;
  bye: boolean;
  our: number | null;
  opp: number | null;
  forfeit: boolean;
  nseMatchId: number | null;
}

const blank = (round: number): RoundDraft => ({ round, opponentId: null, newOpponent: null, bye: false, our: null, opp: null, forfeit: false, nseMatchId: null });

function resultOf(r: RoundDraft): RoundResult | null {
  if (r.bye) return "BYE";
  if (r.our === null || r.opp === null || r.our === r.opp) return null;
  return r.our > r.opp ? "W" : "L";
}

export function NightForm({ teams, opponents, initialTeam }: { teams: NightFormTeam[]; opponents: Array<{ id: string; name: string }>; initialTeam: TeamKey }) {
  const [teamKey, setTeamKey] = useState<TeamKey>(initialTeam);
  const team = teams.find((t) => t.key === teamKey)!;
  const weeks = Object.keys(team.nights).map(Number);
  const nextWeek = weeks.length ? Math.max(...weeks) + 1 : 3;
  const [week, setWeek] = useState<number>(nextWeek);
  const existing = team.nights[week];
  const [date, setDate] = useState<string>(existing?.date ?? "");
  const [rounds, setRounds] = useState<RoundDraft[]>(existing?.rounds.length ? existing.rounds : [1, 2, 3].map(blank));
  const a = useAction();

  const load = (key: TeamKey, w: number) => {
    const t = teams.find((x) => x.key === key)!;
    const ex = t.nights[w];
    setDate(ex?.date ?? "");
    setRounds(ex?.rounds.length ? ex.rounds : [1, 2, 3].map(blank));
    a.reset();
  };

  const results = rounds.map(resultOf);
  const preview = useMemo(() => {
    const [r1, r2, r3] = results;
    if (!team.ladder || !r1 || !r2 || !r3) return null;
    return nightPoints(r1, r2, r3, team.ladder);
  }, [results, team.ladder]);

  const set = (i: number, patch: Partial<RoundDraft>) => setRounds(rounds.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  let w = 0;
  let l = 0;
  const labels = rounds.map((r, i) => {
    const label = roundLabel(r.round, { w, l }, team.roundStyle);
    const res = results[i];
    if (res === "L") l++;
    else if (res) w++;
    return label;
  });

  const submit = () => {
    const input: NightInput = { teamKey, week, date, rounds };
    a.run(() => saveNight(input));
  };

  return (
    <form className="flex flex-col gap-6" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Team" htmlFor="n-team">
          <select id="n-team" className={inputCls} value={teamKey} onChange={(e) => { const k = e.target.value as TeamKey; setTeamKey(k); load(k, week); }}>
            {teams.map((t) => <option key={t.key} value={t.key}>{t.name} · {t.tierName}</option>)}
          </select>
        </Field>
        <Field label="Week" htmlFor="n-week" hint={existing ? "Editing a saved night" : "New night"}>
          <input id="n-week" type="number" min={1} max={20} className={inputCls} value={week} onChange={(e) => { const v = Number(e.target.value); setWeek(v); load(teamKey, v); }} />
        </Field>
        <Field label="Date" htmlFor="n-date">
          <input id="n-date" type="date" required className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>

      <datalist id="opponents">
        {opponents.map((o) => <option key={o.id} value={o.name} />)}
      </datalist>

      <div className="grid gap-4 lg:grid-cols-3">
        {rounds.map((r, i) => {
          const res = results[i];
          const oppName = r.newOpponent ?? opponents.find((o) => o.id === r.opponentId)?.name ?? "";
          return (
            <fieldset key={r.round} className={`flex flex-col gap-3 border border-line border-t-[3px] bg-inset p-4 ${res === "W" || res === "BYE" ? "border-t-win" : res === "L" ? "border-t-loss" : "border-t-line-strong"}`}>
              <legend className="sr-only">Round {r.round}</legend>
              <div className="flex items-baseline justify-between">
                <span className="text-xs uppercase tracking-[0.14em] text-muted">Round {r.round} · {labels[i]}</span>
                {res && <span className={`font-mono font-semibold ${resText(res)}`}>{res}</span>}
              </div>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" className="h-5 w-5" checked={r.bye} onChange={(e) => set(i, { bye: e.target.checked })} />
                Bye this round
              </label>
              {!r.bye && (
                <>
                  <Field label="Opponent" htmlFor={`o-${i}`} hint={r.newOpponent && !r.opponentId ? "New team: it will be created" : undefined}>
                    <input
                      id={`o-${i}`}
                      list="opponents"
                      className={inputCls}
                      value={oppName}
                      placeholder="Start typing a team"
                      onChange={(e) => {
                        const name = e.target.value;
                        const match = opponents.find((o) => o.name.toLowerCase() === name.trim().toLowerCase());
                        set(i, match ? { opponentId: match.id, newOpponent: null } : { opponentId: null, newOpponent: name || null });
                      }}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="City" htmlFor={`s1-${i}`}>
                      <input id={`s1-${i}`} type="number" min={0} max={9} inputMode="numeric" className={inputCls} value={r.our ?? ""} onChange={(e) => set(i, { our: e.target.value === "" ? null : Number(e.target.value) })} />
                    </Field>
                    <Field label="Them" htmlFor={`s2-${i}`}>
                      <input id={`s2-${i}`} type="number" min={0} max={9} inputMode="numeric" className={inputCls} value={r.opp ?? ""} onChange={(e) => set(i, { opp: e.target.value === "" ? null : Number(e.target.value) })} />
                    </Field>
                  </div>
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <input type="checkbox" className="h-5 w-5" checked={r.forfeit} onChange={(e) => set(i, { forfeit: e.target.checked, ...(e.target.checked && r.our === null ? { our: 1, opp: 0 } : {}) })} />
                    Forfeit (counts for points, not for game stats)
                  </label>
                  <Field label="NSE match ID (optional)" htmlFor={`nse-${i}`}>
                    <input id={`nse-${i}`} type="number" className={inputCls} value={r.nseMatchId ?? ""} onChange={(e) => set(i, { nseMatchId: e.target.value ? Number(e.target.value) : null })} />
                  </Field>
                </>
              )}
            </fieldset>
          );
        })}
      </div>

      {team.roundStyle === "swiss" && rounds.length < 4 && (
        <button type="button" className="self-start text-sm text-accent" onClick={() => setRounds([...rounds, blank(4)])}>+ Add promotion match (Round 4)</button>
      )}

      <div className="flex flex-col gap-2 border border-highlight-line bg-highlight px-5 py-4" aria-live="polite">
        <span className="text-xs tracking-[0.14em] text-muted">POINTS PREVIEW</span>
        {team.ladder ? (
          preview ? (
            <span className="text-[15px]">
              <strong className="font-display text-3xl text-accent">+{preview.points}</strong>{" "}
              {preview.path}
              {preview.promoted && " · promoted"}
              {preview.relegated && " · relegated"}
            </span>
          ) : (
            <span className="text-sm text-text-3">Enter all three rounds to see the points.</span>
          )
        ) : (
          <span className="text-sm text-text-3">{team.tierName} has no confirmed ladder: points will come from the NSE sheet import.</span>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <PrimaryButton type="submit" pending={a.pending} className="self-start">{a.pending ? "Saving…" : "Save night"}</PrimaryButton>
        {a.message}
      </div>
    </form>
  );
}
