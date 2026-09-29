"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { changesPage, NAV_START_EVENT } from "./nav-events";

/** Wait this long before greying out, so instant (prefetched) navigations don't flash. */
const SHOW_AFTER_MS = 120;
/** Never leave the page greyed out if a navigation is abandoned or fails. */
const GIVE_UP_MS = 15_000;

/**
 * Simple loading state: while the next page loads, dim the current one and show a spinner.
 * Starts on `onRouterTransitionStart` (see src/instrumentation-client.ts) and ends when the
 * URL changes, which happens once the new page is ready.
 */
export function NavigationOverlay() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [pendingFor, setPendingFor] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const location = `${pathname}?${search}`;

  // A new URL means the navigation finished: hide.
  const [lastLocation, setLastLocation] = useState(location);
  if (location !== lastLocation) {
    setLastLocation(location);
    setPendingFor(null);
    setVisible(false);
  }

  useEffect(() => {
    const onStart = (e: Event) => {
      const url = (e as CustomEvent<{ url: string }>).detail?.url;
      // The hook fires inside the router's transition; a state update made there would be held
      // back until the navigation finishes. Defer it so it renders straight away.
      // Re-check when it runs: a cached page may already have committed by then.
      if (url && changesPage(url)) setTimeout(() => changesPage(url) && setPendingFor(url), 0);
    };
    window.addEventListener(NAV_START_EVENT, onStart);
    return () => window.removeEventListener(NAV_START_EVENT, onStart);
  }, []);

  useEffect(() => {
    if (!pendingFor) return;
    const show = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    const giveUp = setTimeout(() => {
      setPendingFor(null);
      setVisible(false);
    }, GIVE_UP_MS);
    return () => {
      clearTimeout(show);
      clearTimeout(giveUp);
    };
  }, [pendingFor]);

  return (
    <div
      aria-hidden={!visible}
      className={
        "fixed inset-0 z-50 flex items-center justify-center bg-page/60 backdrop-grayscale transition-opacity duration-150 " +
        (visible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0")
      }
    >
      <div role="status" aria-live="polite" className="flex flex-col items-center gap-3">
        {/* Square, not round: the design has no rounded shapes. Static for reduced motion. */}
        <span className="block h-9 w-9 border-4 border-line-strong border-t-accent motion-safe:animate-spin" />
        <span className="font-display text-xs font-bold tracking-[0.14em] text-text-2">{visible ? "LOADING" : ""}</span>
      </div>
    </div>
  );
}
