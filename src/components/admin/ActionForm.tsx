"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/actions/admin";
import { Notice } from "./ui";

/** Small helper: run a server action, show its message. */
export function useAction() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      setResult(await fn());
    });
  const message = result ? (
    <Notice tone={result.ok ? "ok" : "error"}>{result.ok ? result.message : result.error}</Notice>
  ) : null;
  return { pending, result, run, message, reset: () => setResult(null) };
}
