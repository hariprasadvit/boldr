import { api } from "@/api/client";
import { EmptyState, Pill, SectionHeader, Stat } from "@/components/ui";
import { useAsync } from "@/hooks/useAsync";
import { PERSONA_CAMPAIGNS, type PersonaCampaign } from "./campaigns";
import type { ThemeCluster } from "@/api/types";

function relatedTheme(persona: PersonaCampaign, themes: ThemeCluster[]) {
  return themes
    .filter((t) => Object.keys(t.persona_breakdown ?? {}).includes(persona.id) && t.suggested_action)
    .sort((a, b) => b.size - a.size)[0];
}

function personaVolume(id: string, counts: Record<string, number> | undefined): number {
  return counts?.[id] ?? 0;
}

export function CampaignsPage() {
  const summaryState = useAsync(() => api.summary(), []);
  const themesState = useAsync(() => api.themes(), []);

  if (summaryState.loading || themesState.loading)
    return <SectionHeader title="Persona campaigns" subtitle="Loading…" />;

  const summary = summaryState.data;
  const themes = themesState.data?.clusters ?? [];

  if (!summary) {
    return (
      <div>
        <SectionHeader title="Persona campaigns" />
        <EmptyState
          title="No persona data found yet."
          hint="Run the baseline pipeline, then refresh the dashboard data."
        />
      </div>
    );
  }
  const byPersona = summary.by_persona;

  const totalAssets = PERSONA_CAMPAIGNS.reduce(
    (sum, p) => sum + p.angles.reduce((a, angle) => a + angle.assets.length, 0),
    0,
  );
  const sortedCampaigns = [...PERSONA_CAMPAIGNS].sort(
    (a, b) => personaVolume(b.id, byPersona) - personaVolume(a.id, byPersona),
  );
  const topPersona = sortedCampaigns[0];

  return (
    <div>
      <SectionHeader
        title="Persona campaigns"
        subtitle="Buyer-persona signals become repeatable campaign briefs, newsletters, and channel-native social posts."
      />

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Persona segments" value={PERSONA_CAMPAIGNS.length} />
        <Stat label="Campaign angles" value={PERSONA_CAMPAIGNS.reduce((s, p) => s + p.angles.length, 0)} />
        <Stat label="Channel assets" value={totalAssets} hint="IG and TikTok variants" />
        <Stat
          label="Top live segment"
          value={topPersona.name.replace(" / ", " + ")}
          hint={`${personaVolume(topPersona.id, byPersona)} tickets`}
        />
      </div>

      <div className="mb-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-zinc-100">Scale model</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              One customer-intelligence signal is converted into a campaign angle, a newsletter, then
              channel-specific short-form assets.
            </p>
          </div>
          <Pill color="emerald">feedback loop: persona → content → response data</Pill>
        </div>
        <div className="grid gap-3 text-xs md:grid-cols-4">
          {["Persona signal", "Campaign angle", "Newsletter source", "Social repurposing"].map(
            (step, index) => (
              <div key={step} className="rounded border border-[var(--border)] bg-zinc-950/50 p-3">
                <div className="mb-2 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[11px] font-semibold text-zinc-950">
                  {index + 1}
                </div>
                <div className="font-medium text-zinc-200">{step}</div>
              </div>
            ),
          )}
        </div>
      </div>

      <div className="space-y-5">
        {sortedCampaigns.map((persona) => {
          const theme = relatedTheme(persona, themes);
          const volume = personaVolume(persona.id, byPersona);
          return (
            <section
              key={persona.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
            >
              <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-zinc-100">{persona.name}</h2>
                    <Pill
                      color={
                        persona.priority === "high"
                          ? "amber"
                          : persona.priority === "low"
                            ? "zinc"
                            : "emerald"
                      }
                    >
                      {persona.priority} priority
                    </Pill>
                    <Pill>{volume} tickets</Pill>
                  </div>
                  <p className="mt-2 text-sm text-zinc-300">{persona.targetingSignal}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{persona.opportunity}</p>
                </div>
                {theme && (
                  <div className="max-w-sm text-xs text-zinc-400">
                    <div className="mb-1 text-[10px] uppercase tracking-wider text-[var(--muted)]">
                      Live theme signal
                    </div>
                    <div className="text-zinc-200">{theme.theme_label}</div>
                    <div className="mt-1">{theme.suggested_action}</div>
                  </div>
                )}
              </div>

              <div className="space-y-5">
                {persona.angles.map((angle, index) => (
                  <div
                    key={angle.name}
                    className="border-t border-[var(--border)] pt-5 first:border-t-0 first:pt-0"
                  >
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <Pill color="violet">sample {index + 1}</Pill>
                      <h3 className="text-sm font-medium text-zinc-100">{angle.name}</h3>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                      <div>
                        <div className="mb-1 text-[10px] uppercase tracking-wider text-[var(--muted)]">
                          Newsletter
                        </div>
                        <div className="text-sm font-medium text-zinc-100">{angle.newsletterSubject}</div>
                        <div className="mt-1 text-xs text-amber-300">{angle.newsletterPreview}</div>
                        <p className="mt-3 text-sm leading-relaxed text-zinc-300">{angle.newsletterBody}</p>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {angle.assets.map((asset) => (
                          <div
                            key={`${angle.name}-${asset.platform}`}
                            className="rounded border border-[var(--border)] bg-zinc-950/50 p-3"
                          >
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <Pill color={asset.platform === "Instagram" ? "rose" : "emerald"}>
                                {asset.platform}
                              </Pill>
                              <span className="text-[11px] text-[var(--muted)]">{asset.format}</span>
                            </div>
                            <div className="text-sm font-medium text-zinc-100">{asset.hook}</div>
                            <p className="mt-2 text-xs leading-relaxed text-zinc-400">{asset.copy}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
