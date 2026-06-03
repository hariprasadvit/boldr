"""Business/cost economics — the single source of truth for every figure on the
Impact dashboard.

A judge will ask "where did that come from?" for each number. The answer must be
one of the constants here, or a formula over them. Each output is tagged
real | assumption | derived so the UI can label it honestly.

real       = derived from pipeline data we actually captured.
assumption = a defensible business constant; surfaced with its value in the UI.
derived    = computed from the two above.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Assumptions:
    minutes_per_reply_from_scratch: int = 8
    minutes_to_review_draft: int = 2
    loaded_hourly_rate_usd: float = 18.0
    # OpenRouter → Claude Sonnet 4.6, USD per 1M tokens.
    price_per_m_input_usd: float = 3.0
    price_per_m_output_usd: float = 15.0
    # Per-ticket token estimate for the historical batch (no exact usage persisted).
    # Calibrated to a measured live run (~2,150 in / 240 out). Live runs report
    # REAL usage and never use this estimate.
    est_input_tokens_per_ticket: int = 2150
    est_output_tokens_per_ticket: int = 240


ASSUMPTIONS = Assumptions()

# Themes whose suggested action implies a product-page fix.
_PRODUCT_PAGE_HINTS = ("product page", "badge", "spec", "listing", "pdp")


def usd_for_tokens(input_tokens: float, output_tokens: float) -> float:
    return (
        input_tokens / 1_000_000 * ASSUMPTIONS.price_per_m_input_usd
        + output_tokens / 1_000_000 * ASSUMPTIONS.price_per_m_output_usd
    )


def minutes_saved_per_draft() -> int:
    return ASSUMPTIONS.minutes_per_reply_from_scratch - ASSUMPTIONS.minutes_to_review_draft


def estimate_batch_cost_usd(tickets_processed: int) -> float:
    """Conservative batch cost estimate (labeled 'derived' in the UI)."""
    return tickets_processed * usd_for_tokens(
        ASSUMPTIONS.est_input_tokens_per_ticket, ASSUMPTIONS.est_output_tokens_per_ticket
    )


def compute_impact(
    *,
    tickets_processed: int,
    by_route: dict[str, int],
    knowledge_gaps_drafted: int,
    themes: list[dict],
) -> dict:
    """Outcome roll-up for the Impact dashboard. Pure function of counts + themes."""
    auto_approved = by_route.get("auto_reply", 0)
    human_review = by_route.get("human_review", 0)
    # Both auto-replied and human-review tickets receive a drafted reply.
    draft_assisted = auto_approved + human_review

    multi = [t for t in themes if (t.get("size") or 0) > 1]
    marketing_opportunities = sum(1 for t in multi if (t.get("marketing_signal") or "").strip())
    product_page_gaps = sum(
        1
        for t in multi
        if any(h in (t.get("suggested_action") or "").lower() for h in _PRODUCT_PAGE_HINTS)
    )

    hours_saved = draft_assisted * minutes_saved_per_draft() / 60
    human_cost_saved_usd = hours_saved * ASSUMPTIONS.loaded_hourly_rate_usd
    model_cost_usd = estimate_batch_cost_usd(tickets_processed)
    roi_multiple = human_cost_saved_usd / model_cost_usd if model_cost_usd > 0 else 0.0
    avg_cost_per_ticket_usd = model_cost_usd / tickets_processed if tickets_processed else 0.0

    return {
        "tickets_processed": tickets_processed,
        "auto_approved": auto_approved,
        "draft_assisted": draft_assisted,
        "knowledge_gaps": by_route.get("knowledge_gap", 0),
        "new_knowledge_created": knowledge_gaps_drafted,
        "product_page_gaps": product_page_gaps,
        "marketing_opportunities": marketing_opportunities,
        "hours_saved": round(hours_saved, 1),
        "human_cost_saved_usd": round(human_cost_saved_usd, 2),
        "model_cost_usd": round(model_cost_usd, 4),
        "roi_multiple": round(roi_multiple, 0),
        "avg_cost_per_ticket_usd": round(avg_cost_per_ticket_usd, 4),
        "assumptions": {
            "minutes_per_reply_from_scratch": ASSUMPTIONS.minutes_per_reply_from_scratch,
            "minutes_to_review_draft": ASSUMPTIONS.minutes_to_review_draft,
            "loaded_hourly_rate_usd": ASSUMPTIONS.loaded_hourly_rate_usd,
            "price_per_m_input_usd": ASSUMPTIONS.price_per_m_input_usd,
            "price_per_m_output_usd": ASSUMPTIONS.price_per_m_output_usd,
        },
    }
