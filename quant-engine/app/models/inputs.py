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
