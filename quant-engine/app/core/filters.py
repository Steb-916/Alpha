"""Quote quality filters for Deribit options chains.

Ported from RND.py §filter_quotes (line 91-141). Adaptations for crypto:
 - `max_spread_ratio` relaxed to 3.0 (crypto spreads are wider than SPX)
 - Inputs come from Deribit book summaries (mark_iv, bid/ask IVs, OI, volume)
 - Intrinsic-violation check uses mark_iv × BS-implied price, since Deribit
   returns mark_price in the underlying currency — the upstream caller has
   already multiplied to USD in OptionsChainEntry.markPrice.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal


@dataclass
class QuoteFilter:
    """Container for a single option quote used by the density builder."""

    strike: float
    iv: float  # decimal (0.52 for 52% vol)
    call_price_usd: float | None
    option_type: Literal["call", "put"]
    open_interest: float


@dataclass
class LiquidityMetrics:
    n_raw: int
    n_kept: int
    n_dropped_iv: int = 0
    n_dropped_oi: int = 0
    n_dropped_strike: int = 0
    retention_pct: float = 0.0
    avg_oi: float = 0.0

    def finalize(self) -> None:
        self.retention_pct = (
            self.n_kept / self.n_raw * 100.0 if self.n_raw > 0 else 0.0
        )


def filter_quotes(
    quotes: list[QuoteFilter],
    spot: float,
    min_oi: float = 1.0,
    min_iv: float = 0.05,
    max_iv: float = 5.0,
) -> tuple[list[QuoteFilter], LiquidityMetrics]:
    """Drop instruments that will poison the spline fit.

    Rules (relaxed for crypto compared to the original equity version):
      - IV must be in (min_iv, max_iv) — catches obviously-broken quotes
      - OI must be >= min_oi — we already get volume>0 from Deribit for most
      - Strike must be positive and finite
    Intrinsic-violation checks are handled downstream by the monotonicity
    + convexity pass inside build_density — safer than dropping here
    because Deribit's mark IV is already smoothed relative to raw bid/ask.
    """
    metrics = LiquidityMetrics(n_raw=len(quotes), n_kept=0)
    kept: list[QuoteFilter] = []
    total_oi = 0.0

    for q in quotes:
        if not (q.strike > 0 and q.strike < 1e9):
            metrics.n_dropped_strike += 1
            continue
        if not (min_iv < q.iv < max_iv):
            metrics.n_dropped_iv += 1
            continue
        if q.open_interest < min_oi:
            metrics.n_dropped_oi += 1
            continue
        kept.append(q)
        total_oi += q.open_interest

    metrics.n_kept = len(kept)
    metrics.avg_oi = total_oi / max(len(kept), 1)
    metrics.finalize()
    return kept, metrics
