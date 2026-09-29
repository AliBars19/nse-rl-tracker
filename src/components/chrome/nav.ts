export const SECTIONS = [
  { key: "", label: "Dashboard" },
  { key: "scouting", label: "Scouting" },
  { key: "matches", label: "Matches" },
  { key: "players", label: "Players" },
] as const;

/** Split '/spring-26/champions/scouting/royal-bears' into its parts. */
export function parsePath(pathname: string) {
  const [season = "", team = "", section = "", ...rest] = pathname.split("/").filter(Boolean);
  return { season, team, section, rest };
}

/** Same page for another team. Opponent/player pages fall back to the section root (slugs differ per team). */
export function switchTeamHref(pathname: string, team: string): string {
  const p = parsePath(pathname);
  const keepRest = p.section === "matches" ? p.rest : [];
  return "/" + [p.season, team, p.section, ...keepRest].filter(Boolean).join("/");
}

/** Same page in another season (team and section kept, deeper segments dropped). */
export function switchSeasonHref(pathname: string, season: string): string {
  const p = parsePath(pathname);
  if (p.season === "admin") return pathname;
  return "/" + [season, p.team || "champions", p.section].filter(Boolean).join("/");
}
