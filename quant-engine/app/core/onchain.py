"""On-chain derived metrics — Phase 5.

MVRV z-score is the only fully-implemented computation in Slice 1. SOPR,
NVT, and flow-regime land in Slice 2.

Design notes:
- All computations are pure functions of a time series. No external calls.
- The MVRV z-score windows on the requested `lookback_days` (default 1460 ≈ 4
  years) for a stable distribution. Shorter windows produce hot/cold z-scores
  that bounce around. Caller is responsible for sending enough history.
- Regime bands are fixed (deep_value / fair / elevated / euphoria). These
  are heuristic cutoffs — they'll need recalibration once Phase 6 can score
  regime-labelled forward returns against realized outcomes.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal, Sequence

import numpy as np

MVRVRegime = Literal["deep_value", "fair", "elevated", "euphoria"]


@dataclass
class MVRVPoint:
    timestamp: str
    mvrv: float


@dataclass
class MVRVSeriesPointResult:
    timestamp: str
    mvrv: float
    z_score: float
    regime: MVRVRegime


@dataclass
class MVRVForwardReturns:
    median_90d: float
    p25_90d: float
    p75_90d: float


@dataclass
class MVRVResult:
    current_mvrv: float
    current_z_score: float
    current_regime: MVRVRegime
    historical_percentile: float
    interpretation: str
    series: list[MVRVSeriesPointResult]
    forward_return_distribution: MVRVForwardReturns | None


def classify_regime(z: float) -> MVRVRegime:
    """Fixed-cutoff classifier. Inputs outside the bands clamp to extremes."""
    if z < -1.0:
        return "deep_value"
    if z < 0.5:
        return "fair"
    if z < 2.5:
        return "elevated"
    return "euphoria"


def _percentile_of_score(values: np.ndarray, target: float) -> float:
    """Fraction of `values` strictly below `target`. Returns [0, 1]."""
    if values.size == 0:
        return 0.0
    return float(np.sum(values < target) / values.size)


def _rolling_z_scores(
    mvrv: np.ndarray,
    lookback: int,
) -> np.ndarray:
    """Per-point z-score using an expanding window up to `lookback` days.

    Early values (< 30 days of history) return 0.0 — they're not meaningful
    and we'd rather plot a flat line than noise. Values at or after the
    lookback window use a full trailing window.
    """
    n = mvrv.size
    out = np.zeros(n, dtype=float)
    if n == 0:
        return out
    min_window = 30
    for i in range(n):
        start = max(0, i + 1 - lookback)
        window = mvrv[start : i + 1]
        if window.size < min_window:
            out[i] = 0.0
            continue
        mean = float(np.mean(window))
        std = float(np.std(window, ddof=1)) if window.size > 1 else 0.0
        if std == 0.0:
            out[i] = 0.0
        else:
            out[i] = (mvrv[i] - mean) / std
    return out


def _forward_return_distribution(
    mvrv: np.ndarray,
    z_scores: np.ndarray,
    current_regime: MVRVRegime,
    horizon: int = 90,
) -> MVRVForwardReturns | None:
    """Distribution of 90-day forward MVRV change from same-regime historical moments.

    This is a weak proxy — ideally we'd score forward *price* returns, not
    MVRV-change. Phase 6 will upgrade this by pairing the series with
    price. For Slice 1 this lets the UI surface a plausibility band.
    """
    if mvrv.size < horizon + 30:
        return None
    forward = np.zeros_like(mvrv)
    for i in range(mvrv.size - horizon):
        forward[i] = (mvrv[i + horizon] - mvrv[i]) / max(abs(mvrv[i]), 1e-9)
    forward[mvrv.size - horizon :] = np.nan

    regime_mask = np.array(
        [classify_regime(float(z)) == current_regime for z in z_scores],
        dtype=bool,
    )
    # Only consider points whose forward window exists (i.e., not NaN).
    valid = regime_mask & ~np.isnan(forward)
    sample = forward[valid]
    if sample.size < 5:
        return None
    return MVRVForwardReturns(
        median_90d=float(np.median(sample)),
        p25_90d=float(np.quantile(sample, 0.25)),
        p75_90d=float(np.quantile(sample, 0.75)),
    )


def _interpretation(
    z: float,
    regime: MVRVRegime,
    percentile: float,
    fwd: MVRVForwardReturns | None,
) -> str:
    pct_text = f"top {int((1 - percentile) * 100)}%" if percentile > 0.5 else f"bottom {int(percentile * 100)}%"
    base = f"MVRV z-score at {z:.2f} places this asset in the {regime.replace('_', ' ')} band ({pct_text} historically)."
    if fwd is None:
        return base
    median_pct = fwd.median_90d * 100
    return (
        f"{base} Forward 90-day MVRV moves from this regime have a median of "
        f"{median_pct:+.1f}% (p25 {fwd.p25_90d * 100:+.1f}%, p75 {fwd.p75_90d * 100:+.1f}%)."
    )


def compute_mvrv_z(
    series: Sequence[MVRVPoint],
    lookback_days: int,
) -> MVRVResult | None:
    """Compute MVRV z-score series + current snapshot.

    Returns None if the input is too short to produce a meaningful z-score
    (< 30 observations) — the route wraps None as an empty-output response
    with `quality: "failed"` equivalent on the TS side.
    """
    if len(series) < 30:
        return None

    mvrv = np.array([p.mvrv for p in series], dtype=float)
    if not np.all(np.isfinite(mvrv)):
        return None

    z_scores = _rolling_z_scores(mvrv, lookback_days)

    # Series: zip raw MVRV with rolling z-scores and regime labels.
    series_out: list[MVRVSeriesPointResult] = []
    for i, pt in enumerate(series):
        z = float(z_scores[i])
        series_out.append(
            MVRVSeriesPointResult(
                timestamp=pt.timestamp,
                mvrv=float(mvrv[i]),
                z_score=z,
                regime=classify_regime(z),
            )
        )

    current_z = float(z_scores[-1])
    current_regime = classify_regime(current_z)
    current_mvrv = float(mvrv[-1])

    window_slice = mvrv[max(0, mvrv.size - lookback_days) :]
    historical_percentile = _percentile_of_score(window_slice, current_mvrv)

    fwd = _forward_return_distribution(mvrv, z_scores, current_regime)
    interpretation = _interpretation(current_z, current_regime, historical_percentile, fwd)

    return MVRVResult(
        current_mvrv=current_mvrv,
        current_z_score=current_z,
        current_regime=current_regime,
        historical_percentile=historical_percentile,
        interpretation=interpretation,
        series=series_out,
        forward_return_distribution=fwd,
    )


def now_iso_utc() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


# ─── Flow regime classifier ────────────────────────────────────────────────
#
# Exchange-netflow regime from a daily net-flow USD series. Classification is
# based on recent flow direction + magnitude relative to a trailing baseline:
#
#   accumulation — sustained net outflow significantly below baseline
#   distribution — sustained net inflow significantly above baseline
#   neutral      — small net flow or conflicting short/mid windows
#
# The baseline is the trailing 90d mean absolute net flow. "Significantly"
# means |recent net flow| > 1.5x baseline. 7d and 30d windows must agree on
# sign for a non-neutral call; disagreement forces neutral regardless of
# magnitude. Confidence scales with the 30d magnitude ratio.


FlowRegime_ = Literal["accumulation", "distribution", "neutral"]


@dataclass
class FlowRegimePoint:
    timestamp: str
    net_flow_usd: float


@dataclass
class FlowRegimeResult:
    regime: FlowRegime_
    regime_confidence: float
    net_flow_7d_usd: float
    net_flow_30d_usd: float
    baseline_net_flow_90d_usd: float
    interpretation: str
    historical_regime_distribution: dict[str, float]


MAGNITUDE_MULTIPLIER = 1.5  # |net flow| vs baseline to clear neutral
MIN_HISTORY_DAYS = 35  # enough to have a 30d window + a few days of baseline
BASELINE_WINDOW_DAYS = 90
WINDOW_7D = 7
WINDOW_30D = 30
MIN_HISTORICAL_FOR_DISTRIBUTION = 120  # backfill regime counts only with enough data


def _classify_flow(
    net_7d: float,
    net_30d: float,
    baseline: float,
) -> tuple[FlowRegime_, float]:
    """Return (regime, confidence in [0, 1]).

    Regime requires short/mid windows to agree on sign and the 30d magnitude
    to clear baseline × MAGNITUDE_MULTIPLIER. Confidence is a soft ratio of
    30d magnitude to baseline, capped at 1.0.
    """
    if baseline <= 0:
        return "neutral", 0.0
    threshold = baseline * MAGNITUDE_MULTIPLIER

    # Disagreement between windows → neutral regardless of size.
    if (net_7d > 0) != (net_30d > 0) and net_7d != 0 and net_30d != 0:
        return "neutral", 0.0

    magnitude = abs(net_30d)
    if magnitude < threshold:
        return "neutral", float(min(magnitude / max(threshold, 1e-9), 1.0) * 0.5)

    confidence = float(min(magnitude / (baseline * 3.0), 1.0))
    if net_30d < 0:
        return "accumulation", confidence
    return "distribution", confidence


def _historical_regime_distribution(
    net_flows: np.ndarray,
) -> dict[str, float]:
    """Share of days classified in each regime across the input window.

    Uses a rolling per-day classification: for each day i, compute its own
    (7d, 30d, 90d) windows ending at i and classify. Days that don't have
    enough trailing history contribute to "neutral". Returns counts
    normalized to sum to 1.0.
    """
    n = net_flows.size
    counts = {"accumulation": 0, "distribution": 0, "neutral": 0}
    if n < MIN_HISTORICAL_FOR_DISTRIBUTION:
        # With tiny history, don't try to claim a distribution.
        return {"accumulation": 0.0, "distribution": 0.0, "neutral": 1.0}

    for i in range(n):
        start_90 = max(0, i + 1 - BASELINE_WINDOW_DAYS)
        start_30 = max(0, i + 1 - WINDOW_30D)
        start_7 = max(0, i + 1 - WINDOW_7D)
        window_90 = net_flows[start_90 : i + 1]
        if window_90.size < MIN_HISTORY_DAYS:
            counts["neutral"] += 1
            continue
        baseline = float(np.mean(np.abs(window_90)))
        net_30 = float(np.sum(net_flows[start_30 : i + 1]))
        net_7 = float(np.sum(net_flows[start_7 : i + 1]))
        regime, _ = _classify_flow(net_7, net_30, baseline)
        counts[regime] += 1

    total = sum(counts.values()) or 1
    return {k: v / total for k, v in counts.items()}


def _flow_interpretation(
    regime: FlowRegime_,
    net_30d: float,
    baseline: float,
) -> str:
    ratio = abs(net_30d) / max(baseline, 1e-9)
    ratio_text = f"{ratio:.1f}x baseline" if baseline > 0 else "unknown vs baseline"
    if regime == "accumulation":
        return (
            f"Sustained net outflow over 30 days at {ratio_text}. "
            "Consistent with an accumulation regime: coins leaving exchanges "
            "historically precedes reduced sell-side liquidity."
        )
    if regime == "distribution":
        return (
            f"Sustained net inflow over 30 days at {ratio_text}. "
            "Consistent with a distribution regime: coins arriving at "
            "exchanges historically precedes increased sell-side liquidity."
        )
    return (
        "No clear flow regime detected. Either the 7d and 30d windows "
        "disagree, or net flow magnitude is within the baseline noise band."
    )


def compute_flow_regime(
    series: Sequence[FlowRegimePoint],
) -> FlowRegimeResult | None:
    """Classify the current exchange-flow regime from a daily netflow series.

    Returns None when the input is too short to baseline meaningfully
    (< MIN_HISTORY_DAYS days). Route wraps None as an empty-output response.
    """
    if len(series) < MIN_HISTORY_DAYS:
        return None

    net_flows = np.array([p.net_flow_usd for p in series], dtype=float)
    if not np.all(np.isfinite(net_flows)):
        return None

    net_7d = float(np.sum(net_flows[-WINDOW_7D:]))
    net_30d = float(np.sum(net_flows[-WINDOW_30D:]))
    window_90 = net_flows[-BASELINE_WINDOW_DAYS:]
    baseline = float(np.mean(np.abs(window_90))) if window_90.size > 0 else 0.0

    regime, confidence = _classify_flow(net_7d, net_30d, baseline)
    distribution = _historical_regime_distribution(net_flows)
    interpretation = _flow_interpretation(regime, net_30d, baseline)

    return FlowRegimeResult(
        regime=regime,
        regime_confidence=confidence,
        net_flow_7d_usd=net_7d,
        net_flow_30d_usd=net_30d,
        baseline_net_flow_90d_usd=baseline,
        interpretation=interpretation,
        historical_regime_distribution=distribution,
    )
