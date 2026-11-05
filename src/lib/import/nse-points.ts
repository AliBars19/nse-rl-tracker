/**
 * Turns the headings of a league week's "Points" round into rows for external_night_results (the table
 * the standings sheet fills for other teams). Pure and tested; the admin import writes the rows.
 */
import type { NsePointsSection, NseTeamRef } from "./nse";

export type PointsCell = { night_id: string; team_id: string; points: number | null; status: "played" | "promoted_out" | "relegated_out" };

/** One row per team named under a Points heading. A promotion or demotion has no number, only a status. */
export function pointsCells(sections: NsePointsSection[], nightId: string, teamId: (ref: NseTeamRef) => string | undefined): PointsCell[] {
  const out = new Map<string, PointsCell>();
  for (const section of sections) {
    for (const ref of section.teams) {
      const id = teamId(ref);
      if (!id) continue;
      out.set(id, {
        night_id: nightId,
        team_id: id,
        points: section.points,
        status: section.movement === "promoted" ? "promoted_out" : section.movement === "relegated" ? "relegated_out" : "played",
      });
    }
  }
  return [...out.values()];
}
