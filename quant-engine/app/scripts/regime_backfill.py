"""Regime feature backfill — Phase 6 Slice 1.

One-shot developer script. Reconstructs ~2 years of hourly feature vectors
for BTC (or ETH) from public data sources:
  - Binance Futures REST:     funding rates, open interest, klines.
  - CoinMetrics community:    daily MVRV + market cap + supply.
  - Binance liquidations:     ≈3-month retention; zero-filled for older.

Writes `quant-engine/data/backfill_{asset_lower}.parquet`. Idempotent:
re-running overwrites the file cleanly.

This is NOT invoked at Railway/Fly.io container start. Run locally:
    python -m app.scripts.regime_backfill --asset BTC --years 2

The script is deliberately verbose and fault-tolerant — data-source outages
at any point skip that hour's signal rather than aborting the whole run.

**Health-score recomputation**: see plan file §Known limitations #2.
Historical HealthScoreSnapshot rows were written under an evolving formula.
This script recomputes using the current (Phase 5 Slice 3) Python-ported
formula for every hour — live vs backfill paths stay numerically aligned.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from dataclasses import asdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import requests

from app.core.feature_builder import build_feature_vector

log = logging.getLogger("regime_backfill")

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
DATA_DIR.mkdir(exist_ok=True)

BINANCE_FUTURES = "https://fapi.binance.com"
COINMETRICS = "https://community-api.coinmetrics.io/v4"

# Roughly: 1 year ≈ 8760 hours; 2 years ≈ 17520. Binance returns max 500
# per page for most endpoints; we paginate by start_time sliding forward.
BINANCE_LIMIT = 500


# ─── Generic HTTP helpers ──────────────────────────────────────────────────


def _get(url: str, params: dict[str, Any] | None = None, timeout: int = 30) -> Any:
    """Minimal GET wrapper with basic retry and structured logging."""
    for attempt in range(3):
        try:
            r = requests.get(url, params=params, timeout=timeout)
            if r.status_code == 200:
                return r.json()
            if r.status_code in (429, 503):  # rate-limit / transient
                wait = 2 ** (attempt + 1)
                log.warning("[get] %s %s → sleeping %ds", r.status_code, url, wait)
                time.sleep(wait)
                continue
            log.error("[get] %s %s — %s", r.status_code, url, r.text[:200])
            return None
        except requests.RequestException as exc:
            log.warning("[get] %s failed: %s", url, exc)
            time.sleep(1 + attempt)
    return None


# ─── Data source: Binance futures (funding, OI, klines, liquidations) ──────


def fetch_binance_funding(symbol: str, start_ms: int, end_ms: int) -> pd.DataFrame:
    """Paginated funding history from Binance futures. Returns a DataFrame
    with columns: ts (ms), rate (float)."""
    rows: list[dict[str, Any]] = []
    cursor = start_ms
    while cursor < end_ms:
        resp = _get(
            f"{BINANCE_FUTURES}/fapi/v1/fundingRate",
            {
                "symbol": symbol,
                "startTime": cursor,
                "endTime": end_ms,
                "limit": 1000,
            },
        )
        if not resp:
            break
        if not isinstance(resp, list) or not resp:
            break
        for r in resp:
            rows.append({"ts": int(r["fundingTime"]), "rate": float(r["fundingRate"])})
        # Advance past the last returned entry
        cursor = int(resp[-1]["fundingTime"]) + 1
        if len(resp) < 1000:
            break
        time.sleep(0.1)
    return pd.DataFrame(rows)


def fetch_binance_oi_history(symbol: str, start_ms: int, end_ms: int) -> pd.DataFrame:
    """Hourly OI. Binance /futures/data/openInterestHist — returns
    sumOpenInterest (native) and sumOpenInterestValue (USD)."""
    rows: list[dict[str, Any]] = []
    cursor = start_ms
    while cursor < end_ms:
        resp = _get(
            f"{BINANCE_FUTURES}/futures/data/openInterestHist",
            {
                "symbol": symbol,
                "period": "1h",
                "startTime": cursor,
                "endTime": end_ms,
                "limit": BINANCE_LIMIT,
            },
        )
        if not resp:
            break
        if not isinstance(resp, list) or not resp:
            break
        for r in resp:
            rows.append({
                "ts": int(r["timestamp"]),
                "oi_native": float(r["sumOpenInterest"]),
                "oi_usd": float(r["sumOpenInterestValue"]),
            })
        cursor = int(resp[-1]["timestamp"]) + 3600_000
        if len(resp) < BINANCE_LIMIT:
            break
        time.sleep(0.1)
    return pd.DataFrame(rows)


def fetch_binance_klines(symbol: str, start_ms: int, end_ms: int) -> pd.DataFrame:
    """Hourly klines for price + realized-vol features."""
    rows: list[dict[str, Any]] = []
    cursor = start_ms
    while cursor < end_ms:
        resp = _get(
            f"{BINANCE_FUTURES}/fapi/v1/klines",
            {
                "symbol": symbol,
                "interval": "1h",
                "startTime": cursor,
                "endTime": end_ms,
                "limit": 1500,
            },
        )
        if not resp:
            break
        if not isinstance(resp, list) or not resp:
            break
        for r in resp:
            rows.append({
                "ts": int(r[0]),
                "open": float(r[1]),
                "high": float(r[2]),
                "low": float(r[3]),
                "close": float(r[4]),
                "volume": float(r[5]),
            })
        cursor = int(resp[-1][0]) + 3600_000
        if len(resp) < 1500:
            break
        time.sleep(0.05)
    return pd.DataFrame(rows)


def fetch_binance_liquidations(symbol: str, start_ms: int, end_ms: int) -> pd.DataFrame:
    """Binance allForceOrders — ≈3-month retention only. Older periods
    return empty; caller treats missing as zero intensity."""
    rows: list[dict[str, Any]] = []
    cursor = start_ms
    while cursor < end_ms:
        resp = _get(
            f"{BINANCE_FUTURES}/fapi/v1/allForceOrders",
            {
                "symbol": symbol,
                "startTime": cursor,
                "endTime": min(cursor + 86_400_000, end_ms),  # 1-day windows
                "limit": 1000,
            },
        )
        if not resp:
            cursor += 86_400_000
            continue
        if not isinstance(resp, list):
            cursor += 86_400_000
            continue
        for r in resp:
            rows.append({
                "ts": int(r["time"]),
                "side": r["side"],
                "qty_usd": float(r["origQty"]) * float(r["price"]),
            })
        cursor += 86_400_000
        time.sleep(0.05)
    return pd.DataFrame(rows)


# ─── Data source: CoinMetrics community (MVRV + market cap) ────────────────


def fetch_coinmetrics_mvrv(asset: str, start_date: str, end_date: str) -> pd.DataFrame:
    """Daily MVRV + market cap + supply from CoinMetrics community tier."""
    resp = _get(
        f"{COINMETRICS}/timeseries/asset-metrics",
        {
            "assets": asset.lower(),
            "metrics": "CapMVRVCur,CapMrktCurUSD,SplyCur,PriceUSD",
            "start_time": start_date,
            "end_time": end_date,
            "frequency": "1d",
            "page_size": "10000",
        },
    )
    if not resp or "data" not in resp:
        return pd.DataFrame()
    rows = []
    for r in resp["data"]:
        rows.append({
            "date": r["time"][:10],
            "mvrv": float(r.get("CapMVRVCur") or "nan"),
            "market_cap_usd": float(r.get("CapMrktCurUSD") or "nan"),
            "supply": float(r.get("SplyCur") or "nan"),
            "price_usd": float(r.get("PriceUSD") or "nan"),
        })
    return pd.DataFrame(rows)


# ─── Feature aggregation ──────────────────────────────────────────────────


def _rolling_percentile(series: pd.Series, window: int) -> pd.Series:
    """Rolling percentile rank of each value within its trailing window."""
    return series.rolling(window, min_periods=min(window // 4, 10)).apply(
        lambda w: (w < w.iloc[-1]).sum() / max(len(w) - 1, 1),
        raw=False,
    )


def _mvrv_regime(mvrv: float) -> str | None:
    if not np.isfinite(mvrv):
        return None
    if mvrv < 1.0:
        return "deep_value"
    if mvrv < 1.5:
        return "fair"
    if mvrv < 3.0:
        return "elevated"
    return "euphoria"


def build_hourly_feature_vectors(
    symbol: str,
    asset: str,
    years: int,
) -> pd.DataFrame:
    """Orchestrate per-source fetches, align to hourly grid, build feature
    vectors via app.core.feature_builder for every hour in the window."""
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=365 * years)
    start_ms = int(start.timestamp() * 1000)
    end_ms = int(end.timestamp() * 1000)

    log.info("Fetching Binance funding for %s from %s to %s", symbol, start, end)
    funding = fetch_binance_funding(symbol, start_ms, end_ms)
    log.info("  → %d funding rows", len(funding))

    log.info("Fetching Binance OI history for %s", symbol)
    oi = fetch_binance_oi_history(symbol, start_ms, end_ms)
    log.info("  → %d oi rows", len(oi))

    log.info("Fetching Binance klines for %s", symbol)
    klines = fetch_binance_klines(symbol, start_ms, end_ms)
    log.info("  → %d kline rows", len(klines))

    log.info("Fetching Binance liquidations for %s (≈3mo retention)", symbol)
    liqs = fetch_binance_liquidations(symbol, start_ms, end_ms)
    log.info("  → %d liquidation events", len(liqs))

    log.info("Fetching CoinMetrics MVRV for %s", asset)
    mvrv = fetch_coinmetrics_mvrv(asset, start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d"))
    log.info("  → %d daily mvrv rows", len(mvrv))

    if klines.empty:
        log.error("No klines retrieved — aborting backfill.")
        return pd.DataFrame()

    # Hourly grid from klines — every hour with a known close price.
    klines = klines.sort_values("ts").reset_index(drop=True)
    hourly = klines[["ts", "close"]].copy()
    hourly["timestamp"] = pd.to_datetime(hourly["ts"], unit="ms", utc=True)
    hourly["basis_pct"] = 0.0  # Placeholder — full basis needs spot feed

    # Align funding (typically 8h cadence) → forward-fill to hourly.
    if not funding.empty:
        funding_h = funding.set_index("ts").reindex(hourly["ts"], method="ffill").reset_index()
        hourly["funding_rate"] = funding_h["rate"].values
    else:
        hourly["funding_rate"] = np.nan
    hourly["funding_z_30d"] = (
        (hourly["funding_rate"] - hourly["funding_rate"].rolling(720).mean())
        / hourly["funding_rate"].rolling(720).std()
    )
    hourly["funding_percentile_30d"] = _rolling_percentile(hourly["funding_rate"], 720)

    # OI — align hourly + compute 24h and 7d changes
    if not oi.empty:
        oi_h = oi.set_index("ts").reindex(hourly["ts"], method="ffill").reset_index()
        hourly["oi_usd"] = oi_h["oi_usd"].values
        hourly["oi_change_24h"] = hourly["oi_usd"].pct_change(24) * 100
        hourly["oi_change_7d"] = hourly["oi_usd"].pct_change(168) * 100
    else:
        hourly["oi_usd"] = np.nan
        hourly["oi_change_24h"] = np.nan
        hourly["oi_change_7d"] = np.nan

    # Liquidations — hourly bucketed intensity (top-percentile in 24h window)
    if not liqs.empty:
        liqs["ts_h"] = (liqs["ts"] // 3600_000) * 3600_000
        liq_hourly = liqs.groupby("ts_h")["qty_usd"].sum().rename("liq_usd_hour")
        hourly = hourly.merge(
            liq_hourly, left_on="ts", right_index=True, how="left"
        )
        hourly["liq_usd_hour"] = hourly["liq_usd_hour"].fillna(0)
        # 24h rolling sum, then percentile vs 90d trailing
        hourly["liq_24h_usd"] = hourly["liq_usd_hour"].rolling(24, min_periods=1).sum()
        hourly["liquidation_intensity_24h"] = _rolling_percentile(
            hourly["liq_24h_usd"], 24 * 90
        ).fillna(0)
    else:
        hourly["liq_usd_hour"] = 0.0
        hourly["liq_24h_usd"] = 0.0
        hourly["liquidation_intensity_24h"] = 0.0

    # MVRV — forward-fill daily → hourly
    if not mvrv.empty:
        mvrv_h = mvrv.copy()
        mvrv_h["timestamp"] = pd.to_datetime(mvrv_h["date"], utc=True)
        mvrv_h = mvrv_h.set_index("timestamp").reindex(
            hourly["timestamp"], method="ffill"
        ).reset_index(drop=True)
        hourly["mvrv"] = mvrv_h["mvrv"].values
        hourly["mvrv_regime"] = hourly["mvrv"].apply(_mvrv_regime)
        hourly["mvrv_z_score"] = (
            (hourly["mvrv"] - hourly["mvrv"].rolling(24 * 30 * 4).mean())
            / hourly["mvrv"].rolling(24 * 30 * 4).std()
        )
    else:
        hourly["mvrv"] = np.nan
        hourly["mvrv_regime"] = None
        hourly["mvrv_z_score"] = np.nan

    # Basis percentile (placeholder 0.5 since basis_pct placeholder = 0)
    hourly["basis_percentile"] = _rolling_percentile(hourly["basis_pct"], 720)
    hourly["basis_percentile"] = hourly["basis_percentile"].fillna(0.5)

    # Compose a cache_snapshot dict per hour → build_feature_vector
    feature_rows: list[dict[str, Any]] = []
    for _, row in hourly.iterrows():
        snapshot = {
            "asset": asset,
            "timestamp": row["timestamp"].isoformat().replace("+00:00", "Z"),
            "funding": {
                "zScore": _safe_float(row.get("funding_z_30d")),
                "currentRate": _safe_float(row.get("funding_rate")),
            },
            "oi": {
                "change24h": _safe_float(row.get("oi_change_24h")),
                "change7d": _safe_float(row.get("oi_change_7d")),
                "aggregateOIUsd": _safe_float(row.get("oi_usd")),
            },
            "basis": {"currentBasis": 0.0},
            "liqSnapshot": None,  # Aggregate hourly liq not reconstructable
            "onchainSupply": {
                "asset": asset,
                "mvrv": {
                    "current": {
                        "regime": row.get("mvrv_regime"),
                        "z_score": _safe_float(row.get("mvrv_z_score")),
                        "mvrv": _safe_float(row.get("mvrv")),
                    }
                }
            } if row.get("mvrv_regime") else None,
            "onchainFlows": None,
            "gex": None,
            "iv_percentile_30d": None,
            "skew_25d": None,
            "vrp_sign": None,
            "funding_percentile_30d": _safe_float(row.get("funding_percentile_30d"), 0.5),
            "basis_percentile": _safe_float(row.get("basis_percentile"), 0.5),
            "liquidation_intensity_24h": _safe_float(row.get("liquidation_intensity_24h"), 0.0),
        }

        try:
            fv = build_feature_vector(snapshot)
            feature_rows.append({
                **asdict(fv),
                "_backfill_source": "reconstructed",
                "price_usd": _safe_float(row.get("close")),
            })
        except Exception as exc:
            log.warning("feature build failed for %s: %s", snapshot["timestamp"], exc)

    return pd.DataFrame(feature_rows)


def _safe_float(v, default=None):
    try:
        f = float(v)
        return default if not np.isfinite(f) else f
    except (TypeError, ValueError):
        return default


# ─── CLI entry ─────────────────────────────────────────────────────────────


def main():
    parser = argparse.ArgumentParser(description="Regime feature backfill")
    parser.add_argument("--asset", default="BTC", choices=["BTC", "ETH"])
    parser.add_argument("--years", type=int, default=2)
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    symbol = f"{args.asset}USDT"
    log.info("Backfill starting: asset=%s years=%d symbol=%s", args.asset, args.years, symbol)

    df = build_hourly_feature_vectors(symbol, args.asset, args.years)
    if df.empty:
        log.error("Backfill produced no rows — exiting non-zero.")
        sys.exit(1)

    out_path = DATA_DIR / f"backfill_{args.asset.lower()}.parquet"
    df.to_parquet(out_path)
    log.info("Wrote %d rows to %s", len(df), out_path)

    # Coverage summary by feature
    coverage = {
        col: float(df[col].notna().mean())
        for col in ("funding_percentile_30d", "oi_change_7d",
                    "liquidation_intensity_24h", "mvrv_regime", "health_score")
    }
    log.info("Feature coverage: %s", json.dumps(coverage, indent=2))


if __name__ == "__main__":
    main()
