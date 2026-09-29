import type { ReactNode } from "react";

export const inputCls =
  "h-11 w-full border border-line-strong bg-inset px-3 text-[15px] text-text placeholder:text-disabled disabled:opacity-50";

export function Field({ label, htmlFor, children, hint }: { label: string; htmlFor: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex flex-col gap-[6px]">
      <label htmlFor={htmlFor} className="text-xs tracking-[0.14em] text-muted uppercase">{label}</label>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

export function PrimaryButton({ children, pending, ...rest }: { children: ReactNode; pending?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      disabled={pending || rest.disabled}
      className={`clip-para h-11 cursor-pointer bg-accent px-6 font-display text-sm font-bold tracking-[0.1em] text-on-accent uppercase hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 ${rest.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, ...rest }: { children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`h-11 cursor-pointer border border-line-strong bg-transparent px-[18px] text-sm font-medium text-text hover:border-muted disabled:opacity-50 ${rest.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function AdminCard({ title, children, right, id }: { title: string; children: ReactNode; right?: ReactNode; id?: string }) {
  return (
    <section className="border border-line bg-panel" aria-labelledby={id}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4 md:px-6">
        <h2 id={id} className="h-section text-lg md:text-[22px]">{title}</h2>
        {right}
      </div>
      <div className="flex flex-col gap-4 px-4 py-5 md:px-6">{children}</div>
    </section>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "ok"; children: ReactNode }) {
  const cls = tone === "error" ? "border-loss/60 text-loss" : tone === "ok" ? "border-win/60 text-win" : "border-highlight-line text-text-2 bg-highlight";
  return <div className={`border px-4 py-3 text-sm leading-relaxed ${cls}`} role={tone === "error" ? "alert" : "status"}>{children}</div>;
}
