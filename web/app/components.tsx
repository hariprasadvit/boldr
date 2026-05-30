import Link from "next/link";

export function RouteBadge({ route }: { route: string }) {
  const styles: Record<string, string> = {
    auto_reply: "bg-emerald-900/40 text-emerald-300 border-emerald-800/60",
    human_review: "bg-amber-900/40 text-amber-300 border-amber-800/60",
    knowledge_gap: "bg-violet-900/40 text-violet-300 border-violet-800/60",
    error: "bg-red-900/40 text-red-300 border-red-800/60",
  };
  const cls = styles[route] ?? "bg-zinc-800 text-zinc-300 border-zinc-700";
  return (
    <span className={`inline-block rounded border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider ${cls}`}>
      {route.replace(/_/g, " ")}
    </span>
  );
}

export function Pill({ children, color = "zinc" }: { children: React.ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    zinc: "bg-zinc-800/60 text-zinc-300 border-zinc-700",
    amber: "bg-amber-900/30 text-amber-300 border-amber-800/50",
    emerald: "bg-emerald-900/30 text-emerald-300 border-emerald-800/50",
    violet: "bg-violet-900/30 text-violet-300 border-violet-800/50",
    rose: "bg-rose-900/30 text-rose-300 border-rose-800/50",
  };
  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 text-[11px] ${colors[color] ?? colors.zinc}`}>
      {children}
    </span>
  );
}

export function Card({
  title,
  subtitle,
  children,
  href,
  accent,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  href?: string;
  accent?: boolean;
}) {
  const inner = (
    <div
      className={`group flex h-full flex-col rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 transition-colors ${
        href ? "hover:bg-[var(--surface-hover)] hover:border-zinc-700" : ""
      } ${accent ? "ring-1 ring-amber-500/20" : ""}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-zinc-100">{title}</h3>
        {href && (
          <span className="text-xs text-[var(--muted)] transition-colors group-hover:text-[var(--accent)]">→</span>
        )}
      </div>
      {subtitle && <div className="mt-1 text-xs text-[var(--muted)]">{subtitle}</div>}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="text-xs uppercase tracking-wider text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-zinc-100">{value}</div>
      {hint && <div className="mt-1 text-xs text-[var(--muted)]">{hint}</div>}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)]/50 p-12 text-center">
      <div className="text-sm text-zinc-300">{title}</div>
      {hint && <div className="mt-2 text-xs text-[var(--muted)]">{hint}</div>}
    </div>
  );
}

export function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>}
    </div>
  );
}
