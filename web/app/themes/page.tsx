import { getThemes } from "@/lib/data";
import { EmptyState, Pill, SectionHeader } from "../components";

export default function ThemesPage() {
  const themes = getThemes().filter((t) => t.size >= 2);
  const singletons = getThemes().filter((t) => t.size < 2);

  if (!themes.length && !singletons.length) {
    return (
      <div>
        <SectionHeader title="Theme clusters" />
        <EmptyState title="No clusters yet." hint="Run python -m intelligence.cluster_themes" />
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title="Theme clusters"
        subtitle={`${themes.length} themes identified across the ${themes.reduce((s, t) => s + t.size, 0)} clustered tickets. ${singletons.length} singleton/novel.`}
      />

      <div className="space-y-4">
        {themes.map((t) => (
          <div key={t.cluster_id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-zinc-100">{t.theme_label}</h3>
              <Pill color="amber">{t.size} tickets</Pill>
            </div>
            <p className="mb-3 text-sm text-zinc-300">{t.theme_summary}</p>
            <div className="mb-3 grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-[var(--muted)]">Marketing signal</div>
                <div className="mt-1 text-sm text-zinc-300">{t.marketing_signal}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-[var(--muted)]">Suggested action</div>
                <div className="mt-1 text-sm text-emerald-300">{t.suggested_action}</div>
              </div>
            </div>
            <div className="mb-3 flex flex-wrap gap-1 text-xs">
              {Object.entries(t.persona_breakdown).map(([p, c]) => (
                <Pill key={p} color="amber">
                  {p} · {c}
                </Pill>
              ))}
            </div>
            <details>
              <summary className="cursor-pointer text-xs text-[var(--muted)] hover:text-zinc-300">
                {t.sample_questions.length} sample questions
              </summary>
              <ul className="mt-2 space-y-1 text-sm text-zinc-400">
                {t.sample_questions.map((q, i) => (
                  <li key={i}>· {q}</li>
                ))}
              </ul>
            </details>
          </div>
        ))}

        {singletons.length > 0 && (
          <details className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)]/40 p-5">
            <summary className="cursor-pointer text-sm text-zinc-300">
              {singletons.length} singleton / novel questions ▾
            </summary>
            <ul className="mt-3 space-y-1.5 text-sm text-zinc-400">
              {singletons.map((s) => (
                <li key={s.cluster_id} className="flex items-start gap-2">
                  <span className="mt-0.5 font-mono text-[10px] text-zinc-500">{s.ticket_ids[0]}</span>
                  <span>{s.theme_summary}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
