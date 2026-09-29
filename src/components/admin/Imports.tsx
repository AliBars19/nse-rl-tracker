"use client";

import { useState, useTransition } from "react";
import { applyNse, applySheet, previewNse, previewSheet, type ActionResult, type NsePreview, type SheetPreview } from "@/lib/actions/admin";
import { useAction } from "./ActionForm";
import { Field, inputCls, Notice, PrimaryButton, SecondaryButton } from "./ui";

type TierKey = "div1" | "div2" | "swiss";
const TIERS: Array<[TierKey, string]> = [["div2", "Division 2"], ["swiss", "Swiss"], ["div1", "Division 1"]];

export function SheetImport() {
  const [tier, setTier] = useState<TierKey>("div2");
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<ActionResult<SheetPreview> | null>(null);
  const [pending, start] = useTransition();
  const apply = useAction();

  const load = (useGoogle: boolean) =>
    start(async () => {
      apply.reset();
      setPreview(await previewSheet({ tier, csv: useGoogle ? null : csv }));
    });

  const p = preview?.ok ? preview.data! : null;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
        <Field label="Tab" htmlFor="sheet-tier">
          <select id="sheet-tier" className={inputCls} value={tier} onChange={(e) => { setTier(e.target.value as TierKey); setPreview(null); }}>
            {TIERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="Or paste CSV" htmlFor="sheet-csv" hint="Leave empty to download the tab from the public Google Sheet.">
          <textarea id="sheet-csv" rows={3} className="border border-line-strong bg-inset p-3 font-mono text-xs text-text" value={csv} onChange={(e) => setCsv(e.target.value)} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-3">
        <PrimaryButton type="button" pending={pending} onClick={() => load(!csv.trim())}>
          {pending ? "Reading…" : csv.trim() ? "Preview pasted CSV" : "Fetch & preview"}
        </PrimaryButton>
      </div>
      {preview && !preview.ok && <Notice tone="error">{preview.error}</Notice>}
      {p && (
        <div className="flex flex-col gap-3">
          <Notice>{preview!.ok && preview!.message}</Notice>
          {p.missingWeeks.length > 0 && (
            <Notice tone="error">No night exists yet for week {p.missingWeeks.join(", ")} in this tier; those columns are skipped. Import that week from NSE first.</Notice>
          )}
          {p.rows.length > 0 && (
            <div className="max-h-[420px] overflow-auto border border-line">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead className="sticky top-0 bg-panel text-left text-xs tracking-[0.12em] text-muted">
                  <tr><th className="p-2">TEAM</th><th className="p-2">POS</th><th className="p-2">TOTAL</th><th className="p-2">WEEKLY CHANGES</th></tr>
                </thead>
                <tbody>
                  {p.rows.map((r) => (
                    <tr key={r.team} className="border-t border-divider align-top">
                      <td className="p-2">{r.team}{r.teamStatus === "new" && <span className="ml-2 text-xs text-accent">new team</span>}</td>
                      <td className="p-2 font-mono">{r.position}</td>
                      <td className="p-2 font-mono">{r.total}</td>
                      <td className="p-2 text-text-3">
                        {r.changes.join(" · ") || "—"}
                        {r.warnings.map((w) => <span key={w} className="block text-xs text-loss">{w}</span>)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <PrimaryButton type="button" pending={apply.pending} onClick={() => apply.run(() => applySheet({ tier, csv: p.csv }))}>
              Apply import
            </PrimaryButton>
            <SecondaryButton type="button" onClick={() => setPreview(null)}>Cancel</SecondaryButton>
          </div>
          {apply.message}
        </div>
      )}
    </div>
  );
}

export function NseImport({ tournaments }: { tournaments: Partial<Record<TierKey, string>> }) {
  const [tier, setTier] = useState<TierKey>("div2");
  const [tournament, setTournament] = useState(tournaments.div2 ?? "");
  const [page, setPage] = useState("week-3");
  const [week, setWeek] = useState(3);
  const [preview, setPreview] = useState<ActionResult<NsePreview> | null>(null);
  const [pending, start] = useTransition();
  const apply = useAction();
  const input = { tier, tournament, page, week };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Field label="Tier" htmlFor="nse-tier">
          <select id="nse-tier" className={inputCls} value={tier} onChange={(e) => { const t = e.target.value as TierKey; setTier(t); setTournament(tournaments[t] ?? ""); setPreview(null); }}>
            {TIERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="Tournament slug" htmlFor="nse-t">
          <input id="nse-t" className={inputCls} value={tournament} onChange={(e) => setTournament(e.target.value)} />
        </Field>
        <Field label="Page" htmlFor="nse-page" hint="week-4, stage-1, or teams/<slug>/matches for playoffs">
          <input
            id="nse-page"
            className={inputCls}
            value={page}
            onChange={(e) => {
              const v = e.target.value;
              setPage(v);
              const m = v.match(/^week-(\d+)$/);
              if (m) setWeek(Number(m[1]));
              if (v === "stage-1") setWeek(1);
            }}
          />
        </Field>
        <Field label="Week number" htmlFor="nse-week" hint="Stage 1 = 1">
          <input id="nse-week" type="number" min={1} max={20} className={inputCls} value={week} onChange={(e) => setWeek(Number(e.target.value))} />
        </Field>
      </div>
      <div>
        <PrimaryButton type="button" pending={pending} onClick={() => start(async () => { apply.reset(); setPreview(await previewNse(input)); })}>
          {pending ? "Fetching…" : "Fetch & preview"}
        </PrimaryButton>
      </div>
      {preview && !preview.ok && <Notice tone="error">{preview.error}</Notice>}
      {preview?.ok && preview.data && (
        <div className="flex flex-col gap-3">
          <Notice>{preview.message}{preview.data.date ? ` First kick-off: ${preview.data.date}.` : ""}</Notice>
          {preview.data.ours.length > 0 && (
            <ul className="m-0 list-disc pl-5 text-sm text-text-2">{preview.data.ours.map((o) => <li key={o}>{o}</li>)}</ul>
          )}
          {preview.data.newTeams.length > 0 && <p className="m-0 text-sm text-text-3">New teams: {preview.data.newTeams.join(", ")}</p>}
          <div className="flex gap-3">
            <PrimaryButton type="button" pending={apply.pending} onClick={() => apply.run(() => applyNse(input))}>Import</PrimaryButton>
            <SecondaryButton type="button" onClick={() => setPreview(null)}>Cancel</SecondaryButton>
          </div>
          {apply.message}
        </div>
      )}
    </div>
  );
}
