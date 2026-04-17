"""Realized vol from daily closes.

Rewritten from RND.py §fetch_realized_vol (line 63-83) to take an array of
daily closes instead of calling yfinance. Annualized with √365 for crypto
24/7 trading (vs √252 in the original equity version).
"""

from __future__ import annotations

import numpy as np

from ..config import TRADING_DAYS_PER_YEAR


def rolling_realized_vol(
    daily_closes: np.ndarray,
    window_days: int,
) -> np.ndarray:
    """All possible `window_days`-day realized vols across the history.

    Returns an array of length `len(daily_closes) - window_days`. Each
    entry is annualized with the 365-day convention.
    """
    closes = np.asarray(daily_closes, dtype=float)
    if len(closes) <= window_days:
        return np.array([], dtype=float)
    log_ret = np.diff(np.log(closes))
    out = np.empty(len(log_ret) - window_days + 1, dtype=float)
    for i in range(len(out)):
        window = log_ret[i : i + window_days]
        out[i] = float(np.std(window, ddof=1) * np.sqrt(TRADING_DAYS_PER_YEAR))
    return out


def point_realized_vol(
    daily_closes: np.ndarray,
    window_days: int,
) -> float | None:
    """Single realized-vol value over the trailing `window_days`."""
    closes = np.asarray(daily_closes, dtype=float)
    if len(closes) < window_days + 1:
        return None
    log_ret = np.diff(np.log(closes[-(window_days + 1) :]))
    return float(np.std(log_ret, ddof=1) * np.sqrt(TRADING_DAYS_PER_YEAR))
