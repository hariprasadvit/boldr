import type { ReactNode } from "react";
import { Link } from "react-router-dom";

// Static class strings hoisted so JSX lines stay under the 110-char limit
// (rendered class lists are byte-identical to the inline versions).
const BADGE_BASE = "inline-block rounded border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider";
const PILL_BASE = "inline-block rounded border px-1.5 py-0.5 text-[11px]";
const CARD_BASE = [
  "group flex h-full flex-col rounded-lg border border-[var(--border)]",
  "bg-[var(--surface)] p-5 transition-colors",
].join(" ");
const EMPTY_BASE =
  "rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)]/50 p-12 text-center";

export function RouteBadge({ route }: { route: string }) {
  const styles: Record<string, string> = {
    auto_reply: "bg-emerald-900/40 text-emerald-300 border-emerald-800/60",
    human_review: "bg-amber-900/40 text-amber-300 border-amber-800/60",
    knowledge_gap: "bg-violet-900/40 text-violet-300 border-violet-800/60",
    error: "bg-red-900/40 text-red-300 border-red-800/60",
  };
  const cls = styles[route] ?? "bg-zinc-800 text-zinc-300 border-zinc-700";
  return <span className={`${BADGE_BASE} ${cls}`}>{route.replace(/_/g, " ")}</span>;
}

export function Pill({ children, color = "zinc" }: { children: ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    zinc: "bg-zinc-800/60 text-zinc-300 border-zinc-700",
    amber: "bg-amber-900/30 text-amber-300 border-amber-800/50",
    emerald: "bg-emerald-900/30 text-emerald-300 border-emerald-800/50",
    violet: "bg-violet-900/30 text-violet-300 border-violet-800/50",
    rose: "bg-rose-900/30 text-rose-300 border-rose-800/50",
  };
  return <span className={`${PILL_BASE} ${colors[color] ?? colors.zinc}`}>{children}</span>;
}

export function Card({
  title,
  subtitle,
  children,
  to,
  accent,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  to?: string;
  accent?: boolean;
}) {
  const inner = (
    <div
      className={`${CARD_BASE} ${
        to ? "hover:bg-[var(--surface-hover)] hover:border-zinc-700" : ""
      } ${accent ? "ring-1 ring-amber-500/20" : ""}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-zinc-100">{title}</h3>
        {to && (
          <span className="text-xs text-[var(--muted)] transition-colors group-hover:text-[var(--accent)]">
            →
          </span>
        )}
      </div>
      {subtitle && <div className="mt-1 text-xs text-[var(--muted)]">{subtitle}</div>}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
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
    <div className={EMPTY_BASE}>
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

export function usd(n: number): string {
  if (n < 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(n < 100 ? 1 : 0)}`;
}

/** Headline impact stat with a hover formula tooltip + real/assumption/derived tag. */
export function ImpactStat({
  label,
  value,
  hint,
  formula,
  basis,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  formula?: string;
  basis?: "real" | "assumption" | "derived";
  accent?: boolean;
}) {
  const basisStyle: Record<string, string> = {
    real: "bg-emerald-900/30 text-emerald-300 border-emerald-800/50",
    assumption: "bg-amber-900/30 text-amber-300 border-amber-800/50",
    derived: "bg-sky-900/30 text-sky-300 border-sky-800/50",
  };
  return (
    <div
      className={`group relative rounded-lg border bg-[var(--surface)] p-4 ${
        accent ? "border-amber-500/40 ring-1 ring-amber-500/20" : "border-[var(--border)]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs uppercase tracking-wider text-[var(--muted)]">{label}</div>
        {basis && (
          <span className={`rounded border px-1 py-0.5 text-[9px] uppercase tracking-wider ${basisStyle[basis]}`}>
            {basis}
          </span>
        )}
      </div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-zinc-100">{value}</div>
      {hint && <div className="mt-1 text-xs text-[var(--muted)]">{hint}</div>}
      {formula && (
        <div className="pointer-events-none absolute left-0 top-full z-10 mt-1 w-max max-w-xs rounded border border-[var(--border)] bg-zinc-950 p-2 text-[11px] text-zinc-300 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
          {formula}
        </div>
      )}
    </div>
  );
}

/** Lineage chips — proves a derived artifact traces back to real tickets. */
export function DerivedFrom({
  ticketIds,
  label = "Derived from",
  max = 8,
}: {
  ticketIds: string[];
  label?: string;
  max?: number;
}) {
  const ids = ticketIds ?? [];
  if (!ids.length) return null;
  const shown = ids.slice(0, max);
  const rest = ids.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
      <span className="text-[var(--muted)]">
        {label}: <span className="text-zinc-300">{ids.length} ticket{ids.length === 1 ? "" : "s"}</span>
      </span>
      {shown.map((id) => (
        <Link
          key={id}
          to={`/intelligence/${id}`}
          className="rounded border border-zinc-700 bg-zinc-800/60 px-1.5 py-0.5 font-mono text-zinc-300 transition-colors hover:border-amber-600/60 hover:text-amber-300"
        >
          {id}
        </Link>
      ))}
      {rest > 0 && <span className="text-[var(--muted)]">+{rest} more</span>}
    </div>
  );
}

type CBComponent = {
  key: string;
  label: string;
  value: number;
  weight: number;
  contribution: number;
  measured: boolean;
};

/** Stacked confidence bar: four weighted components summing to the composite. */
export function ConfidenceBar({
  components,
  composite,
}: {
  components: CBComponent[];
  composite: number;
}) {
  const segColors: Record<string, string> = {
    kb_similarity: "bg-emerald-500",
    citation_coverage: "bg-sky-500",
    historical_match: "bg-violet-500",
    intent_certainty: "bg-amber-500",
  };
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-wider text-[var(--muted)]">Confidence</span>
        <span className="font-mono text-sm font-semibold text-zinc-100">{composite.toFixed(2)}</span>
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
        {components.map((c) => (
          <div
            key={c.key}
            className={segColors[c.key] ?? "bg-zinc-500"}
            style={{ width: `${c.contribution * 100}%` }}
            title={`${c.label}: ${c.value.toFixed(2)} × ${c.weight} = ${c.contribution.toFixed(2)}`}
          />
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
        {components.map((c) => (
          <div key={c.key} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-zinc-400">
              <span className={`inline-block h-2 w-2 rounded-sm ${segColors[c.key] ?? "bg-zinc-500"}`} />
              {c.label}
              {!c.measured && (
                <span className="rounded bg-zinc-800 px-1 text-[9px] uppercase text-zinc-500">derived</span>
              )}
            </span>
            <span className="font-mono text-zinc-300">
              {c.value.toFixed(2)} <span className="text-zinc-600">×{c.weight}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

type RoutingRule = {
  id: string;
  condition: string;
  route: "human_review" | "knowledge_gap" | "auto_reply";
  shownAs: string;
};

// Policy: every reply is human-reviewed before sending — confidence sets the
// review effort, never an auto-send. Rows differ only in why + how much scrutiny.
const ROUTING_RULES: RoutingRule[] = [
  { id: "hard_flag", condition: "Hard escalation flag (safety, refund, liability…)", route: "human_review", shownAs: "Safety / liability → careful review" },
  { id: "order_status", condition: "question_type = order_status", route: "human_review", shownAs: "Policy (SOP §5) → review" },
  { id: "liability_pair", condition: "health_conscious asking materials_safety", route: "human_review", shownAs: "Liability pair → careful review" },
  { id: "low_intent", condition: "classification confidence < 0.55", route: "human_review", shownAs: "Low intent certainty → review" },
  { id: "gap", condition: "KB confidence < 0.50", route: "knowledge_gap", shownAs: "Novel → answer + teach KB" },
  { id: "high", condition: "KB confidence ≥ 0.72", route: "human_review", shownAs: "High-confidence draft → quick approve" },
  { id: "soft", condition: "KB confidence 0.50–0.72", route: "human_review", shownAs: "Draft → human review" },
];

/** Maps a route_reason string to the rule that fired (best-effort substring match). */
export function matchFiredRule(routeReason: string, route: string): string | null {
  const r = (routeReason ?? "").toLowerCase();
  if (r.includes("escalation flag")) return "hard_flag";
  if (r.includes("sop") || r.includes("order_status") || r.includes("always needs")) return "order_status";
  if (r.includes("liability pair")) return "liability_pair";
  if (r.includes("classification confidence")) return "low_intent";
  if (r.includes("< 0.5") || r.includes("novel")) return "gap";
  if (r.includes("≥")) return "high";
  if (r.includes("soft band")) return "soft";
  if (route === "knowledge_gap") return "gap";
  if (route === "auto_reply") return "high";
  return null;
}

/** The routing framework as a legend; pass `firedId` to highlight the rule that fired. */
export function RoutingLegend({ firedId }: { firedId?: string | null }) {
  const routeColor: Record<string, string> = {
    human_review: "text-amber-300",
    knowledge_gap: "text-violet-300",
    auto_reply: "text-emerald-300",
  };
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)]">
      <div className="border-b border-[var(--border)] bg-zinc-900/40 px-3 py-1.5 text-[10px] text-emerald-300/90">
        🛡 Every reply is human-reviewed before sending — confidence sets the review effort, not an auto-send.
      </div>
      <table className="w-full text-left text-[11px]">
        <thead className="bg-zinc-900/60 text-[var(--muted)]">
          <tr>
            <th className="px-3 py-1.5 font-medium">Condition (priority order)</th>
            <th className="px-3 py-1.5 font-medium">Decision</th>
          </tr>
        </thead>
        <tbody>
          {ROUTING_RULES.map((rule) => {
            const fired = firedId === rule.id;
            return (
              <tr key={rule.id} className={`border-t border-[var(--border)] ${fired ? "bg-amber-500/10" : ""}`}>
                <td className="px-3 py-1.5 text-zinc-300">
                  {fired && <span className="mr-1 text-amber-400">▶</span>}
                  {rule.condition}
                </td>
                <td className={`px-3 py-1.5 font-medium ${routeColor[rule.route]}`}>
                  {rule.shownAs}
                  {fired && <span className="ml-1 text-[9px] uppercase text-amber-400">fired</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
