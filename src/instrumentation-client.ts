import { NAV_START_EVENT } from "@/components/chrome/nav-events";

/**
 * Runs on every App Router navigation (links, router.push, back/forward).
 * The NavigationOverlay listens for this event to grey the page out while the next page loads.
 */
export function onRouterTransitionStart(url: string) {
  window.dispatchEvent(new CustomEvent(NAV_START_EVENT, { detail: { url } }));
}
