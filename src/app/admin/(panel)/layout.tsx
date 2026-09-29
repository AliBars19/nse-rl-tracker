import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/chrome/Logo";
import { AdminNav } from "@/components/admin/AdminNav";
import { Notice } from "@/components/admin/ui";
import { getViewer } from "@/lib/auth";
import { signOut } from "@/lib/actions/auth";
import { supabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  if (!supabaseConfigured()) {
    return (
      <div className="flex min-h-dvh flex-col bg-app">
        <header className="flex h-[72px] items-center border-b border-line bg-header px-4 lg:px-12"><Logo href="/" /></header>
        <main id="main" className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-10">
          <h1 className="m-0 font-display text-4xl font-bold uppercase">Admin</h1>
          <Notice>
            Supabase is not configured, so the site is showing the bundled Spring 26 snapshot read-only. Follow
            <code> docs/setup.md</code> to create the database and add the environment variables.
          </Notice>
          <Link href="/">← Back to the site</Link>
        </main>
      </div>
    );
  }
  const viewer = await getViewer();
  if (!viewer.isAdmin) redirect("/admin/login");
  return (
    <div className="flex min-h-dvh flex-col bg-app">
      <header className="flex h-[60px] items-center justify-between gap-4 border-b border-line bg-header px-4 lg:h-[72px] lg:px-12">
        <div className="flex items-center gap-3">
          <Logo href="/" compact />
          <span className="clip-para-sm bg-accent px-3 py-1 font-display text-xs font-bold tracking-[0.14em] text-on-accent">ADMIN</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-muted md:inline">{viewer.email}</span>
          <Link href="/" className="text-text-3 hover:text-text">View site</Link>
          <form action={signOut}>
            <button type="submit" className="h-11 cursor-pointer border border-line-strong bg-transparent px-4 text-sm text-text hover:border-muted">Sign out</button>
          </form>
        </div>
      </header>
      <AdminNav />
      <main id="main" className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-6 lg:px-12 lg:py-10">{children}</main>
    </div>
  );
}
