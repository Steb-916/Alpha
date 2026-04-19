"""Health score — Python port of scope-alpha/frontend/lib/market/health.ts.

Used ONLY by the Slice 1 backfill script to recompute health scores from
raw inputs across the 2y backtest window. The live path continues to use
the TS version directly; this port exists because persisted
HealthScoreSnapshot rows reflect an evolving formula (Phase 2 → Phase 4
gamma-regime → Phase 5 Slice 3 on-chain enrichment) and training the
classifier on mixed-formula history would drift feature semantics.

Keep in lockstep with the TS version. Any future health-formula change
updates both files and the feature-parity fixture in the same commit.
The parity test loads a shared fixture and asserts field-by-field equality.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Optional

# ─── Band configuration (mirrors config/healthScore.ts) ────────────────────

FUNDING_Z_BANDS = [
    (0.5, 25),
    (1.0, 22),
    (1.5, 17),
    (2.0, 11),
    (3.0, 5),
    (float("inf"), 1),
]

OI_CHANGE_BANDS = [
    (2, 25),
    (5, 22),
    (10, 17),
    (15, 11),
    (25, 6),
    (float("inf"), 2),
]

BASIS_BANDS = [
    (0.05, 25),
    (0.15, 22),
    (0.3, 17),
    (0.6, 11),
    (1.0, 6),
    (float("inf"), 2),
]

DEFAULT_COMPONENT_SCORE = 12
DEFAULT_LIQUIDATION_SCORE = 15

# Regime thresholds (legacy 5-band)
REGIME_THRESHOLDS = {"RISK_OFF": 25, "CAUTIOUS": 40, "NEUTRAL": 60, "RISK_ON": 80}


GammaRegime = Literal["positive_gamma", "negative_gamma"]
FlowRegime = Literal["accumulation", "distribution", "neutral"]
MVRVRegime = Literal["deep_value", "fair", "elevated", "euphoria"]


@dataclass
class OptionsRegimeInput:
    gamma_regime: Optional[GammaRegime] = None
    skew_25d: Optional[float] = None
    iv_percentile: Optional[float] = None


@dataclass
class OnChainRegimeInput:
    flow_regime: Optional[FlowRegime] = None
    mvrv_regime: Optional[MVRVRegime] = None


@dataclass
class LiquidationSnapshot:
    long_usd: float
    short_usd: float
    count: int
    ts: int  # ms epoch


@dataclass
class HealthScoreComponents:
    funding: int
    oi: int
    liquidation: int
    basis: int


@dataclass
class HealthScoreResult:
    score: float
    regime: str
    components: HealthScoreComponents


# ─── Band pickers ──────────────────────────────────────────────────────────


def _pick_score(value: float, bands: list[tuple[float, int]]) -> int:
    """Pick the score whose band's max is just above abs(value)."""
    abs_v = abs(value)
    for max_v, score in bands:
        if abs_v < max_v:
            return score
    return bands[-1][1]


# ─── Component scorers ────────────────────────────────────────────────────


def score_funding(z_score: Optional[float]) -> int:
    if z_score is None:
        return DEFAULT_COMPONENT_SCORE
    return _pick_score(z_score, FUNDING_Z_BANDS)


def score_oi(change_24h_pct: Optional[float]) -> int:
    if change_24h_pct is None:
        return DEFAULT_COMPONENT_SCORE
    return _pick_score(change_24h_pct, OI_CHANGE_BANDS)


def score_basis(current_basis_pct: Optional[float]) -> int:
    if current_basis_pct is None:
        return DEFAULT_COMPONENT_SCORE
    return _pick_score(current_basis_pct, BASIS_BANDS)


def score_liquidation(snap: Optional[LiquidationSnapshot]) -> int:
    """Liquidation imbalance → 0..25. Balanced = 25, fully one-sided = 0."""
    if snap is None:
        return DEFAULT_LIQUIDATION_SCORE
    total = snap.long_usd + snap.short_usd
    if total == 0:
        return DEFAULT_LIQUIDATION_SCORE
    long_share = snap.long_usd / total
    imbalance = abs(long_share - 0.5) * 2  # [0, 1]
    return max(0, round((1 - imbalance) * 25))


# ─── Regime label ──────────────────────────────────────────────────────────


def _regime_label(score: float) -> str:
    if score < REGIME_THRESHOLDS["RISK_OFF"]:
        return "Risk Off"
    if score < REGIME_THRESHOLDS["CAUTIOUS"]:
        return "Cautious"
    if score < REGIME_THRESHOLDS["NEUTRAL"]:
        return "Neutral"
    if score < REGIME_THRESHOLDS["RISK_ON"]:
        return "Risk On"
    return "Overheated"


# ─── Composite ────────────────────────────────────────────────────────────


def compute_health_score(
    *,
    funding_z_score: Optional[float],
    oi_change_24h_pct: Optional[float],
    basis_pct: Optional[float],
    liquidation: Optional[LiquidationSnapshot],
    options: Optional[OptionsRegimeInput] = None,
    onchain: Optional[OnChainRegimeInput] = None,
) -> HealthScoreResult:
    """Mirror of computeHealthScore in lib/market/health.ts.

    Returns composite score (0..100), regime label, and component breakdown.
    """
    funding_score = score_funding(funding_z_score)
    oi_score = score_oi(oi_change_24h_pct)
    liq_score = score_liquidation(liquidation)
    basis_score = score_basis(basis_pct)

    raw = funding_score + oi_score + liq_score + basis_score

    # Phase 4: gamma-regime adjustment
    if options is not None:
        if options.gamma_regime == "negative_gamma":
            if raw >= 50:
                raw += 3
            else:
                raw -= 3
        elif options.gamma_regime == "positive_gamma":
            if raw > 50:
                raw -= 1.5
            elif raw < 50:
                raw += 1.5

    # Phase 5 Slice 3: on-chain regime adjustment
    if onchain is not None:
        if onchain.flow_regime == "accumulation":
            raw += 3
        elif onchain.flow_regime == "distribution":
            raw -= 3
        # Asymmetric by design: euphoria historically precedes sharper
        # drawdowns than deep_value precedes rallies.
        if onchain.mvrv_regime == "deep_value":
            raw += 3
        elif onchain.mvrv_regime == "elevated":
            raw -= 2
        elif onchain.mvrv_regime == "euphoria":
            raw -= 5

    score = max(0.0, min(100.0, float(raw)))

    return HealthScoreResult(
        score=score,
        regime=_regime_label(score),
        components=HealthScoreComponents(
            funding=funding_score,
            oi=oi_score,
            liquidation=liq_score,
            basis=basis_score,
        ),
    )
