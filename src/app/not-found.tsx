import Link from "next/link";
import { Logo } from "@/components/chrome/Logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-app">
      <header className="flex h-[60px] items-center border-b border-line bg-header px-4 lg:h-[72px] lg:px-12">
        <Logo href="/" />
      </header>
      <main id="main" className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-16">
        <span className="clip-para-sm bg-accent px-[14px] py-[6px] font-display text-[13px] font-bold tracking-[0.14em] text-on-accent">404</span>
        <h1 className="m-0 font-display text-5xl font-bold uppercase">Not found</h1>
        <p className="m-0 text-text-3">That season, team, opponent or night is not in the tracker.</p>
        <Link href="/">Pick a season</Link>
      </main>
    </div>
  );
}
