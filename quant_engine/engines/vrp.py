"""
Volatility Risk Premium (VRP) = ATM IV 30d − Realized Vol 30d.

Steps:
  1. Align IV and RV series by date.
  2. Compute VRP for each overlapping date.
  3. Compute current VRP, mean, std, and historical percentile.
  4. Generate plain-English assessment.
"""

from __future__ import annotations

import math

import numpy as np

from models import VRPInput, VRPOutput, VRPSeriesPoint


def compute_vrp(inp: VRPInput) -> VRPOutput:
    # Build date-keyed dicts
    iv_map = {p.date: p.atm_iv_30d for p in inp.iv_history}
    rv_map = {p.date: p.rv_30d for p in inp.rv_history}

    # Intersection of dates, sorted
    common_dates = sorted(set(iv_map) & set(rv_map))

    if not common_dates:
        return _empty(inp)

    series: list[VRPSeriesPoint] = []
    for date in common_dates:
        iv = iv_map[date]
        rv = rv_map[date]
        vrp = iv - rv
        series.append(VRPSeriesPoint(
            date=date,
            vrp=round(vrp, 2),
            iv=round(iv, 2),
            rv=round(rv, 2),
        ))

    vrps = np.array([p.vrp for p in series])
    mean_vrp = float(np.mean(vrps))
    std_vrp = float(np.std(vrps, ddof=1)) if len(vrps) > 1 else 0.0

    # Current VRP = most recent
    current_vrp = float(series[-1].vrp)

    # Historical percentile
    pct = float(np.mean(vrps <= current_vrp) * 100)

    # Assessment
    if current_vrp > mean_vrp + std_vrp:
        tone = "significantly above average — options appear expensive; sellers have a structural edge"
    elif current_vrp > mean_vrp:
        tone = "above average — implied vol is overpricing realized risk"
    elif current_vrp > 0:
        tone = "positive but near average — modest premium for option sellers"
    else:
        tone = "negative — realized vol is exceeding implied; options were underpriced"

    assessment = (
        f"{inp.asset.upper()} VRP is {current_vrp:+.1f}% ({pct:.0f}th percentile). "
        f"The spread is {tone}. "
        f"Historical mean: {mean_vrp:.1f}% ± {std_vrp:.1f}%."
    )

    return VRPOutput(
        asset=inp.asset.upper(),
        current_vrp=round(current_vrp, 2),
        current_vrp_percentile=round(pct, 1),
        vrp_series=series,
        assessment=assessment,
        mean_vrp=round(mean_vrp, 2),
        std_vrp=round(std_vrp, 2),
    )


def _empty(inp: VRPInput) -> VRPOutput:
    return VRPOutput(
        asset=inp.asset.upper(),
        current_vrp=0.0,
        current_vrp_percentile=50.0,
        vrp_series=[],
        assessment=f"No overlapping IV and RV dates found for {inp.asset.upper()}.",
        mean_vrp=0.0,
        std_vrp=0.0,
    )
