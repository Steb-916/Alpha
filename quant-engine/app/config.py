"""Global constants for the Scope Alpha Quant Engine.

These are the knobs that diverge from the original RND.py (built for US
equity options) to fit crypto (24/7 trading, European options, zero
risk-free rate default). Kept as module-level constants so tests can
override them per-call if needed (e.g., cross-validation against the
original on SPX at r=0.05, annualization=252).
"""

from __future__ import annotations

import os

TRADING_DAYS_PER_YEAR: int = 365
DEFAULT_RISK_FREE_RATE: float = 0.0

SPLINE_SMOOTHING: float = 0.01
SPLINE_DEGREE: int = 4
WING_EXTRAPOLATION_SIGMA: float = 4.0

CONFIDENCE_MIN_STRIKES: int = 10
CONFIDENCE_GOOD_SCORE: float = 75.0
CONFIDENCE_FAIR_SCORE: float = 50.0

IV_SOURCE_PREFERENCE: str = "mark"

VERSION: str = "1.0.0"


def get_api_key() -> str:
    """Shared secret from env. Empty string means auth is disabled (dev only)."""
    return os.environ.get("QUANT_API_KEY", "")


def is_auth_enabled() -> bool:
    return bool(get_api_key())
