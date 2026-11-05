"use client";

import { updateFromNse } from "@/lib/actions/admin";
import { useAction } from "./ActionForm";
import { PrimaryButton } from "./ui";

/** One click: import every published NSE page a City team plays in (results, weekly points, division moves). */
export function NseUpdateButton() {
  const a = useAction();
  return (
    <div className="flex flex-col gap-3">
      <PrimaryButton type="button" pending={a.pending} className="self-start" onClick={() => a.run(() => updateFromNse())}>
        Update from NSE
      </PrimaryButton>
      {a.message}
    </div>
  );
}
