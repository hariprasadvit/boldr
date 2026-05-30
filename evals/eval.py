"""
Score the Python pipeline against ground-truth labels from data/01_customer_tickets.csv.

We don't re-run the pipeline here — outputs/drafted_replies.csv has the predictions
from the existing batch run. This script just compares predicted vs expected.

Ground truth comes from the CSV columns:
  - question_type    (label)
  - buyer_persona    (label)
  - requires_escalation (yes/no — proxy for "should NOT auto-reply")
  - answered_by_kb     (yes/no — proxy for "KB should have a confident hit")

Plus deterministic adversarial checks from README:
  - order_id mismatch detection on TKT-1009 / 1029 / 1040 / 1043
  - SOP price drift: TKT-1062 reply must NOT contain "SGD 60" (stale SOP price);
    canonical regulation service is SGD 85 in the rate card.
"""
from __future__ import annotations

import csv
import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = ROOT / "outputs"
RESULTS = ROOT / "evals" / "results"

ORDER_ID_MISMATCH_TICKETS = {"TKT-1009", "TKT-1029", "TKT-1040", "TKT-1043"}
SOP_PRICE_DRIFT_TICKETS = {"TKT-1062"}  # must not quote SGD 60 for regulation service

# Direct mappings from the original 7-persona taxonomy to the new 5-persona taxonomy.
# niche_buyer is content-dependent and handled separately below.
LEGACY_PERSONA_MAP = {
    "health_conscious": "health_conscious",
    "gifter": "gifter",
    "enthusiast": "enthusiast",
    "prospect": "active",          # sizing, comparison, return policy → active
    "transactional": "active",     # tracking, refund, customs → active
    "owner_aftercare": "enthusiast",  # servicing, battery, polish → enthusiast
}

# Keywords that route a niche_buyer ticket to `sustainable` rather than `active`.
SUSTAIN_HINT_KEYWORDS = (
    "vegan", "sustainable", "sustainability", "recycling", "recycle",
    "carbon", "ethical", "take-back", "packaging", "eco", "offset",
    "responsible", "animal product", "plant-based",
)


def map_legacy_persona(legacy: str, message_body: str) -> str:
    """Map a ticket's old 7-taxonomy persona label to the new 5-taxonomy label.

    Deterministic for 6 of the 7. `niche_buyer` is content-aware: tickets about
    sustainability/vegan/recycling go to `sustainable`; everything else (MRI,
    altitude, extreme sports, collabs, resale) goes to `active`.
    """
    if legacy in LEGACY_PERSONA_MAP:
        return LEGACY_PERSONA_MAP[legacy]
    if legacy == "niche_buyer":
        body = message_body.lower()
        if any(kw in body for kw in SUSTAIN_HINT_KEYWORDS):
            return "sustainable"
        return "active"
    return legacy  # already in new taxonomy, passthrough


def load_ground_truth() -> dict[str, dict]:
    out = {}
    with (DATA / "01_customer_tickets.csv").open() as f:
        for r in csv.DictReader(f):
            legacy_persona = r["buyer_persona"]
            mapped_persona = map_legacy_persona(legacy_persona, r.get("message_body", ""))
            out[r["ticket_id"]] = {
                "question_type": r["question_type"],
                "buyer_persona": mapped_persona,
                "buyer_persona_legacy": legacy_persona,
                "requires_escalation": r["requires_escalation"].strip().lower() == "yes",
                "answered_by_kb": r["answered_by_kb"].strip().lower() == "yes",
            }
    return out


def load_predictions(csv_path: Path) -> dict[str, dict]:
    out = {}
    with csv_path.open() as f:
        for r in csv.DictReader(f):
            r["kb_confidence"] = float(r.get("kb_confidence") or 0)
            out[r["ticket_id"]] = r
    return out


def score(predictions: dict[str, dict], gt: dict[str, dict], label: str) -> dict:
    n = 0
    qtype_correct = 0
    persona_correct = 0
    route_match = 0  # predicted route aligned with requires_escalation expectation
    high_conf_with_kb = 0  # got high KB confidence on tickets answered_by_kb=yes
    qtype_confusion: dict[str, Counter] = defaultdict(Counter)

    order_id_flag_hits = 0
    sop_drift_violations = 0

    for tid, exp in gt.items():
        pred = predictions.get(tid)
        if not pred:
            continue
        n += 1

        if pred.get("question_type") == exp["question_type"]:
            qtype_correct += 1
        qtype_confusion[exp["question_type"]][pred.get("question_type", "?")] += 1

        if pred.get("buyer_persona") == exp["buyer_persona"]:
            persona_correct += 1

        pred_route = pred.get("route", "")
        expected_human = exp["requires_escalation"]
        actual_human = pred_route in ("human_review", "knowledge_gap")
        if expected_human == actual_human:
            route_match += 1

        if exp["answered_by_kb"] and pred.get("kb_confidence", 0) >= 0.5:
            high_conf_with_kb += 1

        if tid in ORDER_ID_MISMATCH_TICKETS:
            flags = (pred.get("escalation_flags") or "").split("|")
            if "order_id_mismatch" in flags:
                order_id_flag_hits += 1

        if tid in SOP_PRICE_DRIFT_TICKETS:
            reply = (pred.get("reply_draft") or "").lower()
            if "sgd 60" in reply or "sgd60" in reply or "$60" in reply:
                sop_drift_violations += 1

    answered_by_kb_count = sum(1 for v in gt.values() if v["answered_by_kb"])

    return {
        "pipeline": label,
        "n": n,
        "metrics": {
            "qtype_accuracy": round(qtype_correct / n, 3) if n else 0,
            "persona_accuracy": round(persona_correct / n, 3) if n else 0,
            "route_match_rate": round(route_match / n, 3) if n else 0,
            "kb_recall_when_answerable": (
                round(high_conf_with_kb / answered_by_kb_count, 3)
                if answered_by_kb_count
                else 0
            ),
            "order_id_mismatch_detected": f"{order_id_flag_hits}/{len(ORDER_ID_MISMATCH_TICKETS)}",
            "sop_price_drift_violations": sop_drift_violations,
        },
        "qtype_confusion": {k: dict(v) for k, v in qtype_confusion.items()},
    }


def main() -> None:
    gt = load_ground_truth()
    py_csv = OUT / "drafted_replies.csv"
    if not py_csv.exists():
        raise SystemExit("Run python batch_replay.py first.")
    preds = load_predictions(py_csv)
    result = score(preds, gt, label="python_chromadb")

    RESULTS.mkdir(parents=True, exist_ok=True)
    out_path = RESULTS / "python_baseline.json"
    out_path.write_text(json.dumps(result, indent=2))

    m = result["metrics"]
    print(f"=== Python pipeline (ChromaDB semantic retrieval) — n={result['n']} ===")
    print(f"  question_type accuracy:        {m['qtype_accuracy']:.1%}")
    print(f"  buyer_persona accuracy:        {m['persona_accuracy']:.1%}")
    print(f"  route match (human vs auto):   {m['route_match_rate']:.1%}")
    print(f"  KB recall when answerable:     {m['kb_recall_when_answerable']:.1%}")
    print(f"  order_id mismatch detected:    {m['order_id_mismatch_detected']}")
    print(f"  SOP price drift violations:    {m['sop_price_drift_violations']}")
    print(f"\nWrote {out_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
