"""Compare Python (ChromaDB) and TS (BM25) pipelines side by side + per-class error breakdown."""
from __future__ import annotations

import csv
import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
RESULTS = ROOT / "evals" / "results"
OUT = ROOT / "outputs"


def load_gt() -> dict[str, dict]:
    out = {}
    with (DATA / "01_customer_tickets.csv").open() as f:
        for r in csv.DictReader(f):
            out[r["ticket_id"]] = r
    return out


def load_csv(p: Path) -> dict[str, dict]:
    out = {}
    with p.open() as f:
        for r in csv.DictReader(f):
            out[r["ticket_id"]] = r
    return out


def per_class_accuracy(gt: dict, preds: dict, field: str) -> dict[str, dict]:
    """Per-class accuracy + sample wrong examples."""
    correct: dict[str, int] = Counter()
    total: dict[str, int] = Counter()
    wrongs: dict[str, list[tuple[str, str]]] = defaultdict(list)
    for tid, g in gt.items():
        p = preds.get(tid)
        if not p: continue
        expected = g[field]
        actual = p.get(field, "")
        total[expected] += 1
        if expected == actual:
            correct[expected] += 1
        else:
            wrongs[expected].append((tid, actual))
    return {
        cls: {
            "correct": correct[cls],
            "total": total[cls],
            "accuracy": round(correct[cls] / total[cls], 3) if total[cls] else 0,
            "sample_misclass": wrongs[cls][:3],
        }
        for cls in sorted(total)
    }


def main() -> None:
    py = json.loads((RESULTS / "python_baseline.json").read_text())
    gt = load_gt()
    py_preds = load_csv(OUT / "drafted_replies.csv")

    print("=" * 70)
    print("PYTHON PIPELINE (5-persona taxonomy, keyword-aware, Strategy C)")
    print("=" * 70)
    m = py["metrics"]
    print(f"  question_type accuracy:        {m['qtype_accuracy']:.1%}")
    print(f"  buyer_persona accuracy:        {m['persona_accuracy']:.1%}")
    print(f"  route match (human vs auto):   {m['route_match_rate']:.1%}")
    print(f"  KB recall when answerable:     {m['kb_recall_when_answerable']:.1%}")
    print(f"  order_id mismatch detected:    {m['order_id_mismatch_detected']}")
    print(f"  SOP price drift violations:    {m['sop_price_drift_violations']}")

    print("\n" + "=" * 70)
    print("PER-CLASS question_type")
    print("=" * 70)
    pc = per_class_accuracy(gt, py_preds, "question_type")
    for cls, info in sorted(pc.items(), key=lambda kv: kv[1]["accuracy"]):
        print(f"  {cls:<22} {info['accuracy']:>6.1%}  ({info['correct']}/{info['total']})")
        for tid, wrong in info["sample_misclass"]:
            print(f"      ✗ {tid}  expected={cls:<20} got={wrong:<22} {gt[tid].get('subject','') if isinstance(gt[tid], dict) else ''}"[:120])

    print("\n" + "=" * 70)
    print("PER-CLASS buyer_persona (post-Strategy-C)")
    print("=" * 70)
    pc = per_class_accuracy(gt, py_preds, "buyer_persona")
    for cls, info in sorted(pc.items(), key=lambda kv: kv[1]["accuracy"]):
        print(f"  {cls:<22} {info['accuracy']:>6.1%}  ({info['correct']}/{info['total']})")
        for tid, wrong in info["sample_misclass"]:
            print(f"      ✗ {tid}  expected={cls:<18} got={wrong:<18}  legacy_gt={gt[tid].get('buyer_persona_legacy','?')}")


if __name__ == "__main__":
    main()
