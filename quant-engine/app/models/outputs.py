"""Pydantic output models for the Quant Engine.

Shapes mirror types/options.ts. Where the TS contract and the source PRD
disagree, the TS contract wins. Extensions (e.g., tail_metrics block)
stay out of the returned payload until the TS side is extended too.

On compute failure, routes return a structurally-valid instance with
empty arrays and `quality: "failed"` — never a 500. The TS client maps
non-2xx to null, which surfaces as an Unavailable banner in the UI.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel


Quality = Literal["good", "fair", "poor", "failed"]
TermStructureShape = Literal["contango", "backwardation", "flat"]


# ─── Vol Surface ───────────────────────────────────────────────────────────


class VolSurfacePoint(BaseModel):
    strike: float
    delta: float
    expiry_days: int
    expiry_date: str
    raw_iv: float
    fitted_iv: float
    residual: float


class VolSurfaceFitQuality(BaseModel):
    rmse: float
    max_residual: float
    method: str


class ATMByExpiry(BaseModel):
    expiry_days: int
    atm_iv: float


class Skew25dByExpiry(BaseModel):
    expiry_days: int
    skew_25d: float


class VolSurfaceSummary(BaseModel):
    atm_iv_by_expiry: list[ATMByExpiry]
    skew_25d_by_expiry: list[Skew25dByExpiry]


class VolSurfaceOutput(BaseModel):
    asset: str
    spot_price: float
    surface: list[VolSurfacePoint]
    fit_quality: VolSurfaceFitQuality
    summary: VolSurfaceSummary
    computed_at: str


# ─── RND ───────────────────────────────────────────────────────────────────


class DensityPoint(BaseModel):
    price: float
    probability: float


class RNDStatistics(BaseModel):
    mean: float
    median: float
    mode: float
    std_dev: float
    skewness: float
    kurtosis: float
    prob_above_spot: float
    prob_below_80k: float
    prob_above_90k: float


class RNDConfidence(BaseModel):
    method: str
    n_options_used: int
    strike_range: tuple[float, float]
    quality: Quality


class RNDOutput(BaseModel):
    asset: str
    expiry_date: str
    expiry_days: int
    spot_price: float
    density: list[DensityPoint]
    statistics: RNDStatistics
    confidence: RNDConfidence


# ─── Vol Cone ──────────────────────────────────────────────────────────────


class VolConePercentiles(BaseModel):
    p10: float
    p25: float
    p50: float
    p75: float
    p90: float


class VolConeWindow(BaseModel):
    days: int
    current_rv: float
    percentiles: VolConePercentiles


class VolConeOutput(BaseModel):
    asset: str
    windows: list[VolConeWindow]
    current_atm_iv: float
    iv_percentile_vs_rv30d: float
    assessment: str


# ─── VRP ───────────────────────────────────────────────────────────────────


class VRPSeriesPoint(BaseModel):
    date: str
    vrp: float
    iv: float
    rv: float


class VRPOutput(BaseModel):
    asset: str
    current_vrp: float
    current_vrp_percentile: float
    vrp_series: list[VRPSeriesPoint]
    assessment: str
    mean_vrp: float
    std_vrp: float


# ─── Skew ──────────────────────────────────────────────────────────────────


class SmilePoint(BaseModel):
    delta: float
    iv: float


class SkewByExpiry(BaseModel):
    expiry_date: str
    expiry_days: int
    skew_25d: float
    skew_10d: float
    skew_5d: float
    put_iv_25d: float
    call_iv_25d: float
    atm_iv: float
    smile: list[SmilePoint]


class TermStructurePoint(BaseModel):
    expiry_days: int
    atm_iv: float


class SkewOutput(BaseModel):
    asset: str
    by_expiry: list[SkewByExpiry]
    term_structure: list[TermStructurePoint]
    term_structure_shape: TermStructureShape


# ─── Phase 5 — On-chain derived metrics ───────────────────────────────────


MVRVRegime = Literal["deep_value", "fair", "elevated", "euphoria"]
SOPRState = Literal["profit_taking", "neutral", "capitulation", "recovery"]
NVTRegimeT = Literal["cheap", "fair", "overvalued"]
FlowRegimeT = Literal["accumulation", "distribution", "neutral"]


class MVRVSeriesPointOutput(BaseModel):
    timestamp: str
    mvrv: float
    z_score: float
    regime: MVRVRegime


class MVRVForwardReturns(BaseModel):
    median_90d: float
    p25_90d: float
    p75_90d: float


class MVRVCurrent(BaseModel):
    mvrv: float
    z_score: float
    regime: MVRVRegime
    historical_percentile: float
    interpretation: str
    forward_return_distribution: MVRVForwardReturns | None = None


class MVRVOutput(BaseModel):
    asset: str
    computed_at: str
    lookback_days: int
    current: MVRVCurrent
    series: list[MVRVSeriesPointOutput]


class SOPRSeriesPointOutput(BaseModel):
    timestamp: str
    sopr: float
    ema_7d: float
    state: SOPRState


class SOPRCurrent(BaseModel):
    sopr: float
    ema_7d: float
    state: SOPRState
    crossed_one_days_ago: int | None = None
    interpretation: str


class SOPROutput(BaseModel):
    asset: str
    computed_at: str
    current: SOPRCurrent
    series: list[SOPRSeriesPointOutput]


class NVTSeriesPointOutput(BaseModel):
    timestamp: str
    nvt: float
    nvt_signal_90d: float


class NVTCurrent(BaseModel):
    nvt: float
    nvt_signal_90d: float
    historical_percentile: float
    regime: NVTRegimeT
    interpretation: str


class NVTOutput(BaseModel):
    asset: str
    computed_at: str
    current: NVTCurrent
    series: list[NVTSeriesPointOutput]


class FlowRegimeOutput(BaseModel):
    asset: str
    computed_at: str
    regime: FlowRegimeT
    regime_confidence: float
    net_flow_7d_usd: float
    net_flow_30d_usd: float
    baseline_net_flow_90d_usd: float
    interpretation: str
    historical_regime_distribution: dict[str, float]


# ─── Phase 6 Slice 1 — Regime classifier ───────────────────────────────────


RegimeLabelT = Literal[
    "trending_bull",
    "trending_bear",
    "range_bound",
    "volatility_expansion",
    "capitulation",
]


class FeatureSupportOutput(BaseModel):
    supporting: list[str]
    neutral: list[str]
    conflicting: list[str]


class RegimeClassificationOutput(BaseModel):
    asset: str
    raw_classification: RegimeLabelT
    committed_regime: RegimeLabelT
    regime_changed: bool
    confidence: float
    feature_support: FeatureSupportOutput
    reasoning: str


class HorizonStatOutput(BaseModel):
    horizon: str
    median_return: float
    p25_return: float
    p75_return: float
    sample_count: int


class ForwardReturnDistributionOutput(BaseModel):
    asset: str
    regime: str
    lookback_years: int
    horizons: list[HorizonStatOutput]
    total_observations: int
    source: Literal["backfill", "live", "mixed"]
    observation_window_start: Optional[str] = None
    observation_window_end: Optional[str] = None
