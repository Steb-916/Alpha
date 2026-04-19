"""Regime classifier — Phase 6 Slice 1.

Rules-based, interpretable, backtestable. Five regime states:
  trending_bull, trending_bear, range_bound, volatility_expansion, capitulation.

Three-tier feature vector:
  Tier 1 (deep history, primary weight): funding percentile, OI change, liq
    intensity, basis percentile, health score, MVRV regime/z-score.
  Tier 2 (medium history, secondary): IV percentile, 25d skew, VRP sign.
  Tier 3 (shallow history, modifier only): GEX regime, flow regime,
    whale intensity.

The Tier-1 features drive classification. Tier 2 and 3 modulate confidence
but never override a Tier-1-supported label. Missing Tier 2/3 features
degrade the confidence score gracefully — they do not change the label.

Thresholds are named module constants so calibration is a one-place edit.
Phase 6 ships with first-pass values; expect tuning in the backtest review.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Optional

# ─── Typed regime + label contracts ────────────────────────────────────────

RegimeLabel = Literal[
    "trending_bull",
    "trending_bear",
    "range_bound",
    "volatility_expansion",
    "capitulation",
]

MVRVRegimeLabel = Literal["deep_value", "fair", "elevated", "euphoria"]
FlowRegimeLabel = Literal["accumulation", "distribution", "neutral"]
GEXRegimeLabel = Literal["positive", "negative"]
VRPSign = Literal["positive", "negative"]

ALL_REGIMES: tuple[RegimeLabel, ...] = (
    "trending_bull",
    "trending_bear",
    "range_bound",
    "volatility_expansion",
    "capitulation",
)


@dataclass
class RegimeFeatureVector:
    """Per-hour feature snapshot. See module docstring for tier definitions."""

    asset: str
    timestamp: str  # ISO-8601 UTC; Python side stays timezone-explicit

    # ── Tier 1 — deep history, primary weight ──────────────────────────────
    funding_percentile_30d: float  # [0, 1]
    oi_change_7d: float            # signed fraction; 0.05 = +5%
    liquidation_intensity_24h: float  # [0, 1] percentile vs trailing 90d
    basis_percentile: float        # [0, 1]
    health_score: float            # [0, 100]
    mvrv_regime: Optional[MVRVRegimeLabel] = None
    mvrv_z_score: Optional[float] = None

    # ── Tier 2 — medium history, secondary weight ──────────────────────────
    iv_percentile: Optional[float] = None      # [0, 1]
    skew_25d: Optional[float] = None           # signed
    vrp_sign: Optional[VRPSign] = None

    # ── Tier 3 — shallow history, modifier weight only ─────────────────────
    gex_regime: Optional[GEXRegimeLabel] = None
    flow_regime: Optional[FlowRegimeLabel] = None
    whale_intensity_24h: Optional[float] = None  # [0, 1]


@dataclass
class FeatureSupport:
    supporting: list[str] = field(default_factory=list)
    neutral: list[str] = field(default_factory=list)
    conflicting: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, list[str]]:
        return {
            "supporting": list(self.supporting),
            "neutral": list(self.neutral),
            "conflicting": list(self.conflicting),
        }


@dataclass
class RegimeClassification:
    asset: str
    raw_classification: RegimeLabel
    committed_regime: RegimeLabel
    regime_changed: bool
    confidence: float
    feature_support: FeatureSupport
    reasoning: str


# ─── Thresholds ─────────────────────────────────────────────────────────────
# Named so the backtest calibration edits them in one place.

# Tail: capitulation
CAPITULATION_LIQ_INTENSITY = 0.95

# Tail: volatility expansion
VOL_EXPANSION_IV_PERCENTILE = 0.80
VOL_EXPANSION_FUNDING_PERCENTILE = 0.92

# Directional score thresholds
BULL_SCORE_MIN = 4
BEAR_SCORE_MIN = 4
DIRECTIONAL_MARGIN = 2

# Individual directional-score contributors (bull / bear symmetric unless noted)
HEALTH_BULL_THRESHOLD = 60
HEALTH_BEAR_THRESHOLD = 40
FUNDING_BULL_PERCENTILE = 0.55
FUNDING_BEAR_PERCENTILE = 0.45
OI_BULL_CHANGE = 0.05
OI_BEAR_CHANGE = -0.05


# ─── Classifier ────────────────────────────────────────────────────────────


def classify_regime(fv: RegimeFeatureVector) -> RegimeLabel:
    """Map a feature vector to one of five regime labels.

    Order of evaluation matters:
      1. capitulation (rare tail — catch it before directional rules fire)
      2. volatility_expansion (elevated vol preempts directional calls)
      3. trending_bull / trending_bear (directional score race)
      4. range_bound (default when no directional consensus)
    """
    # ── Tail: capitulation ────────────────────────────────────────────────
    if (
        (fv.liquidation_intensity_24h or 0) > CAPITULATION_LIQ_INTENSITY
        and fv.mvrv_regime == "deep_value"
    ):
        return "capitulation"

    # ── Tail: volatility expansion ─────────────────────────────────────────
    iv_elevated = fv.iv_percentile is not None and fv.iv_percentile > VOL_EXPANSION_IV_PERCENTILE
    funding_elevated = fv.funding_percentile_30d > VOL_EXPANSION_FUNDING_PERCENTILE
    if iv_elevated or funding_elevated:
        return "volatility_expansion"

    # ── Directional score ─────────────────────────────────────────────────
    bull_score = 0
    bear_score = 0

    if fv.health_score > HEALTH_BULL_THRESHOLD:
        bull_score += 2
    elif fv.health_score < HEALTH_BEAR_THRESHOLD:
        bear_score += 2

    if fv.funding_percentile_30d > FUNDING_BULL_PERCENTILE:
        bull_score += 1
    elif fv.funding_percentile_30d < FUNDING_BEAR_PERCENTILE:
        bear_score += 1

    if fv.oi_change_7d > OI_BULL_CHANGE:
        bull_score += 1
    elif fv.oi_change_7d < OI_BEAR_CHANGE:
        bear_score += 1

    if fv.flow_regime == "accumulation":
        bull_score += 2
    elif fv.flow_regime == "distribution":
        bear_score += 2

    # MVRV acts as a mild contrarian tilt at the extremes
    if fv.mvrv_regime == "euphoria":
        bear_score += 1
    elif fv.mvrv_regime == "deep_value":
        bull_score += 1

    if bull_score >= BULL_SCORE_MIN and bull_score > bear_score + DIRECTIONAL_MARGIN:
        return "trending_bull"
    if bear_score >= BEAR_SCORE_MIN and bear_score > bull_score + DIRECTIONAL_MARGIN:
        return "trending_bear"

    return "range_bound"


# ─── Feature-support expectations (drives confidence) ──────────────────────
#
# For each regime, list the features whose values should match a given
# direction to "support" that regime. Missing features contribute nothing
# (neither support nor conflict).
#
# Each expectation is a (feature_name, predicate) pair where predicate
# takes the feature value and returns True if the feature supports the
# regime, False if it conflicts.

from typing import Any, Callable

Predicate = Callable[[Any], bool]


def _nonnull(fn: Predicate) -> Predicate:
    def wrapped(v: Any) -> bool:
        return v is not None and fn(v)

    return wrapped


REGIME_FEATURE_EXPECTATIONS: dict[RegimeLabel, dict[str, Predicate]] = {
    "trending_bull": {
        "health_score": lambda v: v > HEALTH_BULL_THRESHOLD,
        "funding_percentile_30d": lambda v: v > FUNDING_BULL_PERCENTILE,
        "oi_change_7d": lambda v: v > OI_BULL_CHANGE,
        "flow_regime": _nonnull(lambda v: v == "accumulation"),
        "mvrv_regime": _nonnull(lambda v: v in ("deep_value", "fair")),
        "iv_percentile": _nonnull(lambda v: v < 0.7),  # not yet fear-pricing
        "gex_regime": _nonnull(lambda v: v == "positive"),
    },
    "trending_bear": {
        "health_score": lambda v: v < HEALTH_BEAR_THRESHOLD,
        "funding_percentile_30d": lambda v: v < FUNDING_BEAR_PERCENTILE,
        "oi_change_7d": lambda v: v < OI_BEAR_CHANGE,
        "flow_regime": _nonnull(lambda v: v == "distribution"),
        "mvrv_regime": _nonnull(lambda v: v in ("elevated", "euphoria")),
        "gex_regime": _nonnull(lambda v: v == "negative"),
    },
    "range_bound": {
        "funding_percentile_30d": lambda v: 0.4 <= v <= 0.6,
        "oi_change_7d": lambda v: abs(v) < OI_BULL_CHANGE,
        "iv_percentile": _nonnull(lambda v: v < 0.5),
        "flow_regime": _nonnull(lambda v: v == "neutral"),
    },
    "volatility_expansion": {
        "iv_percentile": _nonnull(lambda v: v > VOL_EXPANSION_IV_PERCENTILE),
        "funding_percentile_30d": lambda v: v > 0.75 or v < 0.25,
        "oi_change_7d": lambda v: abs(v) > 0.08,
    },
    "capitulation": {
        "liquidation_intensity_24h": lambda v: (v or 0) > CAPITULATION_LIQ_INTENSITY,
        "mvrv_regime": _nonnull(lambda v: v == "deep_value"),
        "health_score": lambda v: v < 25,
        "funding_percentile_30d": lambda v: v < 0.1,
    },
}


def compute_confidence(
    fv: RegimeFeatureVector,
    regime: RegimeLabel,
) -> tuple[float, FeatureSupport]:
    """Compute feature-support fraction for the classified regime.

    Returns (confidence in [0, 1], FeatureSupport breakdown).
    Features absent from the vector (None) are counted as neutral — they
    don't support or conflict. A regime with zero applicable features gets
    confidence 0 (shouldn't happen in practice for any of the 5 regimes).
    """
    expectations = REGIME_FEATURE_EXPECTATIONS.get(regime, {})
    support = FeatureSupport()

    for feature_name, predicate in expectations.items():
        value = getattr(fv, feature_name, None)
        if value is None:
            support.neutral.append(feature_name)
            continue
        try:
            if predicate(value):
                support.supporting.append(feature_name)
            else:
                support.conflicting.append(feature_name)
        except Exception:
            # Predicate failure (e.g., unexpected type) — treat as neutral.
            support.neutral.append(feature_name)

    available = len(support.supporting) + len(support.conflicting)
    if available == 0:
        return 0.0, support
    return len(support.supporting) / available, support


# ─── Persistence filter ────────────────────────────────────────────────────
#
# Raw classifier output flips on boundary crossings. Confirm regime changes
# with 2-of-2 consecutive agreement before committing, per PRD §3.5.
# Capitulation is the one exception — tail events commit immediately.
#
# Bootstrap behavior: when `prev_committed` is None (first observation for
# this asset), the raw classification commits directly. The 2-of-2 rule
# starts applying at the second observation.


@dataclass
class PersistenceFilterResult:
    committed_regime: RegimeLabel
    regime_changed: bool


def apply_persistence_filter(
    raw: RegimeLabel,
    prev_raw: Optional[RegimeLabel],
    prev_committed: Optional[RegimeLabel],
) -> PersistenceFilterResult:
    """Decide whether to commit a regime change this hour.

    Bootstrap: prev_committed is None → commit raw directly (first obs).
    Capitulation: raw == "capitulation" && prev_committed != "capitulation"
      → commit immediately (exception to the 2-of-2 rule).
    Same as prev_committed: no change.
    Different: only commit if prev_raw == raw (two consecutive observations
      agree on the new regime).
    """
    if prev_committed is None:
        return PersistenceFilterResult(committed_regime=raw, regime_changed=False)

    if raw == prev_committed:
        return PersistenceFilterResult(committed_regime=raw, regime_changed=False)

    # Capitulation bypass
    if raw == "capitulation":
        return PersistenceFilterResult(committed_regime=raw, regime_changed=True)

    # Need 2-of-2 agreement to commit a non-capitulation regime change.
    if prev_raw == raw:
        return PersistenceFilterResult(committed_regime=raw, regime_changed=True)

    # Single-hour excursion — hold the previous regime.
    return PersistenceFilterResult(
        committed_regime=prev_committed, regime_changed=False
    )


# ─── Reasoning blurb ───────────────────────────────────────────────────────


def build_reasoning(
    committed: RegimeLabel,
    raw: RegimeLabel,
    support: FeatureSupport,
    regime_changed: bool,
    prev_committed: Optional[RegimeLabel],
) -> str:
    parts: list[str] = []
    n_support = len(support.supporting)
    n_conflict = len(support.conflicting)
    parts.append(
        f"Classified as {committed} with {n_support} supporting and "
        f"{n_conflict} conflicting features."
    )
    if raw != committed:
        parts.append(
            f"Raw classification was {raw}; persistence filter holds prior "
            f"regime until next observation agrees."
        )
    if regime_changed and prev_committed is not None:
        parts.append(f"Regime transitioned from {prev_committed}.")
    return " ".join(parts)


def classify_with_context(
    fv: RegimeFeatureVector,
    prev_raw: Optional[RegimeLabel] = None,
    prev_committed: Optional[RegimeLabel] = None,
) -> RegimeClassification:
    """Full classifier entry point: raw → persistence-filter → confidence."""
    raw = classify_regime(fv)
    pf = apply_persistence_filter(raw, prev_raw, prev_committed)
    confidence, support = compute_confidence(fv, pf.committed_regime)
    reasoning = build_reasoning(
        pf.committed_regime, raw, support, pf.regime_changed, prev_committed
    )
    return RegimeClassification(
        asset=fv.asset,
        raw_classification=raw,
        committed_regime=pf.committed_regime,
        regime_changed=pf.regime_changed,
        confidence=confidence,
        feature_support=support,
        reasoning=reasoning,
    )
