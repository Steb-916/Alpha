"""Feature-vector assembly from cache snapshots — Phase 6 Slice 1.

Canonical Python implementation. Must stay in lockstep with the TS live
feature builder at scope-alpha/frontend/lib/regime/feature-builder.ts.

Inputs: a dict mirroring the shape of live cache-key payloads (same JSON
shape that Redis holds). This lets the backfill drive the Python path
with reconstructed historical snapshots, and lets the parity test feed
both implementations the same input JSON.

The health score is ALWAYS recomputed from raw inputs using the current
Phase 5 Slice 3 formula (app.core.health). Persisted HealthScoreSnapshot
rows are NEVER consulted — see plan file §Known limitations #2.
"""

from __future__ import annotations

from typing import Any

from .health import (
    LiquidationSnapshot,
    OnChainRegimeInput,
    OptionsRegimeInput,
    compute_health_score,
)
from .regime import RegimeFeatureVector


def _coerce_float(v: Any) -> float | None:
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f


def build_feature_vector(snapshot: dict) -> RegimeFeatureVector:
    """Assemble a RegimeFeatureVector from a cache-snapshot dict.

    `snapshot` shape is the same contract the TS feature builder consumes —
    a flat dict containing the live cache-key payloads for funding, oi,
    basis, liqSnapshot, onchainSupply, onchainFlows, gex, iv/skew/vrp
    summaries, plus precomputed rolling-percentile scalars.

    Missing keys degrade gracefully — Tier 2/3 features stay None, health
    score uses DEFAULT_COMPONENT_SCORE for missing component inputs.
    """
    asset = snapshot["asset"]
    timestamp = snapshot["timestamp"]

    # ── Tier 1 rolling percentiles + deltas (provided pre-computed by caller)
    funding_percentile = float(snapshot["funding_percentile_30d"])
    basis_percentile = float(snapshot["basis_percentile"])
    liquidation_intensity = float(snapshot["liquidation_intensity_24h"])

    oi = snapshot.get("oi") or {}
    # change7d is a percentage (e.g. 6.2); feature is fraction → /100
    oi_change_7d_pct = _coerce_float(oi.get("change7d")) or 0.0
    oi_change_7d = oi_change_7d_pct / 100.0

    # ── Health score recomputed from raw inputs (never read persisted rows)
    funding = snapshot.get("funding") or {}
    liq_raw = snapshot.get("liqSnapshot") or None
    basis = snapshot.get("basis") or {}

    liq_snap = None
    if liq_raw:
        liq_snap = LiquidationSnapshot(
            long_usd=float(liq_raw.get("longUsd", 0)),
            short_usd=float(liq_raw.get("shortUsd", 0)),
            count=int(liq_raw.get("count", 0)),
            ts=int(liq_raw.get("ts", 0)),
        )

    # Options regime input
    gex = snapshot.get("gex") or {}
    gex_regime_raw = gex.get("regime")  # "positive_gamma" | "negative_gamma"
    options_input = OptionsRegimeInput(
        gamma_regime=gex_regime_raw if gex_regime_raw in (
            "positive_gamma", "negative_gamma"
        ) else None,
        skew_25d=_coerce_float(snapshot.get("skew_25d")),
        iv_percentile=_coerce_float(snapshot.get("iv_percentile_30d")),
    )

    # On-chain regime input
    onchain_supply = snapshot.get("onchainSupply") or {}
    mvrv_block = (onchain_supply.get("mvrv") or {}).get("current") or {}
    mvrv_regime = mvrv_block.get("regime")
    mvrv_z_score = _coerce_float(mvrv_block.get("z_score"))

    onchain_flows = snapshot.get("onchainFlows") or {}
    flow_regime_block = onchain_flows.get("regime") or {}
    flow_regime = flow_regime_block.get("regime")

    onchain_input = OnChainRegimeInput(
        flow_regime=flow_regime if flow_regime in (
            "accumulation", "distribution", "neutral"
        ) else None,
        mvrv_regime=mvrv_regime if mvrv_regime in (
            "deep_value", "fair", "elevated", "euphoria"
        ) else None,
    )

    health = compute_health_score(
        funding_z_score=_coerce_float(funding.get("zScore")),
        oi_change_24h_pct=_coerce_float(oi.get("change24h")),
        basis_pct=_coerce_float(basis.get("currentBasis")),
        liquidation=liq_snap,
        options=options_input,
        onchain=onchain_input,
    )

    # ── Tier 2 scalars (already computed by caller / provider)
    iv_percentile = _coerce_float(snapshot.get("iv_percentile_30d"))
    skew_25d = _coerce_float(snapshot.get("skew_25d"))
    vrp_sign_raw = snapshot.get("vrp_sign")
    vrp_sign = vrp_sign_raw if vrp_sign_raw in ("positive", "negative") else None

    # ── Tier 3 categorical
    # gex_regime in the feature vector is "positive"/"negative" (not the
    # health-input "positive_gamma"/"negative_gamma"). Normalize.
    gex_feature_regime = None
    if gex_regime_raw == "positive_gamma":
        gex_feature_regime = "positive"
    elif gex_regime_raw == "negative_gamma":
        gex_feature_regime = "negative"

    whale_intensity = _coerce_float(snapshot.get("whale_intensity_24h"))

    return RegimeFeatureVector(
        asset=asset,
        timestamp=timestamp,
        funding_percentile_30d=funding_percentile,
        oi_change_7d=oi_change_7d,
        liquidation_intensity_24h=liquidation_intensity,
        basis_percentile=basis_percentile,
        health_score=health.score,
        mvrv_regime=onchain_input.mvrv_regime,
        mvrv_z_score=mvrv_z_score,
        iv_percentile=iv_percentile,
        skew_25d=skew_25d,
        vrp_sign=vrp_sign,
        gex_regime=gex_feature_regime,
        flow_regime=onchain_input.flow_regime,
        whale_intensity_24h=whale_intensity,
    )
