"""Density confidence scoring.

Adapted from RND.py §compute_confidence_score (line 501-555). Removes the
"off-hours" penalty (crypto trades 24/7) and maps the final 0-100 score to
the TS-contract enum ("good" / "fair" / "poor" / "failed").
"""

from __future__ import annotations

from typing import Literal

Quality = Literal["good", "fair", "poor", "failed"]


def compute_confidence_score(
    mass: float,
    forward_error_pct: float | None,
    n_strikes_used: int,
    retention_pct: float,
    avg_spread_ratio: float | None = None,
) -> tuple[float, Quality]:
    """Return (score, quality_label).

    Args:
        mass: Integrated density. Ideal = 1.0.
        forward_error_pct: |E[S_T] - spot| / spot * 100, or None if unknown.
        n_strikes_used: Number of strikes that survived filtering.
        retention_pct: Percent of raw quotes kept after filtering.
        avg_spread_ratio: Mean (ask-bid)/mid, or None if unknown.
    """
    score = 100.0

    # Mass deviation from 1.0 is the strongest signal that the density is
    # mal-formed — spline misfit, wing underflow, etc.
    mass_err = abs(mass - 1.0)
    score -= min(40.0, mass_err * 100.0)  # 1% error → -1 point; 40% error → -40

    # Forward error — compares density mean to market forward price
    if forward_error_pct is not None:
        score -= min(20.0, abs(forward_error_pct) * 4.0)

    # Strike count — need enough strikes for a well-determined spline
    if n_strikes_used < 10:
        score -= (10 - n_strikes_used) * 3.0  # up to -30 for ≤0 strikes

    # Retention — high drop rate means the raw chain was junky
    if retention_pct < 70:
        score -= (70 - retention_pct) * 0.3

    # Spread quality — wide spreads = uncertain fair values
    if avg_spread_ratio is not None and avg_spread_ratio > 0.2:
        score -= min(10.0, (avg_spread_ratio - 0.2) * 50.0)

    score = max(0.0, min(100.0, score))

    if score >= 75:
        quality: Quality = "good"
    elif score >= 50:
        quality = "fair"
    elif score > 0:
        quality = "poor"
    else:
        quality = "failed"

    return score, quality
