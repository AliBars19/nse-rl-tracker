"use client";

import { useState } from "react";
import { setTournaments } from "@/lib/actions/admin";
import { useAction } from "./ActionForm";
import { Field, inputCls, PrimaryButton } from "./ui";

/** Which NSE tournament each City team plays in this season (used by Imports and the replay sorter). */
export function TournamentForm({ champions, commanders }: { champions: string; commanders: string }) {
  const a = useAction();
  const [f, setF] = useState({ champions, commanders });
  return (
    <form
      className="grid gap-4 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        a.run(() => setTournaments(f));
      }}
    >
      {(["champions", "commanders"] as const).map((k) => (
        <Field key={k} label={`City ${k}`} htmlFor={`tour-${k}`} hint="Paste the slug or the tournament page URL, e.g. rocket-league-nse-winter-26">
          <input id={`tour-${k}`} className={inputCls} value={f[k]} placeholder="rocket-league-nse-winter-26" onChange={(e) => setF({ ...f, [k]: e.target.value })} />
        </Field>
      ))}
      <div className="flex flex-col gap-3 md:col-span-2">
        <PrimaryButton type="submit" pending={a.pending} className="self-start">Save tournaments</PrimaryButton>
        {a.message}
      </div>
    </form>
  );
}
