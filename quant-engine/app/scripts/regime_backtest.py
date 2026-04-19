"""Regime backtest + markdown report — Phase 6 Slice 1.

Loads `quant-engine/data/backfill_{asset}.parquet` (produced by
regime_backfill.py), runs the classifier hour-by-hour with the persistence
filter applied, computes forward-return distributions per regime, and
writes `quant-engine/reports/regime_backtest_{asset}.md` + PNG plots.

Run locally:
    python -m app.scripts.regime_backtest --asset BTC

**Gating behavior per PRD**: the Slice 1 UI work does not commit to
production until this report is reviewed. Specifically verify:
  - Regime timeline doesn't flicker weekly (persistence filter working).
  - Known events land in expected regimes (LUNA crash → capitulation, etc.)
  - Feature-support breakdown is reasonable.
  - Distribution plots look physical.
"""

from __future__ import annotations

import argparse
import logging
import sys
from dataclasses import asdict
from pathlib import Path
from typing import Any

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from app.core.forward_returns import (
    ForwardReturnObservation,
    compute_forward_returns,
)
from app.core.regime import (
    ALL_REGIMES,
    RegimeFeatureVector,
    apply_persistence_filter,
    classify_regime,
)

log = logging.getLogger("regime_backtest")

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
REPORTS_DIR = Path(__file__).resolve().parents[2] / "reports"
REPORTS_DIR.mkdir(exist_ok=True)

REGIME_COLORS = {
    "trending_bull": "#22c55e",
    "trending_bear": "#dc2626",
    "range_bound": "#9ca3af",
    "volatility_expansion": "#f59e0b",
    "capitulation": "#7f1d1d",
}


def _fv_from_row(row: dict[str, Any]) -> RegimeFeatureVector:
    return RegimeFeatureVector(
        asset=row["asset"],
        timestamp=row["timestamp"],
        funding_percentile_30d=float(row.get("funding_percentile_30d") or 0.5),
        oi_change_7d=float(row.get("oi_change_7d") or 0.0),
        liquidation_intensity_24h=float(row.get("liquidation_intensity_24h") or 0.0),
        basis_percentile=float(row.get("basis_percentile") or 0.5),
        health_score=float(row.get("health_score") or 50.0),
        mvrv_regime=row.get("mvrv_regime"),
        mvrv_z_score=row.get("mvrv_z_score"),
        iv_percentile=row.get("iv_percentile"),
        skew_25d=row.get("skew_25d"),
        vrp_sign=row.get("vrp_sign"),
        gex_regime=row.get("gex_regime"),
        flow_regime=row.get("flow_regime"),
        whale_intensity_24h=row.get("whale_intensity_24h"),
    )


def run_classifier(df: pd.DataFrame) -> pd.DataFrame:
    """Hour-by-hour classification with persistence filter. Returns a
    copy of the input with raw + committed regime columns + transitions."""
    raw_col: list[str] = []
    committed_col: list[str] = []
    changed_col: list[bool] = []

    prev_raw = None
    prev_committed = None

    for _, row in df.iterrows():
        fv = _fv_from_row(row.to_dict())
        raw = classify_regime(fv)
        pf = apply_persistence_filter(raw, prev_raw, prev_committed)

        raw_col.append(raw)
        committed_col.append(pf.committed_regime)
        changed_col.append(pf.regime_changed)

        prev_raw = raw
        prev_committed = pf.committed_regime

    out = df.copy()
    out["raw_regime"] = raw_col
    out["committed_regime"] = committed_col
    out["regime_changed"] = changed_col
    return out


def plot_regime_timeline(df: pd.DataFrame, asset: str, path: Path) -> None:
    fig, ax = plt.subplots(figsize=(14, 2.6))
    regimes = df["committed_regime"].values
    xs = pd.to_datetime(df["timestamp"], utc=True)
    # Color each hour by regime
    for i in range(len(xs) - 1):
        ax.axvspan(xs.iloc[i], xs.iloc[i + 1],
                   color=REGIME_COLORS.get(regimes[i], "#ccc"), alpha=0.95)
    ax.set_xlim(xs.iloc[0], xs.iloc[-1])
    ax.set_yticks([])
    ax.set_title(f"{asset} committed regime timeline")
    ax.set_xlabel("Time (UTC)")
    # Legend
    handles = [plt.Rectangle((0, 0), 1, 1, color=c, alpha=0.95)
               for c in REGIME_COLORS.values()]
    ax.legend(handles, list(REGIME_COLORS.keys()),
              loc="upper center", bbox_to_anchor=(0.5, -0.25), ncol=5, fontsize=8)
    fig.tight_layout()
    fig.savefig(path, dpi=120, bbox_inches="tight")
    plt.close(fig)


def plot_forward_returns_per_regime(
    distributions: dict[str, Any],
    path: Path,
) -> None:
    fig, ax = plt.subplots(figsize=(11, 5))
    horizons = ["7d", "30d", "90d"]
    x = np.arange(len(ALL_REGIMES))
    width = 0.27
    for i, h in enumerate(horizons):
        medians = []
        for regime in ALL_REGIMES:
            dist = distributions.get(regime)
            hs = next((hz for hz in dist.horizons if hz.horizon == h), None) if dist else None
            medians.append(hs.median_return * 100 if hs and hs.sample_count > 0 else 0)
        ax.bar(x + (i - 1) * width, medians, width, label=h,
               color=["#93c5fd", "#3b82f6", "#1d4ed8"][i])
    ax.set_xticks(x)
    ax.set_xticklabels(list(ALL_REGIMES), rotation=15)
    ax.axhline(0, color="#555", linewidth=0.8)
    ax.set_ylabel("Median forward return (%)")
    ax.set_title("Historical forward returns by regime (median)")
    ax.legend(title="Horizon")
    fig.tight_layout()
    fig.savefig(path, dpi=120, bbox_inches="tight")
    plt.close(fig)


def compute_all_distributions(
    df: pd.DataFrame,
    asset: str,
) -> dict[str, Any]:
    """Run compute_forward_returns for each regime against the full series."""
    price_series = [
        (row["timestamp"], float(row.get("price_usd") or 0.0))
        for _, row in df.iterrows()
    ]
    # Filter out rows without price
    price_series = [(t, p) for t, p in price_series if p > 0]

    out: dict[str, Any] = {}
    for regime in ALL_REGIMES:
        mask = df["committed_regime"] == regime
        sub = df[mask]
        obs = [
            ForwardReturnObservation(
                timestamp=row["timestamp"],
                price=float(row.get("price_usd") or 0.0),
                source="backfill",
            )
            for _, row in sub.iterrows()
            if float(row.get("price_usd") or 0.0) > 0
        ]
        out[regime] = compute_forward_returns(
            asset=asset, regime=regime,
            observations=obs,
            full_price_series=price_series,
        )
    return out


def render_markdown_report(
    asset: str,
    df: pd.DataFrame,
    distributions: dict[str, Any],
    timeline_png: Path,
    returns_png: Path,
    output_path: Path,
) -> None:
    total_hours = len(df)
    start = df["timestamp"].iloc[0] if not df.empty else "?"
    end = df["timestamp"].iloc[-1] if not df.empty else "?"
    regime_counts = df["committed_regime"].value_counts()
    transitions = int(df["regime_changed"].sum())

    lines = [
        f"# {asset} Regime Backtest — Phase 6 Slice 1",
        "",
        f"**Window**: {start} → {end}",
        f"**Total hourly observations**: {total_hours}",
        f"**Persistence-filter transitions committed**: {transitions}",
        "",
        "## Regime occupancy (committed)",
        "",
        "| Regime | Hours | Share |",
        "|---|---:|---:|",
    ]
    for regime, count in regime_counts.items():
        share = count / total_hours * 100
        lines.append(f"| `{regime}` | {count} | {share:.1f}% |")
    lines += [
        "",
        "## Regime timeline",
        "",
        f"![Timeline]({timeline_png.name})",
        "",
        "## Forward-return distributions per regime",
        "",
        f"![Returns]({returns_png.name})",
        "",
        "### Per-regime horizon breakdown",
        "",
    ]
    for regime in ALL_REGIMES:
        dist = distributions.get(regime)
        if not dist or dist.total_observations == 0:
            lines.append(f"#### `{regime}` — no observations")
            lines.append("")
            continue
        lines.append(f"#### `{regime}` — {dist.total_observations} observations "
                     f"(source: {dist.source})")
        lines.append("")
        lines.append("| Horizon | Median | P25 | P75 | N |")
        lines.append("|---|---:|---:|---:|---:|")
        for h in dist.horizons:
            lines.append(
                f"| {h.horizon} | {h.median_return*100:+.2f}% | "
                f"{h.p25_return*100:+.2f}% | {h.p75_return*100:+.2f}% | {h.sample_count} |"
            )
        lines.append("")
    lines += [
        "## Gating checklist — review before shipping Slice 1 UI",
        "",
        "- [ ] Timeline doesn't flicker weekly (persistence filter working).",
        "- [ ] Known historical events land in expected regimes:",
        "    - 2022-05 LUNA crash → `capitulation`",
        "    - March 2024 BTC rally → `trending_bull`",
        "    - Jun–Aug 2024 chop → `range_bound`",
        "    - Jan 2025 vol spike → `volatility_expansion`",
        "- [ ] Distribution plots look physical (no extreme outliers, meaningful ranges).",
        "- [ ] Feature-support breakdown is reasonable (no regime < 3 supporting features).",
        "",
        "If any check fails, tune thresholds in `app/core/regime.py` (named "
        "module constants at top) and re-run this script.",
        "",
        "## Caveats",
        "",
        "- **Liquidation history**: Binance `allForceOrders` retains ≈3 months "
        "only. Older-period liquidation intensity defaults to 0.",
        "- **Basis**: spot-feed alignment not reconstructed in v1; "
        "basis_percentile falls back to 0.5 (neutral).",
        "- **Tier 2/3 features absent**: options GEX/IV + flow regime not "
        "historically deep enough to backfill. Classifier still runs against "
        "Tier 1 subset; live classifier uses full feature set.",
        "- **Health-score recomputation**: always current formula "
        "(Phase 5 Slice 3). Persisted HealthScoreSnapshot rows are NOT read.",
    ]
    output_path.write_text("\n".join(lines), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Regime backtest + report")
    parser.add_argument("--asset", default="BTC", choices=["BTC", "ETH"])
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    input_path = DATA_DIR / f"backfill_{args.asset.lower()}.parquet"
    if not input_path.exists():
        log.error("Backfill parquet missing at %s. Run regime_backfill.py first.",
                  input_path)
        sys.exit(1)

    log.info("Loading %s", input_path)
    df = pd.read_parquet(input_path)
    log.info("  → %d rows", len(df))

    log.info("Running classifier hour-by-hour")
    df = run_classifier(df)

    timeline_png = REPORTS_DIR / f"regime_timeline_{args.asset.lower()}.png"
    returns_png = REPORTS_DIR / f"regime_returns_{args.asset.lower()}.png"

    log.info("Plotting regime timeline → %s", timeline_png)
    plot_regime_timeline(df, args.asset, timeline_png)

    log.info("Computing forward-return distributions")
    distributions = compute_all_distributions(df, args.asset)

    log.info("Plotting forward returns → %s", returns_png)
    plot_forward_returns_per_regime(distributions, returns_png)

    report_path = REPORTS_DIR / f"regime_backtest_{args.asset.lower()}.md"
    log.info("Rendering report → %s", report_path)
    render_markdown_report(
        args.asset, df, distributions, timeline_png, returns_png, report_path
    )

    log.info("Backtest complete. Review: %s", report_path)


if __name__ == "__main__":
    main()
