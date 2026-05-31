"""Theme clustering over processed tickets (offline job). Writes theme_clusters.json.

Clusters the CUSTOMER's words (subject + message), capped to a legible number of
themes, then asks the LLM for a label + marketing signal per cluster.
"""

from __future__ import annotations

import asyncio
from collections import Counter, defaultdict

import numpy as np
from sklearn.cluster import AgglomerativeClustering

from app.agent.runtime import load_prompt
from app.intelligence._io import load_run_rows, write_json
from app.llm.chat import get_chat_client
from app.llm.embeddings import get_embedding_client

MAX_CLUSTERS = 10
TARGET_PER_CLUSTER = 6
MIN_CLUSTER_SIZE = 2


def _cosine_distance_matrix(x: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(x, axis=1, keepdims=True)
    normed = x / np.clip(norms, 1e-9, None)
    return np.clip(1.0 - normed @ normed.T, 0.0, 2.0)


async def cluster() -> int:
    rows = await load_run_rows()
    if len(rows) < MIN_CLUSTER_SIZE:
        write_json("theme_clusters.json", [])
        return 0

    texts = [f"{r['subject']} — {(r['message_body'] or r['reply_draft'])[:400]}" for r in rows]
    embeddings = np.array(get_embedding_client().embed(texts), dtype=np.float32)
    distance = _cosine_distance_matrix(embeddings)

    k = max(3, min(MAX_CLUSTERS, round(len(rows) / TARGET_PER_CLUSTER)))
    labels = AgglomerativeClustering(
        n_clusters=k, metric="precomputed", linkage="average"
    ).fit_predict(distance)

    groups: dict[int, list[int]] = defaultdict(list)
    for i, lbl in enumerate(labels):
        groups[int(lbl)].append(i)

    chat = get_chat_client()
    records = []
    for cid, idxs in sorted(groups.items(), key=lambda kv: -len(kv[1])):
        members = [rows[i] for i in idxs]
        personas = Counter(m["buyer_persona"] for m in members)
        samples = [m["subject"] for m in members[:6]]
        meta = (
            _label(chat, samples, personas)
            if len(idxs) >= MIN_CLUSTER_SIZE
            else _singleton(samples)
        )
        records.append(
            {
                "cluster_id": cid,
                "size": len(idxs),
                **meta,
                "persona_breakdown": dict(personas),
                "question_type_breakdown": dict(Counter(m["question_type"] for m in members)),
                "sample_questions": samples,
                "ticket_ids": [m["ticket_id"] for m in members],
            }
        )
    write_json("theme_clusters.json", records)
    return len(records)


def _label(chat, samples: list[str], personas: Counter) -> dict:
    try:
        return chat.complete_json(
            "You label clusters of customer questions for a CS analytics tool.",
            load_prompt("theme_label").format(
                questions="\n".join(f"- {q}" for q in samples),
                persona_counts=", ".join(f"{p}={c}" for p, c in personas.most_common()),
            ),
            max_tokens=350,
        )
    except Exception as e:  # noqa: BLE001
        return {
            "theme_label": "Cluster",
            "theme_summary": f"(label failed: {e})",
            "marketing_signal": "",
            "suggested_action": "",
        }


def _singleton(samples: list[str]) -> dict:
    return {
        "theme_label": "Singleton / Novel",
        "theme_summary": samples[0] if samples else "",
        "marketing_signal": "Single occurrence — monitor for recurrence",
        "suggested_action": "",
    }


async def main() -> None:
    n = await cluster()
    print(f"[cluster_themes] wrote {n} clusters")


if __name__ == "__main__":
    asyncio.run(main())
