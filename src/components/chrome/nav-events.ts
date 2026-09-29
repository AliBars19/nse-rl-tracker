export const NAV_START_EVENT = "rl:navigation-start";

/** True when navigating to `url` would actually change the page (not just the #hash). */
export function changesPage(url: string, current: Location = window.location): boolean {
  const next = new URL(url, current.href);
  return next.origin === current.origin && (next.pathname !== current.pathname || next.search !== current.search);
}
