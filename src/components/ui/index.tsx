import type { ReactNode } from "react";

export type Res = "W" | "L" | "BYE";

/** Result colour, always paired with a W/L letter in the UI (never colour alone). */
export const resText = (r: Res) => (r === "W" ? "text-win" : r === "L" ? "text-loss" : "text-muted");
export const resBg = (r: Res) => (r === "W" ? "bg-win" : r === "L" ? "bg-loss" : "bg-line");
export const resBorderTop = (r: Res) => (r === "W" ? "border-t-win" : r === "L" ? "border-t-loss" : "border-t-line-strong");
export const resBorderLeft = (r: Res) => (r === "W" ? "border-l-win" : r === "L" ? "border-l-loss" : "border-l-line-strong");

export function Panel({ children, className = "", as: Tag = "section", ...rest }: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "aside";
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={`border border-line bg-panel ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

export function PanelHeader({ title, right, id, className = "" }: { title: ReactNode; right?: ReactNode; id?: string; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-4 py-[14px] md:px-6 md:py-5 ${className}`}>
      <h2 id={id} className="h-section text-lg md:text-[22px]">{title}</h2>
      {right}
    </div>
  );
}

export function StatTile({ label, value, note, className = "" }: { label: ReactNode; value: ReactNode; note?: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1 border border-line bg-panel px-4 py-[14px] md:gap-2 md:px-[22px] md:py-5 ${className}`}>
      <span className="text-[11px] uppercase tracking-[0.14em] text-muted md:text-xs md:tracking-[0.16em]">{label}</span>
      <span className="font-display text-[30px] font-bold leading-[1.1] md:text-[40px] md:leading-none">{value}</span>
      {note && <span className="text-xs text-text-3 md:text-[13px]">{note}</span>}
    </div>
  );
}

/** Dashed placeholder for data that needs replays. Never invent numbers. */
export function Placeholder({ children, right, className = "" }: { children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={`flex items-center justify-between gap-3 border border-dashed border-line-strong bg-inset px-4 py-[14px] ${className}`}>
      <span className="text-[13px] text-text-3">{children}</span>
      {right && <span className="shrink-0 font-mono text-[13px] text-muted">{right}</span>}
    </div>
  );
}

export function Tag({ children, tone = "neutral", className = "" }: { children: ReactNode; tone?: "neutral" | "accent"; className?: string }) {
  return (
    <span
      className={
        "inline-block font-display font-bold tracking-[0.14em] " +
        (tone === "accent" ? "clip-para-sm bg-accent px-[14px] py-[6px] text-[13px] text-on-accent " : "bg-line px-2 py-[3px] text-[11px] text-text-2 md:px-3 md:py-1 md:text-xs ") +
        className
      }
    >
      {children}
    </span>
  );
}

export function Avatar({ name, size = 36, accent = false }: { name: string; size?: number; accent?: boolean }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size >= 60 ? 28 : 15 }}
      className={
        "flex shrink-0 items-center justify-center font-display font-bold " +
        (accent ? "clip-para-lg bg-accent text-on-accent" : "bg-line text-text")
      }
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

export function Dash() {
  return <span className="text-disabled">—</span>;
}

/** Page container: 1440 max, 48px sides on desktop, 16px on phones. */
export function Main({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <main id="main" className={`mx-auto flex w-full max-w-[1440px] grow flex-col gap-5 px-4 pb-8 pt-5 lg:gap-7 lg:px-12 lg:pb-12 lg:pt-10 ${className}`}>
      {children}
    </main>
  );
}

export const fmt1 = (n: number | null | undefined) => (n === null || n === undefined ? "—" : n.toFixed(1));
