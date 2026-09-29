import Link from "next/link";
import { Header } from "@/components/chrome/Header";
import { getViewer } from "@/lib/auth";
import { dataSource, getSeasons } from "@/lib/data";
import { loadTeamPage } from "@/lib/view/team";

export default async function TeamLayout({ children, params }: LayoutProps<"/[season]/[team]">) {
  const { season, team } = await params;
  const [page, seasons, viewer] = await Promise.all([loadTeamPage(season, team), getSeasons(), getViewer()]);
  const source = dataSource();
  return (
    <div className="flex min-h-dvh flex-col bg-app">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-accent focus:px-4 focus:py-2 focus:text-on-accent">
        Skip to content
      </a>
      <Header
        base={page.base}
        seasons={seasons.map((s) => ({ slug: s.slug, name: s.name }))}
        season={page.ds.season.slug}
        isAdmin={viewer.isAdmin}
      />
      {children}
      <footer className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-6 text-xs text-muted lg:px-12">
        <span>
          Results from{" "}
          <a href="https://tournaments.nse.gg" className="text-text-3 underline underline-offset-2 hover:text-text">NSE</a> and the NSE standings sheet.
          Replay stats from <a href="https://ballchasing.com" className="text-text-3 underline underline-offset-2 hover:text-text">ballchasing.com</a>.
          {source === "seed" && " Showing the bundled Spring 26 snapshot."}
        </span>
        <Link href="/admin" className="text-text-3 hover:text-text">
          {viewer.isAdmin ? "Admin" : "Admin sign in"}
        </Link>
      </footer>
    </div>
  );
}
