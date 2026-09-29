"use client";

import { useState } from "react";
import { createSeason, setSeasonFinished } from "@/lib/actions/admin";
import { useAction } from "./ActionForm";
import { Field, inputCls, PrimaryButton, SecondaryButton } from "./ui";

const TIERS = [
  ["div1", "Division 1"],
  ["div2", "Division 2"],
  ["swiss", "Swiss"],
] as const;

export function SeasonFinishedToggle({ seasonId, finished }: { seasonId: string; finished: boolean }) {
  const a = useAction();
  return (
    <div className="flex flex-col gap-2">
      <SecondaryButton type="button" disabled={a.pending} onClick={() => a.run(() => setSeasonFinished({ seasonId, finished: !finished }))}>
        {finished ? "Mark season as in progress" : "Mark season as finished"}
      </SecondaryButton>
      {a.message}
    </div>
  );
}

export function NewSeasonForm() {
  const a = useAction();
  const [f, setF] = useState({
    slug: "",
    name: "",
    shortName: "",
    makeCurrent: true,
    champions: { tier: "div2" as "div1" | "div2" | "swiss", tournament: "" },
    commanders: { tier: "swiss" as "div1" | "div2" | "swiss", tournament: "" },
  });
  return (
    <form
      className="grid gap-4 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        a.run(() => createSeason(f));
      }}
    >
      <Field label="Name" htmlFor="s-name" hint="e.g. NSE Autumn 26">
        <input id="s-name" className={inputCls} value={f.name} required onChange={(e) => {
          const name = e.target.value;
          const short = name.replace(/^NSE\s+/i, "");
          setF({ ...f, name, shortName: short, slug: short.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") });
        }} />
      </Field>
      <Field label="URL slug" htmlFor="s-slug" hint="Used in links: /autumn-26/champions">
        <input id="s-slug" className={inputCls} value={f.slug} required pattern="[a-z0-9-]+" onChange={(e) => setF({ ...f, slug: e.target.value })} />
      </Field>
      {(["champions", "commanders"] as const).map((k) => (
        <fieldset key={k} className="flex flex-col gap-3 border border-line p-4">
          <legend className="px-1 font-display text-sm font-bold uppercase tracking-[0.08em]">City {k}</legend>
          <Field label="Starting tier" htmlFor={`${k}-tier`}>
            <select id={`${k}-tier`} className={inputCls} value={f[k].tier} onChange={(e) => setF({ ...f, [k]: { ...f[k], tier: e.target.value as "div1" } })}>
              {TIERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="NSE tournament slug" htmlFor={`${k}-t`} hint="From the tournament URL on tournaments.nse.gg">
            <input id={`${k}-t`} className={inputCls} value={f[k].tournament} onChange={(e) => setF({ ...f, [k]: { ...f[k], tournament: e.target.value } })} />
          </Field>
        </fieldset>
      ))}
      <label className="flex min-h-11 items-center gap-3 text-sm md:col-span-2">
        <input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={f.makeCurrent} onChange={(e) => setF({ ...f, makeCurrent: e.target.checked })} />
        Make this the current season (the home page opens it)
      </label>
      <div className="flex flex-col gap-3 md:col-span-2">
        <PrimaryButton type="submit" pending={a.pending} className="self-start">Create season</PrimaryButton>
        {a.message}
      </div>
    </form>
  );
}
