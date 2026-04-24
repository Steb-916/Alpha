"""
Pydantic models that exactly mirror types/options.ts.
The Next.js frontend's TypeScript contracts define the source of truth.
"""

from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel


# ─── Vol Surface ──────────────────────────────────────────────────────────────

class VolSurfaceOptionInput(BaseModel):
    strike: float
    expiry_days: float
    option_type: Literal["call", "put"]
    mark_iv: float
    bid_iv: Optional[float]
    ask_iv: Optional[float]
    open_interest: float
    volume_24h: float


class ExpirationInfo(BaseModel):
    date: str
    days_to_expiry: float


class VolSurfaceInput(BaseModel):
    asset: str
    spot_price: float
    options: list[VolSurfaceOptionInput]
    expirations: list[ExpirationInfo]


class VolSurfacePoint(BaseModel):
    strike: float
    delta: float
    expiry_days: float
    expiry_date: str
    raw_iv: float
    fitted_iv: float
    residual: float


class FitQuality(BaseModel):
    rmse: float
    max_residual: float
    method: str


class VolSurfaceSummary(BaseModel):
    atm_iv_by_expiry: list[dict]
    skew_25d_by_expiry: list[dict]


class VolSurfaceOutput(BaseModel):
    asset: str
    spot_price: float
    surface: list[VolSurfacePoint]
    fit_quality: FitQuality
    summary: VolSurfaceSummary
    computed_at: str


# ─── RND ──────────────────────────────────────────────────────────────────────

class RNDOptionInput(BaseModel):
    strike: float
    call_price_usd: float
    iv: float
    option_type: Literal["call", "put"]


class RNDInput(BaseModel):
    asset: str
    spot_price: float
    expiry_date: str
    expiry_days: float
    risk_free_rate: float
    options: list[RNDOptionInput]


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
    quality: str


class RNDOutput(BaseModel):
    asset: str
    expiry_date: str
    expiry_days: float
    spot_price: float
    density: list[dict]
    statistics: RNDStatistics
    confidence: RNDConfidence


# ─── Vol Cone ─────────────────────────────────────────────────────────────────

class VolConeInput(BaseModel):
    asset: str
    daily_closes: list[float]
    current_atm_iv: float


class VolConeWindow(BaseModel):
    days: int
    current_rv: float
    percentiles: dict  # p10, p25, p50, p75, p90


class VolConeOutput(BaseModel):
    asset: str
    windows: list[VolConeWindow]
    current_atm_iv: float
    iv_percentile_vs_rv30d: float
    assessment: str


# ─── VRP ──────────────────────────────────────────────────────────────────────

class VRPHistoryPoint(BaseModel):
    date: str
    atm_iv_30d: float


class RVHistoryPoint(BaseModel):
    date: str
    rv_30d: float


class VRPInput(BaseModel):
    asset: str
    iv_history: list[VRPHistoryPoint]
    rv_history: list[RVHistoryPoint]


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


# ─── Skew + Term Structure ────────────────────────────────────────────────────

class SkewOptionInput(BaseModel):
    strike: float
    expiry_days: float
    option_type: Literal["call", "put"]
    mark_iv: float
    open_interest: float


class SkewInput(BaseModel):
    asset: str
    spot_price: float
    options: list[SkewOptionInput]


class SmilePoint(BaseModel):
    delta: float
    iv: float


class SkewByExpiry(BaseModel):
    expiry_date: str
    expiry_days: float
    skew_25d: float
    skew_10d: float
    skew_5d: float
    put_iv_25d: float
    call_iv_25d: float
    atm_iv: float
    smile: list[SmilePoint]


class TermStructurePoint(BaseModel):
    expiry_days: float
    atm_iv: float


class SkewOutput(BaseModel):
    asset: str
    by_expiry: list[SkewByExpiry]
    term_structure: list[TermStructurePoint]
    term_structure_shape: Literal["contango", "backwardation", "flat"]
