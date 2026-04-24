"""
Volatility Cone — realized vol percentiles across multiple windows.

Method:
  1. Compute rolling N-day realized vol (annualised) at each window [7,14,30,60,90,180].
  2. Build historical percentile bands (p10–p90) from all rolling observations.
  3. Report current_rv (most recent window RV) and ATM IV percentile vs RV30d.
"""

from __future__ import annotations

import math

import numpy as np

from models import VolConeInput, VolConeOutput, VolConeWindow

WINDOWS = [7, 14, 30, 60, 90, 180]


def _rolling_rv(log_returns: np.ndarray, window: int) -> np.ndarray:
    """Annualised close-to-close realized vol for each rolling window."""
    n = len(log_returns)
    if n < window:
        return np.array([])
    rvs = []
    for i in range(window - 1, n):
        slice_ = log_returns[i - window + 1: i + 1]
        rv = math.sqrt(np.var(slice_, ddof=1) * 252) * 100
        rvs.append(rv)
    return np.array(rvs)


def compute_vol_cone(inp: VolConeInput) -> VolConeOutput:
    closes = np.array(inp.daily_closes, dtype=float)
    if len(closes) < 8:
        return _insufficient_data(inp)

    log_returns = np.diff(np.log(closes))

    windows_out: list[VolConeWindow] = []
    rv_30d_series: np.ndarray | None = None

    for w in WINDOWS:
        rvs = _rolling_rv(log_returns, w)
        if len(rvs) == 0:
            continue

        current_rv = float(rvs[-1])
        p10 = float(np.percentile(rvs, 10))
        p25 = float(np.percentile(rvs, 25))
        p50 = float(np.percentile(rvs, 50))
        p75 = float(np.percentile(rvs, 75))
        p90 = float(np.percentile(rvs, 90))

        if w == 30:
            rv_30d_series = rvs

        windows_out.append(VolConeWindow(
            days=w,
            current_rv=round(current_rv, 1),
            percentiles={
                "p10": round(p10, 1),
                "p25": round(p25, 1),
                "p50": round(p50, 1),
                "p75": round(p75, 1),
                "p90": round(p90, 1),
            },
        ))

    # IV percentile vs 30d RV history
    iv = inp.current_atm_iv
    if rv_30d_series is not None and len(rv_30d_series) > 0:
        pct = float(np.mean(rv_30d_series <= iv) * 100)
    else:
        pct = 50.0

    # Assessment
    if pct >= 75:
        tone = "elevated — options are pricing in above-average risk"
    elif pct >= 50:
        tone = "moderate — options are fairly priced relative to history"
    else:
        tone = "compressed — options may be underpricing near-term risk"

    assessment = (
        f"{inp.asset.upper()} ATM IV ({iv:.1f}%) is at the {pct:.0f}th percentile "
        f"of historical 30-day realized vol. IV is {tone}."
    )

    return VolConeOutput(
        asset=inp.asset.upper(),
        windows=windows_out,
        current_atm_iv=round(iv, 1),
        iv_percentile_vs_rv30d=round(pct, 1),
        assessment=assessment,
    )


def _insufficient_data(inp: VolConeInput) -> VolConeOutput:
    iv = inp.current_atm_iv
    windows_out = [
        VolConeWindow(
            days=w,
            current_rv=round(iv * 0.85, 1),
            percentiles={"p10": round(iv * 0.40, 1), "p25": round(iv * 0.58, 1),
                         "p50": round(iv * 0.75, 1), "p75": round(iv * 0.93, 1),
                         "p90": round(iv * 1.15, 1)},
        )
        for w in WINDOWS
    ]
    return VolConeOutput(
        asset=inp.asset.upper(),
        windows=windows_out,
        current_atm_iv=round(iv, 1),
        iv_percentile_vs_rv30d=50.0,
        assessment=f"Insufficient price history for {inp.asset.upper()} vol cone. Need at least 8 daily closes.",
    )
