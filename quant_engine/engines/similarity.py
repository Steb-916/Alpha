"""
Historical Similarity Engine

Finds past market states that most closely resemble the current state
using normalized Euclidean distance across a multi-dimensional feature vector.

Features used (all normalized to [0,1] before distance calculation):
  - healthScore    (0–100)
  - fundingRate    (clamped to ±0.01%)
  - priceChange1d  (% clamped to ±20%)
  - mvrvZScore     (clamped to ±4σ)
  - sopr           (0.8–1.3)
  - iv30d          (0–2.0 as fraction, i.e. 0–200% IV)
"""

from __future__ import annotations

import math
from typing import Optional


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _normalize(v: float | None, lo: float, hi: float) -> float | None:
    if v is None or math.isnan(v):
        return None
    return (_clamp(v, lo, hi) - lo) / (hi - lo)


FEATURE_BOUNDS: dict[str, tuple[float, float]] = {
    "healthScore":   (0.0, 100.0),
    "fundingRate":   (-0.001, 0.001),
    "priceChange1d": (-20.0, 20.0),
    "mvrvZScore":    (-4.0, 4.0),
    "sopr":          (0.8, 1.3),
    "iv30d":         (0.0, 2.0),
}


def _feature_vector(
    healthScore: float | None,
    fundingRate: float | None,
    priceChange1d: float | None,
    mvrvZScore: float | None,
    sopr: float | None,
    iv30d: float | None,
) -> dict[str, float | None]:
    raw = {
        "healthScore":   healthScore,
        "fundingRate":   fundingRate,
        "priceChange1d": priceChange1d,
        "mvrvZScore":    mvrvZScore,
        "sopr":          sopr,
        "iv30d":         iv30d,
    }
    return {k: _normalize(raw[k], *FEATURE_BOUNDS[k]) for k in raw}


def _distance(
    query: dict[str, float | None],
    candidate: dict[str, float | None],
) -> float:
    """
    Normalized Euclidean distance, ignoring dimensions where either vector
    has a missing value. Returns infinity if no shared dimensions.
    """
    total_sq = 0.0
    count = 0
    for k in query:
        q = query[k]
        c = candidate[k]
        if q is None or c is None:
            continue
        total_sq += (q - c) ** 2
        count += 1
    if count == 0:
        return math.inf
    return math.sqrt(total_sq / count)


def compute_similarity(
    current: dict,
    history: list[dict],
    top_n: int = 10,
) -> list[dict]:
    """
    Args:
        current: dict with optional keys matching FEATURE_BOUNDS + 'date', 'close'
        history: list of dicts, same shape + 'forwardReturns' (optional)
        top_n: how many nearest matches to return

    Returns:
        List of match dicts sorted by similarity distance (ascending).
    """
    query_vec = _feature_vector(
        healthScore=current.get("healthScore"),
        fundingRate=current.get("fundingRate"),
        priceChange1d=current.get("priceChange1d"),
        mvrvZScore=current.get("mvrvZScore"),
        sopr=current.get("sopr"),
        iv30d=current.get("iv30d"),
    )

    scored: list[tuple[float, dict]] = []
    for row in history:
        cand_vec = _feature_vector(
            healthScore=row.get("healthScore"),
            fundingRate=row.get("fundingRate"),
            priceChange1d=row.get("priceChange1d"),
            mvrvZScore=row.get("mvrvZScore"),
            sopr=row.get("sopr"),
            iv30d=row.get("iv30d"),
        )
        dist = _distance(query_vec, cand_vec)
        if not math.isinf(dist):
            scored.append((dist, row))

    scored.sort(key=lambda x: x[0])

    results = []
    for dist, row in scored[:top_n]:
        similarity_pct = max(0.0, round((1.0 - dist) * 100, 1))
        results.append({
            "date":          row.get("date"),
            "close":         row.get("close"),
            "distance":      round(dist, 4),
            "similarityPct": similarity_pct,
            "healthScore":   row.get("healthScore"),
            "fundingRate":   row.get("fundingRate"),
            "priceChange1d": row.get("priceChange1d"),
            "mvrvZScore":    row.get("mvrvZScore"),
            "sopr":          row.get("sopr"),
            "iv30d":         row.get("iv30d"),
            # Forward returns if provided by caller
            "fwd7d":         row.get("fwd7d"),
            "fwd14d":        row.get("fwd14d"),
            "fwd30d":        row.get("fwd30d"),
        })

    return results
