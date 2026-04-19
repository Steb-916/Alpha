"""Pydantic input models for the Quant Engine.

Field names and shapes mirror types/options.ts in the Next.js frontend
verbatim. The TS contract is authoritative — the cron dispatcher and
frontend hooks are already built to it. Adding, renaming, or retyping a
field here without a matching TS edit breaks the deployed platform.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


OptionType = Literal["call", "put"]


# ─── Vol Surface ───────────────────────────────────────────────────────────


class VolSurfaceOption(BaseModel):
    strike: float
    expiry_days: float
    option_type: OptionType
    mark_iv: float
    bid_iv: Optional[float] = None
    ask_iv: Optional[float] = None
    open_interest: float
    volume_24h: float


class VolSurfaceExpiration(BaseModel):
    date: str
    days_to_expiry: float


class VolSurfaceInput(BaseModel):
    asset: str
    spot_price: float
    options: list[VolSurfaceOption]
    expirations: list[VolSurfaceExpiration]


# ─── RND ───────────────────────────────────────────────────────────────────


class RNDOption(BaseModel):
    strike: float
    call_price_usd: float
    iv: float
    option_type: OptionType


class RNDInput(BaseModel):
    asset: str
    spot_price: float
    expiry_date: str
    expiry_days: float
    risk_free_rate: float = 0.0
    options: list[RNDOption]


# ─── Vol Cone ──────────────────────────────────────────────────────────────


class VolConeInput(BaseModel):
    asset: str
    daily_closes: list[float]
    current_atm_iv: float


# ─── VRP ───────────────────────────────────────────────────────────────────


class VRPHistoryPoint(BaseModel):
    date: str
    atm_iv_30d: float = Field(..., description="Used only for iv_history entries")


class RVHistoryPoint(BaseModel):
    date: str
    rv_30d: float = Field(..., description="Used only for rv_history entries")


class VRPInput(BaseModel):
    asset: str
    iv_history: list[VRPHistoryPoint]
    rv_history: list[RVHistoryPoint]


# ─── Skew ──────────────────────────────────────────────────────────────────


class SkewOption(BaseModel):
    strike: float
    expiry_days: float
    option_type: OptionType
    mark_iv: float
    open_interest: float


class SkewInput(BaseModel):
    asset: str
    spot_price: float
    options: list[SkewOption]


# ─── Phase 5 — On-chain derived metrics ───────────────────────────────────


OnChainAsset = Literal["BTC", "ETH"]


class MVRVSeriesPointInput(BaseModel):
    timestamp: str
    mvrv: float


class MVRVInput(BaseModel):
    asset: OnChainAsset
    series: list[MVRVSeriesPointInput]
    lookback_days: int = 1460


class SOPRSeriesPointInput(BaseModel):
    timestamp: str
    sopr: float


class SOPRInput(BaseModel):
    asset: OnChainAsset
    series: list[SOPRSeriesPointInput]


class NVTSeriesPointInput(BaseModel):
    timestamp: str
    market_cap_usd: float
    tx_volume_usd: float


class NVTInput(BaseModel):
    asset: OnChainAsset
    series: list[NVTSeriesPointInput]


class FlowRegimeSeriesPointInput(BaseModel):
    timestamp: str
    net_flow_usd: float


class FlowRegimeInput(BaseModel):
    asset: OnChainAsset
    series: list[FlowRegimeSeriesPointInput]


# ─── Phase 6 Slice 1 — Regime classifier ───────────────────────────────────


RegimeLabelLiteral = Literal[
    "trending_bull",
    "trending_bear",
    "range_bound",
    "volatility_expansion",
    "capitulation",
]


class RegimeFeatureVectorInput(BaseModel):
    asset: str
    timestamp: str
    funding_percentile_30d: float
    oi_change_7d: float
    liquidation_intensity_24h: float
    basis_percentile: float
    health_score: float
    mvrv_regime: Optional[str] = None
    mvrv_z_score: Optional[float] = None
    iv_percentile: Optional[float] = None
    skew_25d: Optional[float] = None
    vrp_sign: Optional[str] = None
    gex_regime: Optional[str] = None
    flow_regime: Optional[str] = None
    whale_intensity_24h: Optional[float] = None


class RegimeClassifyInput(BaseModel):
    asset: str
    feature_vector: RegimeFeatureVectorInput
    prev_regime: Optional[RegimeLabelLiteral] = None
    prev_raw_classification: Optional[RegimeLabelLiteral] = None


class ForwardReturnsObservationInput(BaseModel):
    timestamp: str
    price: float
    source: Literal["backfill", "live"]


class ForwardReturnsPricePointInput(BaseModel):
    timestamp: str
    price: float


class ForwardReturnsInput(BaseModel):
    asset: str
    regime: RegimeLabelLiteral
    observations: list[ForwardReturnsObservationInput]
    full_price_series: list[ForwardReturnsPricePointInput]
    lookback_years: int = 2
