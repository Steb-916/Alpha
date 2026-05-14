"""Macro correlation engine — Phase 7.

Computes rolling Pearson correlations between BTC and traditional macro assets
(S&P 500, DXY, Gold, 10-Year Treasury Yields) using Yahoo Finance daily data.

Design notes:
- External network call (yfinance) makes this endpoint stateful by definition.
  Caller is expected to cache at the API layer (4h TTL — daily bar resolution).
- Returns None for any pair that cannot be computed (insufficient overlap,
  data gaps) rather than raising — caller handles null gracefully.
- windows: 30d and 90d rolling Pearson on log returns, evaluated at the
  most recent observation date.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

import numpy as np
import pandas as pd

try:
    import yfinance as yf
    _YF_AVAILABLE = True
except ImportError:
    _YF_AVAILABLE = False


# Ticker map: internal label → Yahoo Finance symbol
_TICKERS = {
    "BTC": "BTC-USD",
    "SPX": "^GSPC",
    "DXY": "DX-Y.NYB",
    "GOLD": "GC=F",
    "TNX": "^TNX",
}

_MACRO_ASSETS = ["SPX", "DXY", "GOLD", "TNX"]
_WINDOWS = [30, 90]


@dataclass
class AssetCorrelation:
    spx: Optional[float]
    dxy: Optional[float]
    gold: Optional[float]
    tnx: Optional[float]


@dataclass
class CorrelationMatrixRow:
    asset: str
    label: str
    correlations_30d: AssetCorrelation
    correlations_90d: AssetCorrelation


@dataclass
class MacroCorrelationOutput:
    matrix: list[CorrelationMatrixRow]
    computed_at: str


def _pearson(a: pd.Series, b: pd.Series, window: int) -> Optional[float]:
    """Rolling Pearson correlation on log returns, last observation."""
    aligned = pd.concat([a, b], axis=1).dropna()
    if len(aligned) < window:
        return None
    tail = aligned.tail(window)
    corr = tail.iloc[:, 0].corr(tail.iloc[:, 1])
    if np.isnan(corr):
        return None
    return round(float(corr), 4)


def compute_macro_correlations(lookback_days: int = 120) -> MacroCorrelationOutput:
    """Fetch daily prices from Yahoo Finance and compute BTC vs macro correlations."""
    computed_at = datetime.now(timezone.utc).isoformat()

    if not _YF_AVAILABLE:
        return MacroCorrelationOutput(matrix=[], computed_at=computed_at)

    end = datetime.now(timezone.utc).date()
    start = end - timedelta(days=lookback_days)

    tickers_to_fetch = list(_TICKERS.values())
    try:
        raw = yf.download(
            tickers_to_fetch,
            start=start.isoformat(),
            end=end.isoformat(),
            auto_adjust=True,
            progress=False,
            threads=True,
        )
    except Exception:
        return MacroCorrelationOutput(matrix=[], computed_at=computed_at)

    # Extract Close prices; multi-ticker download returns MultiIndex columns
    if isinstance(raw.columns, pd.MultiIndex):
        close = raw["Close"] if "Close" in raw.columns.get_level_values(0) else raw.iloc[:, []]
    else:
        close = raw[["Close"]] if "Close" in raw.columns else raw

    # Build log return series keyed by internal label
    returns: dict[str, pd.Series] = {}
    for label, ticker in _TICKERS.items():
        if ticker in close.columns:
            price = close[ticker].dropna()
            if len(price) > 1:
                returns[label] = np.log(price / price.shift(1)).dropna()

    btc_ret = returns.get("BTC")
    if btc_ret is None or len(btc_ret) == 0:
        return MacroCorrelationOutput(matrix=[], computed_at=computed_at)

    rows: list[CorrelationMatrixRow] = []
    label_map = {"SPX": "S&P 500", "DXY": "DXY", "GOLD": "Gold", "TNX": "10Y Yield"}

    for asset_key in _MACRO_ASSETS:
        macro_ret = returns.get(asset_key)
        if macro_ret is None:
            corr_30 = AssetCorrelation(spx=None, dxy=None, gold=None, tnx=None)
            corr_90 = AssetCorrelation(spx=None, dxy=None, gold=None, tnx=None)
        else:
            def _c(w: int) -> Optional[float]:
                return _pearson(btc_ret, macro_ret, w)

            # Build per-window AssetCorrelation with only the relevant field set
            def _row(w: int) -> AssetCorrelation:
                v = _c(w)
                return AssetCorrelation(
                    spx=v if asset_key == "SPX" else None,
                    dxy=v if asset_key == "DXY" else None,
                    gold=v if asset_key == "GOLD" else None,
                    tnx=v if asset_key == "TNX" else None,
                )

            corr_30 = _row(30)
            corr_90 = _row(90)

        rows.append(CorrelationMatrixRow(
            asset=asset_key,
            label=label_map[asset_key],
            correlations_30d=corr_30,
            correlations_90d=corr_90,
        ))

    return MacroCorrelationOutput(matrix=rows, computed_at=computed_at)
