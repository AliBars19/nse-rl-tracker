"use client";

import { useRouter } from "next/navigation";

export function SeriesPicker({ groups, value }: { groups: Array<{ label: string; options: Array<{ id: string; label: string }> }>; value: string | null }) {
  const router = useRouter();
  return (
    <select
      id="series"
      className="h-11 w-full border border-line-strong bg-inset px-3 text-[15px] text-text"
      value={value ?? ""}
      onChange={(e) => router.push(`/admin/replays?series=${e.target.value}`)}
    >
      <option value="" disabled>Choose a series…</option>
      {groups.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </optgroup>
      ))}
    </select>
  );
}
