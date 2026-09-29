/** Helpers for matching and displaying team names across NSE pages and the standings sheet. */

/** Normalise for matching: lower-case, collapse whitespace, drop punctuation. */
export function nameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** URL slug: 'Royal Bears  Rocket league ' -> 'royal-bears-rocket-league' */
export function slugify(name: string): string {
  return nameKey(name).replace(/\s+/g, "-") || "team";
}

/** Display names that the design uses; anything else falls back to `defaultShortName`. */
const SHORT_NAMES: Record<string, string> = {
  "royal bears rocket league": "Royal Bears",
  "keele krakens 2nd 2025": "Keele Krakens 2nd",
};

/** Strip trailing season tags like '2025' or '25_26' that make names long. */
export function defaultShortName(name: string): string {
  const explicit = SHORT_NAMES[nameKey(name)];
  if (explicit) return explicit;
  const stripped = name.replace(/\s+(20\d\d|\d\d_\d\d)$/i, "").trim();
  return stripped || name;
}

/** Five-ish character uppercase tag for tight spots (form strip): 'Portsmouth Pirates' -> 'PORTS P'. */
export function formTag(shortName: string): string {
  const words = shortName.toUpperCase().split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 6);
  return `${words[0].slice(0, 5)} ${words[1][0]}`;
}
