import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "@/api/client";
import { EmptyState, Pill, RouteBadge, SectionHeader } from "@/components/ui";
import { useAsync } from "@/hooks/useAsync";
import type { OpenItem, ReplyOut } from "@/api/types";

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const tickets = useAsync(() => api.listTickets(), []);
  const replies = useAsync(() => api.listReplies(), []);

  if (tickets.loading || replies.loading) {
    return <SectionHeader title="Ticket" subtitle="Loading…" />;
  }
  const ticket = (tickets.data ?? []).find((t) => t.ticket_id === id);
  if (!ticket) {
    return (
      <div>
        <SectionHeader title="Ticket" />
        <EmptyState title="Ticket not found." hint="Return to the inbox." />
      </div>
    );
  }
  const reply = (replies.data ?? []).find((r) => r.ticket_id === id);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <Link to="/inbox" className="text-xs text-[var(--muted)] hover:text-zinc-300">
          ← back to inbox
        </Link>
        <Link to={`/intelligence/${ticket.ticket_id}`} className="text-xs text-amber-300 hover:text-amber-200">
          view full intelligence record →
        </Link>
      </div>
      <SectionHeader
        title={ticket.subject || "Customer ticket"}
        subtitle={`Ticket ${ticket.ticket_id} · ${ticket.channel} · ${ticket.date_received ?? ""}`}
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {reply?.route && <RouteBadge route={reply.route} />}
        {reply?.question_type && <Pill>type: {reply.question_type}</Pill>}
        {reply?.buyer_persona && <Pill color="amber">persona: {reply.buyer_persona}</Pill>}
        {reply?.kb_confidence != null && <Pill>KB confidence: {reply.kb_confidence.toFixed(2)}</Pill>}
        {(reply?.escalation_flags ?? []).filter(Boolean).map((f) => (
          <Pill key={f} color="rose">
            ⚠ {f}
          </Pill>
        ))}
      </div>

      {ticket.message_body && (
        <div className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <h3 className="mb-2 text-xs uppercase tracking-wider text-[var(--muted)]">Customer message</h3>
          <p className="whitespace-pre-wrap text-sm text-zinc-200">{ticket.message_body}</p>
        </div>
      )}

      {reply?.route_reason && (
        <div className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <h3 className="mb-2 text-xs uppercase tracking-wider text-[var(--muted)]">Route reason</h3>
          <p className="text-sm text-zinc-200">{reply.route_reason}</p>
        </div>
      )}

      {reply &&
        (reply.status === "draft" ? (
          <ReviewWorkspace reply={reply} />
        ) : (
          <ResolvedView reply={reply} />
        ))}
    </div>
  );
}

function ResolvedView({ reply }: { reply: ReplyOut }) {
  const sent = reply.status === "sent";
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-medium text-zinc-100">{sent ? "Sent reply" : "Drafted reply"}</h3>
        <Pill color={sent ? "emerald" : "zinc"}>{sent ? "resolved" : reply.status}</Pill>
        {reply.edited && <span className="text-[11px] text-zinc-500">edited before sending</span>}
        {reply.rating && (
          <span className="text-[11px] text-zinc-400">{reply.rating === "useful" ? "👍 useful" : "👎 not useful"}</span>
        )}
      </div>
      <pre className="whitespace-pre-wrap rounded bg-zinc-950/60 p-4 font-mono text-[12px] leading-relaxed text-zinc-200">
        {reply.body}
      </pre>
      <Citations items={reply.citations} />
    </div>
  );
}

function Citations({ items }: { items: string[] }) {
  const cites = (items ?? []).filter(Boolean);
  if (!cites.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1 text-[11px] text-[var(--muted)]">
      <span>citations:</span>
      {cites.map((c) => (
        <span key={c} className="font-mono text-zinc-400">
          {c}
        </span>
      ))}
    </div>
  );
}

function ReviewWorkspace({ reply }: { reply: ReplyOut }) {
  const openItems: OpenItem[] = reply.open_items ?? [];
  const [body, setBody] = useState(reply.body);
  const [answers, setAnswers] = useState(openItems.map(() => ({ answer: "", teach: true, skip: false })));
  const [rating, setRating] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ status: string; taught: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function setAnswer(i: number, patch: Partial<{ answer: string; teach: boolean; skip: boolean }>) {
    setAnswers((a) => a.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }

  // An item is "handled" once it's answered or explicitly skipped. You can't send
  // until every open item is handled — no sending while inputs are still pending.
  const pending = openItems.filter((_, i) => !answers[i].answer.trim() && !answers[i].skip).length;
  const canSend = !busy && !!body.trim() && pending === 0;

  function insertAnswers() {
    const merged = mergeAnswers(body);
    if (merged !== body) setBody(merged);
  }

  // Append any answered item whose text isn't already in the body (so a typed
  // answer can't silently get dropped from the email). Skipped items are omitted.
  function mergeAnswers(base: string): string {
    const additions = openItems
      .map((_, i) => (answers[i].answer.trim() && !answers[i].skip ? answers[i].answer.trim() : null))
      .filter((a): a is string => !!a && !base.includes(a));
    return additions.length ? `${base}\n\n${additions.join("\n\n")}` : base;
  }

  async function resolve() {
    setBusy(true);
    setError(null);
    try {
      const finalBody = mergeAnswers(body); // safety net: answers always reach the customer
      const payload = {
        final_body: finalBody,
        answers: openItems
          .map((oi, i) => ({ question: oi.question, answer: answers[i].answer.trim(), teach: answers[i].teach }))
          .filter((a, i) => a.answer && !answers[i].skip),
        rating,
        edited: finalBody !== reply.body,
      };
      const r = await api.resolveReply(reply.id, payload);
      setResult({ status: r.status, taught: r.taught });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/20 p-5">
        <div className="mb-2 text-sm font-medium text-emerald-200">✓ Sent &amp; ticket resolved</div>
        <p className="text-xs text-zinc-300">
          The final reply was sent to the customer and this ticket is now closed.
          {result.taught.length > 0 && (
            <>
              {" "}
              <span className="text-emerald-300">
                {result.taught.length} answer{result.taught.length === 1 ? "" : "s"} taught to the KB
              </span>{" "}
              — future tickets asking the same thing will be answered automatically.
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {openItems.length > 0 && (
        <div className="rounded-lg border border-amber-800/40 bg-amber-950/10 p-5">
          <h3 className="mb-1 text-sm font-medium text-amber-200">
            Needs your input ·{" "}
            {pending === 0
              ? "all handled"
              : `${pending} of ${openItems.length} still open`}
          </h3>
          <p className="mb-4 text-xs text-[var(--muted)]">
            The bot answered what the KB covers. These parts it couldn&apos;t ground — answer each (it&apos;s
            added to the reply) or skip it. You can&apos;t send until every item is handled. Anything you mark{" "}
            <span className="text-emerald-300">Teach KB</span> is published so the next customer is answered
            automatically.
          </p>
          <div className="space-y-4">
            {openItems.map((oi, i) => {
              const a = answers[i];
              return (
                <div
                  key={i}
                  className={`rounded border p-3 ${
                    a.skip
                      ? "border-[var(--border)] bg-zinc-950/20 opacity-60"
                      : a.answer.trim()
                        ? "border-emerald-800/40 bg-zinc-950/40"
                        : "border-amber-800/40 bg-zinc-950/40"
                  }`}
                >
                  <div className="mb-1 flex items-start justify-between gap-3">
                    <div className="text-sm text-zinc-200">{oi.question}</div>
                    <label className="flex shrink-0 items-center gap-1 text-[10px] text-zinc-500">
                      <input
                        type="checkbox"
                        checked={a.skip}
                        onChange={(e) => setAnswer(i, { skip: e.target.checked })}
                      />
                      skip
                    </label>
                  </div>
                  {oi.reason && <div className="mb-2 text-[11px] text-[var(--muted)]">why open: {oi.reason}</div>}
                  {a.skip ? (
                    <div className="text-[11px] text-zinc-500">Skipped — won&apos;t be included or taught.</div>
                  ) : (
                    <>
                      <textarea
                        value={a.answer}
                        onChange={(e) => setAnswer(i, { answer: e.target.value })}
                        placeholder="Type the answer… (added to the reply on send)"
                        rows={2}
                        className="w-full resize-none rounded border border-[var(--border)] bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
                      />
                      <label className="mt-2 flex items-center gap-2 text-[11px] text-zinc-400">
                        <input
                          type="checkbox"
                          checked={a.teach}
                          onChange={(e) => setAnswer(i, { teach: e.target.checked })}
                        />
                        Teach this answer to the KB (reused automatically next time)
                      </label>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <button onClick={insertAnswers} className="mt-3 text-[11px] text-amber-300 hover:text-amber-200">
            + preview answers in the reply below
          </button>
        </div>
      )}

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <h3 className="mb-3 text-sm font-medium text-zinc-100">Reply to send</h3>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={12}
          className="w-full resize-y rounded bg-zinc-950/60 p-4 font-mono text-[12px] leading-relaxed text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
        <Citations items={reply.citations} />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
          <div className="flex items-center gap-2 text-[11px] text-[var(--muted)]">
            <span>draft quality:</span>
            <button
              onClick={() => setRating(rating === "useful" ? null : "useful")}
              className={`rounded border px-2 py-0.5 ${rating === "useful" ? "border-emerald-600 bg-emerald-900/30 text-emerald-300" : "border-[var(--border)] text-zinc-400"}`}
            >
              👍 useful
            </button>
            <button
              onClick={() => setRating(rating === "not_useful" ? null : "not_useful")}
              className={`rounded border px-2 py-0.5 ${rating === "not_useful" ? "border-rose-600 bg-rose-900/30 text-rose-300" : "border-[var(--border)] text-zinc-400"}`}
            >
              👎 needs work
            </button>
          </div>
          <div className="flex items-center gap-3">
            {pending > 0 && (
              <span className="text-[11px] text-amber-300">
                Answer or skip {pending} open item{pending === 1 ? "" : "s"} to send
              </span>
            )}
            <button
              onClick={resolve}
              disabled={!canSend}
              title={pending > 0 ? "Handle all open items first" : "Send the reply and close the ticket"}
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Sending…" : "Resolve & send"}
            </button>
          </div>
        </div>
        {error && <div className="mt-2 text-[11px] text-rose-300">Failed: {error}</div>}
      </div>
    </div>
  );
}
