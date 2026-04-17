"""Pydantic output models for the Quant Engine.

Shapes mirror types/options.ts. Where the TS contract and the source PRD
disagree, the TS contract wins. Extensions (e.g., tail_metrics block)
stay out of the returned payload until the TS side is extended too.

On compute failure, routes return a structurally-valid instance with
empty arrays and `quality: "failed"` — never a 500. The TS client maps
non-2xx to null, which surfaces as an Unavailable banner in the UI.
"""

from __future__ import annotations

from typing import Literal

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
