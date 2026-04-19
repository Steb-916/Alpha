"""Forward-return distributions per regime — Phase 6 Slice 1.

For a given asset + regime, walk every historical hour the asset was in
that regime, compute 7d / 30d / 90d forward price return from that hour,
aggregate into a distribution (median, P25, P75, sample count, source).

The `source` field distinguishes backfill-derived observations (2y offline
reconstruction) from live RegimeSnapshot accumulation (post-launch). UI
surfaces this so users don't mistake a large backfill-sample for
live-validated history.

This is a pure compute function; callers feed it the observation series
and it returns the distribution. It does not query DBs directly — the
route wrapper in main.py fetches the series and passes it in.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Sequence

import numpy as np

ReturnSource = Literal["backfill", "live", "mixed"]

HORIZONS_HOURS = {
    "7d": 7 * 24,
    "30d": 30 * 24,
    "90d": 90 * 24,
}


@dataclass
class ForwardReturnObservation:
    """One historical hour in the regime of interest, paired with its price."""

    timestamp: str           # ISO-8601
    price: float
    source: Literal["backfill", "live"]  # provenance of this observation


@dataclass
class HorizonStat:
    horizon: str             # "7d" | "30d" | "90d"
    median_return: float
    p25_return: float
    p75_return: float
    sample_count: int


@dataclass
class ForwardReturnDistribution:
    asset: str
    regime: str
    lookback_years: int
    horizons: list[HorizonStat]
    total_observations: int
    source: ReturnSource
    observation_window_start: str | None  # earliest observation timestamp
    observation_window_end: str | None


def _forward_return(
    prices: np.ndarray,
    idx: int,
    horizon_hours: int,
) -> float | None:
    """Return the fractional forward return from prices[idx] to
    prices[idx + horizon_hours]. None if out of range or invalid."""
    target = idx + horizon_hours
    if target >= len(prices):
        return None
    start_price = prices[idx]
    end_price = prices[target]
    if not np.isfinite(start_price) or not np.isfinite(end_price) or start_price <= 0:
        return None
    return float((end_price - start_price) / start_price)


def compute_forward_returns(
    asset: str,
    regime: str,
    observations: Sequence[ForwardReturnObservation],
    full_price_series: Sequence[tuple[str, float]],
    lookback_years: int = 2,
) -> ForwardReturnDistribution:
    """Aggregate per-horizon forward-return statistics for the given regime.

    `observations` are hours the asset was in `regime` (already filtered).
    `full_price_series` is the full hourly price timeline (timestamp, price)
    ordered ascending — used to look up forward prices from each observation.

    Returns per-horizon stats + overall source provenance.
    """
    if not observations or not full_price_series:
        return ForwardReturnDistribution(
            asset=asset,
            regime=regime,
            lookback_years=lookback_years,
            horizons=[
                HorizonStat(horizon=h, median_return=0.0, p25_return=0.0,
                            p75_return=0.0, sample_count=0)
                for h in HORIZONS_HOURS
            ],
            total_observations=0,
            source="backfill",  # neutral default when empty
            observation_window_start=None,
            observation_window_end=None,
        )

    # Build an ordered timestamp → index map for fast lookups.
    ts_to_idx = {ts: i for i, (ts, _) in enumerate(full_price_series)}
    prices = np.array([p for _, p in full_price_series], dtype=float)

    horizon_stats: list[HorizonStat] = []
    for horizon_name, horizon_hours in HORIZONS_HOURS.items():
        returns: list[float] = []
        for obs in observations:
            idx = ts_to_idx.get(obs.timestamp)
            if idx is None:
                continue
            r = _forward_return(prices, idx, horizon_hours)
            if r is not None:
                returns.append(r)
        if returns:
            arr = np.array(returns, dtype=float)
            horizon_stats.append(
                HorizonStat(
                    horizon=horizon_name,
                    median_return=float(np.median(arr)),
                    p25_return=float(np.quantile(arr, 0.25)),
                    p75_return=float(np.quantile(arr, 0.75)),
                    sample_count=int(arr.size),
                )
            )
        else:
            horizon_stats.append(
                HorizonStat(
                    horizon=horizon_name,
                    median_return=0.0,
                    p25_return=0.0,
                    p75_return=0.0,
                    sample_count=0,
                )
            )

    # Source aggregation
    has_backfill = any(o.source == "backfill" for o in observations)
    has_live = any(o.source == "live" for o in observations)
    if has_backfill and has_live:
        source: ReturnSource = "mixed"
    elif has_live:
        source = "live"
    else:
        source = "backfill"

    timestamps_sorted = sorted(o.timestamp for o in observations)

    return ForwardReturnDistribution(
        asset=asset,
        regime=regime,
        lookback_years=lookback_years,
        horizons=horizon_stats,
        total_observations=len(observations),
        source=source,
        observation_window_start=timestamps_sorted[0] if timestamps_sorted else None,
        observation_window_end=timestamps_sorted[-1] if timestamps_sorted else None,
    )
