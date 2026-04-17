"""Density statistics + tail metrics.

Ported from RND.py §compute_stats (line 429-441) and §compute_tail_metrics
(line 444-498). Operates on a discrete density on a strike grid.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass
class DensityStats:
    mean: float
    median: float
    mode: float
    std_dev: float
    skewness: float
    kurtosis: float
    prob_above_spot: float
    prob_below_spot: float
    p5: float
    p95: float


def compute_stats(
    k_grid: np.ndarray,
    density: np.ndarray,
    spot: float,
) -> DensityStats:
    """Moments, percentiles, and spot-threshold probabilities of the RND."""
    k = np.asarray(k_grid, dtype=float)
    p = np.asarray(density, dtype=float)

    mean = float(np.trapezoid(k * p, k))
    var = float(np.trapezoid((k - mean) ** 2 * p, k))
    std = float(np.sqrt(max(var, 0.0)))
    # Higher moments from centered-moment integrals
    if std > 0:
        skew = float(np.trapezoid((k - mean) ** 3 * p, k)) / (std**3)
        kurt = float(np.trapezoid((k - mean) ** 4 * p, k)) / (std**4) - 3.0
    else:
        skew = 0.0
        kurt = 0.0

    mode = float(k[int(np.argmax(p))])

    # CDF for percentile & threshold probs — cumulative trapezoid
    cdf_values = np.concatenate(
        [[0.0], np.cumsum(0.5 * (p[1:] + p[:-1]) * np.diff(k))]
    )
    # Normalize CDF to exactly 1 so percentile lookup is stable.
    total = cdf_values[-1] if cdf_values[-1] > 0 else 1.0
    cdf_values = cdf_values / total

    def invert_cdf(q: float) -> float:
        idx = int(np.searchsorted(cdf_values, q))
        idx = max(1, min(idx, len(k) - 1))
        y0, y1 = cdf_values[idx - 1], cdf_values[idx]
        x0, x1 = k[idx - 1], k[idx]
        if y1 - y0 <= 0:
            return float(x0)
        t = (q - y0) / (y1 - y0)
        return float(x0 + t * (x1 - x0))

    median = invert_cdf(0.5)
    p5 = invert_cdf(0.05)
    p95 = invert_cdf(0.95)

    # Probability thresholds
    def prob_above(threshold: float) -> float:
        mask = k >= threshold
        return float(np.trapezoid(p[mask], k[mask])) if mask.any() else 0.0

    prob_above_spot = prob_above(spot)
    prob_below_spot = max(0.0, 1.0 - prob_above_spot)

    return DensityStats(
        mean=mean,
        median=median,
        mode=mode,
        std_dev=std,
        skewness=skew,
        kurtosis=kurt,
        prob_above_spot=prob_above_spot,
        prob_below_spot=prob_below_spot,
        p5=p5,
        p95=p95,
    )


def prob_above_strike(
    k_grid: np.ndarray,
    density: np.ndarray,
    strike: float,
) -> float:
    """P[S_T >= strike]."""
    k = np.asarray(k_grid, dtype=float)
    p = np.asarray(density, dtype=float)
    mask = k >= strike
    if not mask.any():
        return 0.0
    return float(np.trapezoid(p[mask], k[mask]))


def prob_below_strike(
    k_grid: np.ndarray,
    density: np.ndarray,
    strike: float,
) -> float:
    return max(0.0, 1.0 - prob_above_strike(k_grid, density, strike))
