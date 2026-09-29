import { AdminCard, Notice } from "@/components/admin/ui";
import { NseImport, SheetImport } from "@/components/admin/Imports";
import { adminDataset } from "@/lib/data/admin";

export default async function ImportsAdmin() {
  const { ds } = await adminDataset();
  if (!ds) return <Notice>No current season.</Notice>;
  const tournaments: Record<string, string> = {};
  for (const ts of ds.teamSeasons) if (ts.nseTournamentSlug) tournaments[ts.tier] = ts.nseTournamentSlug;
  return (
    <>
      <AdminCard title="NSE matches" id="nse">
        <p className="m-0 text-sm text-text-3">
          Pull every series for a night from tournaments.nse.gg (week pages are plain HTML). Existing series are updated
          by NSE match ID, so re-importing is safe. Admin “Points” rows are skipped.
        </p>
        <NseImport tournaments={tournaments} />
      </AdminCard>
      <AdminCard title="Standings sheet" id="sheet">
        <p className="m-0 text-sm text-text-3">
          Other teams&apos; weekly points and NSE&apos;s table order come from the public standings sheet. Status cells
          (“Promoted to Div 1”) are stored as events, not points. The import replaces this tier&apos;s sheet data.
        </p>
        <SheetImport />
      </AdminCard>
    </>
  );
}
