import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/chrome/Logo";
import { Notice } from "@/components/admin/ui";
import { getViewer } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/env";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const viewer = await getViewer();
  if (viewer.isAdmin) redirect("/admin");
  return (
    <div className="flex min-h-dvh flex-col bg-app">
      <header className="flex h-[60px] items-center border-b border-line bg-header px-4 lg:h-[72px] lg:px-12">
        <Logo href="/" />
      </header>
      <main id="main" className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-10">
        <h1 className="m-0 font-display text-4xl font-bold uppercase">Admin sign in</h1>
        {!supabaseConfigured() ? (
          <Notice>
            The site is running on the bundled Spring 26 snapshot, so there is nothing to sign in to yet. Set up
            Supabase (see <code>docs/setup.md</code>) and add the environment variables, then come back.
          </Notice>
        ) : (
          <>
            {viewer.signedIn && (
              <Notice tone="error">
                Signed in as {viewer.email}, but that account is not an admin. Add it to the <code>admins</code> table
                (docs/setup.md, step 4).
              </Notice>
            )}
            <LoginForm />
          </>
        )}
        <Link href="/" className="text-sm">← Back to the site</Link>
      </main>
    </div>
  );
}
