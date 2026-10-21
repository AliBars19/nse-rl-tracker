/**
 * Matching in-game replay names to roster nicknames. They rarely agree exactly
 * ("stav1c" vs "Stavic", "yam.een" vs "Yameen"), mostly by case, punctuation and leetspeak.
 */

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s" };

/** Lower-case, undo common leetspeak, drop everything that is not a letter or digit. */
export function foldName(s: string): string {
  return s
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[013457@$]/g, (c) => LEET[c] ?? c)
    .replace(/[^\p{L}\p{N}]/gu, "");
}

/** Same name once folded. Strict enough to attribute stats to a player. */
export function sameName(a: string, b: string): boolean {
  const x = foldName(a);
  return x.length >= 2 && x === foldName(b);
}

/**
 * Looser: also a name that starts with (3+ letters) or contains (4+ letters) the other, e.g.
 * "kidwys" for "kid". Only for weighing evidence (which side was City), never for attributing stats.
 */
export function looseName(a: string, b: string): boolean {
  const x = foldName(a);
  const y = foldName(b);
  if (x.length < 2 || y.length < 2) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return (short.length >= 3 && long.startsWith(short)) || (short.length >= 4 && long.includes(short));
}
