# PRD: Phase 6 — Regime Classifier & Convergence Engine

**Version:** 1.0 (draft)
**Date:** April 18, 2026
**Status:** Draft — finalize after Phase 5 Slice 3 ships
**Priority:** Highest — this is the product's moat
**Depends on:** Phases 0–5 complete + Quant Engine deployed

---

## 1. Context

### Where We Are

Phases 0–4 shipped live derivatives + options intelligence. Phase 5 (all three slices) added the on-chain domain: MVRV regime, flow regime, exchange flows, stablecoin aggregates, whale monitoring, and a cost-basis overlay on the RND chart. Slice 3 also enriched the health score with on-chain inputs and landed three on-chain alert types.

The platform now has three data domains live: derivatives, options, and on-chain. What it does not yet have is a **synthesis layer** that combines them. Users still have to look at four terminal pages and mentally combine the signals. The product's thesis — "no platform below Bloomberg's tier unifies these domains" — is architecturally correct but not yet user-facing.

### What Phase 6 Is

Phase 6 ships the synthesis. Three deliverables:

1. **Regime Classifier** — Per-asset classification into a small set of interpretable states (`trending_bull`, `trending_bear`, `range_bound`, `volatility_expansion`, `capitulation`) with a confidence score, a 90-day regime timeline, and a historical forward-return distribution.

2. **Convergence Engine** — Per-domain sentiment scores (derivatives / options / on-chain) with a composite. Shows whether the three domains agree (high-conviction signal) or disagree (contested signal).

3. **"Why is price moving?" Card** — Auto-appears on terminal pages when `|Δprice| > 3%` in 1h. Cross-domain evidence aggregator with a rules-based pattern match ("most consistent with a short squeeze driven by derivatives positioning"). The feature deferred from Phase 5 Slice 3.

### What Phase 6 Is NOT

- **Not ML.** v1 classifier is rules-based. Crypto has short history, feature distributions shift regime-by-regime, and an ML model trained on the 2–4 years we have will overfit 2022–2025 dynamics and fail out-of-distribution. Rules are interpretable, backtestable with small data, and — critically — debuggable when they misfire. See §11 Open Decisions for the revisit criteria.
- **Not a trading recommender.** No "buy" / "sell" language anywhere in the UI. Regime labels + historical forward-return distributions only. This is an analytics platform, not financial advice.
- **Not dependent on any new external data source.** Every input Phase 6 needs is already flowing. This is a compute phase, not a data phase.
- **Not Phase 7.** Sentiment and macro inputs (Fear & Greed, SPX correlation, ETF flows) land in Phase 7 and become a fourth convergence panel then. v1 ships with 3 panels.

### Critical Distinction: Regime vs Convergence

These are related but distinct concepts and the PRD uses them precisely:

- **Regime** = a single categorical label describing the asset's overall market state. One label per asset per time. "BTC is in `trending_bull` with 73% confidence."
- **Convergence** = the degree to which the three data domains agree on direction. Three scalar scores (one per domain) plus a composite. "BTC: derivatives +68, options +52, on-chain +74, composite +65, strong convergence."

Regime is categorical; convergence is continuous. Regime answers "what kind of market is this?"; convergence answers "how strong is the signal?" They're complementary. A high-confidence `range_bound` regime with low convergence (domains disagreeing) is a different situation from a high-confidence `trending_bull` with strong convergence (all three domains aligned positive).

---

## 2. Data Maturity — The Binding Constraint

Phase 6 is gated on what historical data actually exists. Honest inventory as of Phase 5 close:

| Input | Source | Historical depth | Quality |
|---|---|---|---|
| Funding rate | Binance/Bybit/OKX | Exchange APIs: 2+ years retrievable | High |
| Open interest | Binance/Bybit/OKX | Exchange APIs: 1+ year retrievable; our snapshots since Phase 1 | High |
| Liquidations | Binance/Bybit | Our persistence since Phase 1 | High |
| Basis | Computed from spot + perp | Full depth via candles | High |
| Health score | Phase 2 composite | Snapshots since Phase 2 | High |
| ATM IV / skew / VRP | Deribit + Quant Engine | Our snapshots since Phase 3 (~6–8 weeks live) | Medium — limited history |
| GEX regime | Phase 4 | Our snapshots since Phase 4 (~2–3 weeks live) | Low — too recent for statistical confidence |
| MVRV regime | CoinMetrics + Quant Engine | 4-year backfill for BTC, ~2 years for ETH | High |
| Flow regime | CoinMetrics + Quant Engine | Starts accumulating at Phase 5 Slice 2 launch | Low — brand new |
| SOPR | Deferred at Slice 2 | Not available | N/A |
| NVT | Deferred at Slice 2 | Not available | N/A |
| Whale transactions | Whale Alert | Since Phase 5 Slice 2 | Low — near-real-time only |

**Implication for the classifier design:** v1 must be weighted toward the deep-history inputs (funding, OI, liquidations, health, MVRV) and treat shallow-history inputs (GEX regime, flow regime) as confidence modifiers rather than primary drivers. Otherwise the classifier over-fits to the last 3 weeks of feature values and misclassifies anything outside that window.

**Implication for validation:** the "validate on ≥2 years of historical data" bar (from v3 roadmap) can only be met with the deep-history subset. v1 validation uses derivatives + MVRV. Shallow-history features get added to the feature vector as they accumulate enough history (target: 6+ months per feature before it gets primary weight).

**Implication for forward-return distribution:** reliable for BTC from 2022 onward using derivatives + MVRV. For ETH, earliest usable is ~mid-2023. Users see the distribution with honest sample-size disclosure ("based on 312 hourly observations in this regime over 2022–2026").

---

## 3. Regime Classifier Design

### 3.1 Regime States (v1)

Five states. Each has clear feature-vector preconditions and meaningfully different forward-return distributions in historical data:

| Regime | Characterization | Typical feature signature |
|---|---|---|
| `trending_bull` | Sustained upward momentum, positive leverage building, on-chain accumulation | health > 60, funding percentile > 0.55, OI growing, flow regime = accumulation |
| `trending_bear` | Sustained downward pressure, distribution, negative funding | health < 40, funding percentile < 0.45, OI declining or flat, flow regime = distribution |
| `range_bound` | Low realized vol, balanced positioning, no directional edge | IV percentile < 0.5, funding near median, flow regime = neutral |
| `volatility_expansion` | Elevated leverage, rising IV, regime transition zone | IV percentile > 0.75 OR funding percentile > 0.9, OI growth > 10% 7d |
| `capitulation` | Liquidation cascade, extreme selling, on-chain deep-value territory | liquidation intensity > 95th percentile, MVRV regime = deep_value, sharp drawdown |

Five is deliberate. Three is too coarse (loses the high-vol and tail-event states). Seven+ would need more history than we have to discriminate reliably. Five is the minimum that captures "direction + vol regime + tail event" without over-segmenting.

**Important property:** a regime label is an asset's *current* state, not a forecast. The forward-return distribution tells users what happened historically when the asset was in this state. The label does not predict; history does.

### 3.2 Feature Vector

Input to the classifier at time `t`. Built by the Quant Engine from cached domain data.

```python
@dataclass
class RegimeFeatureVector:
    asset: str
    timestamp: datetime

    # Tier 1 — deep history, primary weight
    funding_percentile_30d: float           # [0, 1]
    oi_change_7d: float                     # signed, as fraction
    liquidation_intensity_24h: float        # [0, 1] percentile of rolling 90d
    basis_percentile: float                 # [0, 1]
    health_score: float                     # [0, 100]
    mvrv_regime: Optional[str]              # deep_value | fair | elevated | euphoria | None
    mvrv_z_score: Optional[float]           # for continuous interpretation

    # Tier 2 — medium history, secondary weight
    iv_percentile: Optional[float]          # [0, 1]
    skew_25d: Optional[float]               # signed
    vrp_sign: Optional[str]                 # positive | negative | None

    # Tier 3 — shallow history, modifier weight only
    gex_regime: Optional[str]               # positive | negative | None
    flow_regime: Optional[str]              # accumulation | distribution | neutral | None
    whale_intensity_24h: Optional[float]    # [0, 1] percentile of rolling 30d since available
```

**Weighting philosophy**:
- Tier 1 features are sufficient to classify. Tier 2 and Tier 3 act as confirmation/modulation.
- A classification built only on Tier 1 features is valid and yields a confidence value. Adding Tier 2/3 features agreeing with Tier 1 raises confidence; disagreeing features lower confidence without changing the label.
- Rules explicitly handle missing Tier 2/3 features — missing is different from conflicting, and the classifier must not degrade when optional features are null.

### 3.3 Classifier Rules (illustrative — to be calibrated)

Precise thresholds are a calibration exercise the quant partner owns; these are directional examples to lock the shape:

```python
def classify_regime(fv: RegimeFeatureVector) -> RegimeClassification:
    # Tail events evaluated first
    if (fv.liquidation_intensity_24h or 0) > 0.95 and fv.mvrv_regime == "deep_value":
        return classify_with_confidence("capitulation", fv)

    # Volatility expansion takes precedence over direction
    if (fv.iv_percentile and fv.iv_percentile > 0.8) or fv.funding_percentile_30d > 0.92:
        return classify_with_confidence("volatility_expansion", fv)

    # Directional regimes
    bull_score = 0
    bear_score = 0
    if fv.health_score > 60: bull_score += 2
    if fv.health_score < 40: bear_score += 2
    if fv.funding_percentile_30d > 0.55: bull_score += 1
    if fv.funding_percentile_30d < 0.45: bear_score += 1
    if fv.oi_change_7d > 0.05: bull_score += 1
    if fv.oi_change_7d < -0.05: bear_score += 1
    if fv.flow_regime == "accumulation": bull_score += 2
    if fv.flow_regime == "distribution": bear_score += 2
    if fv.mvrv_regime == "euphoria": bear_score += 1  # contrarian tilt
    if fv.mvrv_regime == "deep_value": bull_score += 1

    if bull_score >= 4 and bull_score > bear_score + 2:
        return classify_with_confidence("trending_bull", fv)
    if bear_score >= 4 and bear_score > bull_score + 2:
        return classify_with_confidence("trending_bear", fv)

    return classify_with_confidence("range_bound", fv)
```

**These rules are a starting template.** Calibration against 2 years of historicals will tune thresholds, weights, and possibly add interaction terms. The quant partner runs the calibration notebook and checks in both the final rules and the backtest results.

### 3.4 Confidence Score

Fraction of available features that "support" the classified regime, where "support" means the feature value is on the same side as the regime implies (e.g., funding percentile > 0.5 supports `trending_bull`).

```python
def compute_confidence(fv, regime) -> float:
    available, supporting = 0, 0
    for feature, expected_direction in REGIME_FEATURE_EXPECTATIONS[regime]:
        value = getattr(fv, feature)
        if value is None:
            continue
        available += 1
        if expected_direction(value):
            supporting += 1
    return supporting / available if available > 0 else 0
```

Surfaced in UI as a percentage. Low confidence (< 0.5) triggers a "Contested signal" badge and prompts users to consult the convergence dashboard for domain-by-domain breakdown.

### 3.5 Persistence Filter (Anti-Flicker)

Classifier runs hourly. Without a persistence filter it will flip regimes on single-hour feature boundary crossings, producing a noisy timeline.

**Rule**: a regime change only commits when two consecutive hourly classifications agree on the new regime. When the current hour's raw classification differs from the persisted regime:
1. Record the raw classification in the snapshot row.
2. Do NOT update the persisted "current regime" yet.
3. On the next hour, if the new classification matches the previous hour's raw classification, commit the regime transition.
4. If it reverts, keep the original regime — the excursion was noise.

This adds one-hour latency to regime transitions. Acceptable trade vs the alternative (flickering timeline). Documented in UI as "Regime changes confirm after two consecutive observations."

**Exception**: `capitulation` commits immediately. Tail events are rare and delaying the label by an hour defeats its utility.

### 3.6 Forward-Return Distribution

For each historical regime instance, compute 7d / 30d / 90d forward returns. Aggregate by regime.

For the current asset, surface:
- Median forward return per horizon
- P25 and P75 bands
- Sample size ("based on N observations over 2022–2026")

Users see "BTC is in `trending_bull`. Historically from this regime: 7d median +1.8% (P25 −2.1%, P75 +5.4%), 30d median +6.2%, 90d median +14.1%, based on 847 hourly observations."

**Disclosure**: never phrase as a forecast. Always "historically" + sample size. This is the same discipline that kept the platform out of signal-marketplace regulatory territory — it matters here too.

---

## 4. Convergence Engine Design

### 4.1 Per-Domain Scores

Each domain scored independently on `[-100, +100]`. Positive = bullish lean; negative = bearish; zero = neutral.

**Derivatives score**:
```python
score = 0
score += (funding_percentile_30d - 0.5) * 80    # [-40, +40]
score += sign(oi_change_7d) * min(abs(oi_change_7d) * 200, 20)  # [-20, +20]
score += (health_score - 50) * 0.8              # [-40, +40]
score -= liquidation_longs_dominance * 20       # asymmetric liqs drag the score
return clip(score, -100, 100)
```

**Options score**:
```python
score = 0
if iv_percentile is not None:
    score += (iv_percentile - 0.5) * 40         # elevated IV = risk-off lean
if skew_25d is not None:
    score -= skew_25d * 50                      # negative skew (put bid) drags
if gex_regime == "positive":
    score += 15
elif gex_regime == "negative":
    score -= 15
if vrp_sign == "positive":
    score += 10
return clip(score, -100, 100)
```

**On-chain score**:
```python
score = 0
MVRV_SCORE_MAP = {
    "deep_value": +40,
    "fair": +10,
    "elevated": -15,
    "euphoria": -40,
}
FLOW_SCORE_MAP = {
    "accumulation": +30,
    "neutral": 0,
    "distribution": -30,
}
score += MVRV_SCORE_MAP.get(mvrv_regime, 0)
score += FLOW_SCORE_MAP.get(flow_regime, 0)
score += whale_intensity_24h * (whale_net_direction_signal) * 10
return clip(score, -100, 100)
```

These weights are first-pass and share the same "recalibrate in future iteration" discipline as the regime classifier thresholds. Ship conservative; tune from data.

### 4.2 Composite Score

Weighted mean of the three domain scores. Default weights: 40% derivatives, 30% options, 30% on-chain.

**Rationale for the weighting**: derivatives has the deepest history and the tightest relationship to short-term price action. On-chain and options contribute slower-moving structural signals. A user can override weights in preferences later (Phase 8 candidate); v1 ships with the defaults fixed.

**Missing domain handling**: if a domain has no data (Quant Engine returning null, options tab inert, etc.), its weight redistributes proportionally to the available domains. The composite is always computable as long as at least one domain has data.

### 4.3 Convergence Strength

Measures domain agreement independent of direction:

```python
def convergence_strength(scores: List[float]) -> ConvergenceStrength:
    available = [s for s in scores if s is not None]
    if len(available) < 2:
        return "insufficient_data"

    same_sign = all(s > 0 for s in available) or all(s < 0 for s in available)
    max_spread = max(available) - min(available)

    if same_sign and max_spread < 30:
        return "strong_convergence"
    if same_sign and max_spread < 60:
        return "moderate_convergence"
    if not same_sign:
        return "divergence"
    return "weak_convergence"
```

Four outputs: `strong_convergence`, `moderate_convergence`, `weak_convergence`, `divergence`. Surfaced as a badge on the dashboard. `strong_convergence` is the high-signal state — all three domains agreeing is the rare, valuable moment.

---

## 5. "Why is Price Moving?" Card

### 5.1 Trigger

Fires when `|Δprice_1h| > 3%` on any asset the user is viewing. Threshold configurable via user preferences (later); v1 fixed at 3%.

Evaluated by a new lightweight check at the SSE broadcast layer — when a price tick crosses the threshold, flag the asset for explanation. The card queries `/api/market/insights/price-move?asset=BTC&window=1h` and renders inline on the relevant terminal page.

### 5.2 Evidence Extraction

At query time, the endpoint aggregates cross-domain evidence from the `window` preceding the move:

**Derivatives evidence**:
- Funding rate change (absolute and percentile)
- OI delta (USD and fraction)
- Liquidation events (total USD, long-side vs short-side breakdown, largest single event)
- CVD divergence presence
- Basis change

**Options evidence**:
- GEX regime transition (if occurred)
- IV spike (ATM IV change in window)
- Unusual flow (any "high significance" flow-scanner flags)
- Pin-risk change

**On-chain evidence**:
- Large whale transfers in window (count, total USD, classification breakdown)
- Flow regime change (if occurred)
- MVRV regime change (if occurred — rare in 1h)
- Exchange netflow reversal

### 5.3 Significance Scoring

Each evidence item gets a significance score — how unusual it is vs 90d baseline for that metric. Top 3–5 items surface in the card.

```python
def significance(value, rolling_distribution) -> float:
    """Percentile of `value` within the rolling 90d distribution. Max-tailed."""
    percentile = percentileofscore(rolling_distribution, value)
    return max(percentile, 100 - percentile) / 100
```

A liquidation event in the top 2% of 90d events gets significance 0.98. A funding rate change 1.2σ above mean gets ~0.88. Items with significance < 0.7 don't surface.

### 5.4 Pattern Match

After evidence collection, match against a small pattern library:

| Pattern | Preconditions | Label |
|---|---|---|
| Short squeeze | Move up + high short liquidations + rising funding | "Most consistent with a short squeeze driven by derivatives positioning." |
| Long squeeze | Move down + high long liquidations + falling funding | "Most consistent with a long squeeze." |
| Flow-led move | Large whale transfer in correct direction preceding move by < 30min | "Large whale activity preceded the move; flow-led." |
| Options-led move | GEX regime flipped immediately before the move | "Dealer gamma regime transitioned; options hedging likely amplified the move." |
| Macro correlation | (Phase 7 feature) correlated move in SPX/DXY | Deferred |
| Unexplained | No pattern matches with significance | "Evidence is mixed; no dominant driver identified." |

v1 ships with 5 patterns (+ fallback). Pattern library is in a config file so additions don't require code changes.

### 5.5 Response Format

```json
{
  "asset": "BTC",
  "window": "1h",
  "price_change_pct": 4.2,
  "price_before": 82100,
  "price_after": 85550,
  "pattern": "short_squeeze",
  "pattern_label": "Most consistent with a short squeeze driven by derivatives positioning.",
  "evidence": [
    {
      "domain": "derivatives",
      "type": "liquidation_cascade",
      "value_usd": 340000000,
      "significance": 0.98,
      "description": "$340M in short liquidations — top 2% event in 90d"
    },
    {
      "domain": "derivatives",
      "type": "funding_spike",
      "value": 0.045,
      "significance": 0.91,
      "description": "Funding rate jumped to 0.045% — 91st percentile 30d"
    },
    {
      "domain": "options",
      "type": "gex_regime_stable",
      "significance": 0.0,
      "description": "GEX regime remained positive (no amplification from options)"
    },
    {
      "domain": "onchain",
      "type": "no_unusual_flow",
      "significance": 0.0,
      "description": "No unusual whale activity in the hour preceding."
    }
  ],
  "regime_context": {
    "regime": "volatility_expansion",
    "regime_confidence": 0.72
  },
  "generated_at": "2026-04-18T14:31:22Z"
}
```

Card UI renders the headline (`pattern_label`), top 3 evidence items with significance badges, and a small regime-context footer.

---

## 6. Frontend

### 6.1 New Page: `/terminal/regime`

**Component:** `app/(app)/terminal/regime/page.tsx`

Asset selector (BTC, ETH, plus any asset with sufficient Tier 1 data). Single-asset view, not cross-asset grid — the intent is depth, not comparison.

Layout:

```
┌─────────────────────────────────────────────────────────────────┐
│  BTC Regime                                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  TRENDING BULL            Confidence: 73%               │    │
│  │  Entered regime 3 days ago                              │    │
│  └─────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│  90-day Regime Timeline                                          │
│  [horizontal strip, colored by regime, current position marked] │
├─────────────────────────────────────────────────────────────────┤
│  Feature Contributions                                           │
│                                                                  │
│  Derivatives (weight: high)                                      │
│    Health score            68    supports trending_bull  ✓       │
│    Funding percentile 30d  0.64  supports trending_bull  ✓       │
│    OI change 7d           +3.2%  supports trending_bull  ✓       │
│    Liquidation intensity   0.35  neutral                         │
│                                                                  │
│  Options (weight: medium)                                        │
│    IV percentile          0.48   neutral                         │
│    25d skew              +0.3    mildly supports trending_bull  ✓ │
│    GEX regime            positive supports trending_bull  ✓      │
│                                                                  │
│  On-chain (weight: modifier)                                     │
│    MVRV regime            fair   neutral                         │
│    Flow regime        accumulation supports trending_bull  ✓     │
│    24h whale intensity    0.42   neutral                         │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  Historical Forward Returns in this Regime                       │
│  Based on 847 hourly observations since Jan 2022                 │
│                                                                  │
│           Median     P25        P75                              │
│    7d    +1.8%     −2.1%      +5.4%                              │
│    30d   +6.2%     −4.8%     +14.9%                              │
│    90d  +14.1%     −6.2%     +32.7%                              │
│                                                                  │
│  Past performance does not predict future outcomes.              │
└─────────────────────────────────────────────────────────────────┘
```

**Timeline heatmap**: horizontal strip, each pixel represents one hour. Colors map to regime:
- `trending_bull` — green
- `trending_bear` — red
- `range_bound` — gray
- `volatility_expansion` — amber
- `capitulation` — dark red

Hover reveals exact timestamp and feature snapshot. Click navigates back-in-time for that hour's feature vector.

### 6.2 New Page: `/terminal/convergence`

**Component:** `app/(app)/terminal/convergence/page.tsx`

Asset selector. Three-panel layout for the domain scores + composite:

```
┌───────────────────────────────────────────────────────────────────┐
│  BTC Convergence                                                   │
│                                                                    │
│  Composite: +65   STRONG CONVERGENCE  [green badge]                │
│  All three domains aligned bullish.                                │
│                                                                    │
├───────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐              │
│  │ Derivatives │   │  Options    │   │  On-chain   │              │
│  │             │   │             │   │             │              │
│  │    +68      │   │    +52      │   │    +74      │              │
│  │             │   │             │   │             │              │
│  │ Contributors│   │ Contributors│   │ Contributors│              │
│  │ • funding   │   │ • GEX regime│   │ • flow:     │              │
│  │   p30 0.64  │   │   positive  │   │   accum     │              │
│  │ • health 68 │   │ • skew +0.3 │   │ • MVRV fair │              │
│  │ • OI +3.2%  │   │ • VRP pos   │   │ • whales    │              │
│  │   7d        │   │             │   │   net out   │              │
│  └─────────────┘   └─────────────┘   └─────────────┘              │
│                                                                    │
│  [Composite history — 30d line chart showing composite over time]  │
│                                                                    │
├───────────────────────────────────────────────────────────────────┤
│  Alerts                                                            │
│  Notify me when composite crosses +80  [button]                    │
│  Notify me when convergence becomes strong  [button]               │
└───────────────────────────────────────────────────────────────────┘
```

Each panel has its domain score, contributing features with current values, and a sparkline showing the domain's 30d score history.

The "Alerts" section provides 1-click entry points to create `convergence_threshold` alerts with sensible defaults pre-filled.

### 6.3 "Why is Price Moving?" Card

**Component:** `components/insights/WhyIsPriceMovingCard.tsx`

Not a page — a card that renders inline on `/terminal/derivatives`, `/terminal/volatility`, `/terminal/onchain`, and the dashboard home when triggered.

Trigger logic lives in a new hook `useActiveInsights(asset)`:
- Listens to the price SSE stream (existing infrastructure from Phase 1).
- On a price tick with `|Δ_1h| > 3%`, sets `activeInsight = { asset, triggeredAt }`.
- Auto-clears after 2 hours or on user dismiss.

When active, the card fetches `/api/market/insights/price-move?asset=...&window=1h` and renders:

```
┌──────────────────────────────────────────────────────────────┐
│  ⚡ BTC moved +4.2% in the last hour                      ✕  │
│                                                              │
│  Most consistent with a short squeeze driven by              │
│  derivatives positioning.                                    │
│                                                              │
│  Top evidence:                                               │
│  🔴 $340M short liquidations (top 2% event, 90d)            │
│  🟡 Funding rate jumped to 0.045% (p91 30d)                  │
│  🟢 Flow regime: neutral (no on-chain trigger)               │
│                                                              │
│  Regime context: Volatility Expansion (73% confidence)       │
│                                                              │
│  [View full evidence]                                        │
└──────────────────────────────────────────────────────────────┘
```

Dismissible. Persists across page navigations while active. Doesn't auto-reopen if dismissed within the same 1h window.

### 6.4 Contextual Metric Emphasis (Light Touch)

The v3 roadmap flagged this: "based on current regime, surface-raise the predictive metrics (e.g., trending → funding + OI momentum; range-bound → on-chain accumulation)."

v1 ships a light-touch version only: on `/terminal/derivatives`, a regime badge appears in the header, and a short hint describes which metrics matter most in the current regime ("In `trending_bull`: funding momentum and OI growth are the highest-signal derivatives metrics"). No automatic re-ordering of cards, no hidden content. Users stay in control of layout; the regime context is informational.

Full contextual re-ordering is a Phase 8 candidate — likely bundled with user-customizable layouts (from the Phase 9 scope in v3).

### 6.5 Navigation

New nav entries under "Terminal":
- Regime
- Convergence

Between Derivatives and Volatility in nav order. Both pages are gated on Quant Engine being configured — if it isn't, nav entries show but the pages render `UnavailableBanner`.

---

## 7. Quant Engine — New Endpoints

### 7.1 `POST /regime/classify`

**Input**: feature vector for one asset at one timestamp.

```json
{
  "asset": "BTC",
  "feature_vector": { ... },
  "prev_regime": "trending_bull",
  "prev_raw_classification": "range_bound"
}
```

`prev_regime` is the currently persisted regime (for persistence-filter logic). `prev_raw_classification` is the prior hour's raw classification (also for persistence filter — the endpoint returns whether to commit a transition).

**Output**:

```json
{
  "asset": "BTC",
  "raw_classification": "range_bound",
  "committed_regime": "trending_bull",
  "regime_changed": false,
  "confidence": 0.66,
  "feature_support": {
    "supporting": ["health_score", "funding_percentile_30d", "flow_regime"],
    "neutral": ["iv_percentile", "mvrv_regime"],
    "conflicting": ["oi_change_7d"]
  },
  "reasoning": "Tier 1 features support trending_bull but OI declined 7d — mild conflict. Persistence filter holds regime."
}
```

### 7.2 `POST /regime/forward-returns`

**Input**: asset + regime + lookback years.

**Output**: forward-return distribution (P25, median, P75, sample count) at 7d, 30d, 90d horizons.

Computed once per regime per asset per day and cached — this is slow due to the lookback but deterministic.

### 7.3 `POST /convergence/score`

**Input**: per-domain feature bundles.

**Output**:

```json
{
  "asset": "BTC",
  "derivatives_score": 68,
  "options_score": 52,
  "onchain_score": 74,
  "composite": 65,
  "convergence_strength": "strong_convergence",
  "contributors": {
    "derivatives": [
      { "feature": "funding_percentile_30d", "contribution": 11.2 },
      { "feature": "health_score", "contribution": 14.4 }
    ],
    "options": [ ... ],
    "onchain": [ ... ]
  }
}
```

Contributors list is sorted by absolute contribution, allowing the UI to show top contributors per domain.

### 7.4 `POST /insights/price-move`

**Input**: asset + window + price delta.

**Output**: evidence aggregation + pattern match (§5.5 format).

This endpoint reads cached data from multiple domains and does the pattern-match rules inline. Response time target: < 500ms.

### 7.5 QuantEngineClient Additions

```typescript
async classifyRegime(input: RegimeClassifyInput): Promise<RegimeClassification | null>
async forwardReturns(input: ForwardReturnsInput): Promise<ForwardReturnDistribution | null>
async scoreConvergence(input: ConvergenceInput): Promise<ConvergenceScore | null>
async explainPriceMove(input: PriceMoveInput): Promise<PriceMoveExplanation | null>
```

Same inert-mode pattern: null when `QUANT_ENGINE_URL` unset.

---

## 8. API Routes & Cache Warming

### 8.1 New Routes

| Route | Method | Source | Purpose |
|---|---|---|---|
| `/api/market/regime/current` | GET | Quant Engine `/regime/classify` | Current asset regime + confidence |
| `/api/market/regime/history` | GET | DB | 90d timeline of regime snapshots |
| `/api/market/regime/forward-returns` | GET | Quant Engine `/regime/forward-returns` | Historical forward-return distribution |
| `/api/market/convergence/current` | GET | Quant Engine `/convergence/score` | Current convergence state |
| `/api/market/convergence/history` | GET | DB | 30d composite history |
| `/api/market/insights/price-move` | GET | Quant Engine `/insights/price-move` | "Why is price moving?" endpoint |

Standard cache-first → warming → 503 pattern.

### 8.2 Cache Keys and TTLs

| Cache Key | TTL | Populated By |
|---|---|---|
| `regime:current:{asset}` | 3600s | hourly cron |
| `regime:forward_returns:{asset}:{regime}` | 86400s | daily cron |
| `convergence:current:{asset}` | 3600s | hourly cron |
| `insights:price_move:{asset}:{window}:{ts_bucket}` | 300s | on-demand |

### 8.3 New Cron

`app/api/cron/refresh-regime-convergence/route.ts` — hourly. For each asset with sufficient Tier 1 data:

1. Read cached domain inputs (derivatives + options + on-chain caches already populated by Phase 1–5 crons).
2. Build feature vector.
3. Call `/regime/classify` with persistence filter context.
4. Persist `RegimeSnapshot`.
5. Call `/convergence/score`.
6. Persist `ConvergenceSnapshot`.
7. Warm both current caches.

`vercel.json` addition:
```json
{ "path": "/api/cron/refresh-regime-convergence", "schedule": "0 * * * *" }
```

Scheduled at the top of every hour, after the on-chain and options refresh crons have had time to complete.

### 8.4 Daily Forward-Returns Cron

A separate daily job (or part of the same hourly cron run once per day) recomputes forward-return distributions. This is heavier than the hourly classification because it walks historical snapshots — running hourly would be wasteful.

---

## 9. Database Changes

### 9.1 New Prisma Models

```prisma
// Per-asset, per-hour regime classification
model RegimeSnapshot {
  id                  String   @id @default(cuid())
  asset               String
  timestamp           DateTime

  rawClassification   String                // what the raw rules produced
  committedRegime     String                // what's persisted after persistence filter
  regimeChanged       Boolean  @default(false)
  prevRegime          String?               // what the prev committed regime was (for transitions)

  confidence          Float
  featureVector       Json                  // full feature snapshot for debugging
  featureSupport      Json                  // supporting / neutral / conflicting feature lists

  createdAt           DateTime @default(now())

  @@unique([asset, timestamp])
  @@index([asset, timestamp])
  @@index([committedRegime, timestamp])
}

// Per-asset, per-hour convergence snapshot
model ConvergenceSnapshot {
  id                    String   @id @default(cuid())
  asset                 String
  timestamp             DateTime

  derivativesScore      Float
  optionsScore          Float?              // nullable if options domain has no data
  onchainScore          Float?              // nullable if onchain domain has no data
  composite             Float
  convergenceStrength   String              // strong_convergence | moderate_convergence | weak_convergence | divergence | insufficient_data

  contributors          Json                // per-domain top-contributor breakdown

  createdAt             DateTime @default(now())

  @@unique([asset, timestamp])
  @@index([asset, timestamp])
}
```

**Retention**: both indefinite. Hourly × small row footprint × analytical value = keep.

### 9.2 Alert Types

Two new alert types:

```ts
"regime_change"         // Fires when committedRegime transitions
"convergence_threshold" // Fires when composite crosses a user-set value
```

`regime_change` uses the `"changed"` condition introduced in Phase 5 Slice 3 and the `Alert.lastObservedState` column — exact same mechanism as `mvrv_regime_change`, just with a different source field (`ctx.currentRegime?.committedRegime`).

`convergence_threshold` uses the existing `"crosses_above"` / `"crosses_below"` conditions and the `PREV_KEY` Redis pattern (ephemeral state is fine here — missed crossings self-correct at next evaluation).

Evaluator extensions:
- `EvalContext` gains `currentRegime?: RegimeSnapshot`, `currentConvergence?: ConvergenceSnapshot`.
- New switch cases in `evaluator.ts` for the two new types.
- `screener-warmer.ts` fetches the two new Redis keys before invoking evaluator — same pattern as Slice 3.

---

## 10. File Structure

### 10.1 New Files

```
# Quant Engine
quant-engine/app/core/regime.py                      # Feature builder + classifier + persistence filter
quant-engine/app/core/forward_returns.py             # Historical return distribution calc
quant-engine/app/core/convergence.py                 # Per-domain + composite scorer
quant-engine/app/core/insights.py                    # Price-move evidence aggregator + pattern match
quant-engine/app/core/pattern_library.py             # The 5 patterns config + matching logic
quant-engine/app/routes/regime.py                    # /regime/classify, /regime/forward-returns
quant-engine/app/routes/convergence.py               # /convergence/score
quant-engine/app/routes/insights.py                  # /insights/price-move
quant-engine/tests/test_regime.py
quant-engine/tests/test_convergence.py
quant-engine/tests/test_insights.py
quant-engine/notebooks/regime_backtest.ipynb         # 2-year validation notebook

# Frontend — pages
scope-alpha/frontend/app/(app)/terminal/regime/page.tsx
scope-alpha/frontend/app/(app)/terminal/convergence/page.tsx

# Frontend — components
scope-alpha/frontend/components/regime/RegimeView.tsx
scope-alpha/frontend/components/regime/RegimeTimelineHeatmap.tsx
scope-alpha/frontend/components/regime/FeatureContributionsPanel.tsx
scope-alpha/frontend/components/regime/ForwardReturnsTable.tsx
scope-alpha/frontend/components/convergence/ConvergenceView.tsx
scope-alpha/frontend/components/convergence/DomainScorePanel.tsx
scope-alpha/frontend/components/convergence/CompositeHistoryChart.tsx
scope-alpha/frontend/components/insights/WhyIsPriceMovingCard.tsx

# Frontend — hooks
scope-alpha/frontend/hooks/useRegime.ts
scope-alpha/frontend/hooks/useRegimeHistory.ts
scope-alpha/frontend/hooks/useForwardReturns.ts
scope-alpha/frontend/hooks/useConvergence.ts
scope-alpha/frontend/hooks/useConvergenceHistory.ts
scope-alpha/frontend/hooks/useActiveInsights.ts       # Trigger logic for price-move card
scope-alpha/frontend/hooks/usePriceMoveInsight.ts

# Frontend — API routes
scope-alpha/frontend/app/api/market/regime/current/route.ts
scope-alpha/frontend/app/api/market/regime/history/route.ts
scope-alpha/frontend/app/api/market/regime/forward-returns/route.ts
scope-alpha/frontend/app/api/market/convergence/current/route.ts
scope-alpha/frontend/app/api/market/convergence/history/route.ts
scope-alpha/frontend/app/api/market/insights/price-move/route.ts

# Frontend — cron
scope-alpha/frontend/app/api/cron/refresh-regime-convergence/route.ts

# Frontend — feature builder (TS side)
scope-alpha/frontend/lib/regime/feature-builder.ts    # Assembles feature vectors from cached domain data
scope-alpha/frontend/lib/regime/regime-colors.ts      # Shared color map for timeline / badges

# Types
scope-alpha/frontend/types/regime.ts
scope-alpha/frontend/types/convergence.ts
scope-alpha/frontend/types/insights.ts
```

### 10.2 Files to Modify

```
# Frontend
scope-alpha/frontend/lib/quant-engine.ts             # 4 new methods
scope-alpha/frontend/config/navigation.ts            # Add Regime + Convergence nav entries
scope-alpha/frontend/app/api/alerts/route.ts         # Add 2 alert types
scope-alpha/frontend/lib/alerts/evaluator.ts         # 2 new switch cases + EvalContext extension
scope-alpha/frontend/lib/market/screener-warmer.ts   # Fetch 2 new Redis keys for evaluator context
scope-alpha/frontend/prisma/schema.prisma            # 2 new models
scope-alpha/frontend/vercel.json                     # 1 new cron entry
scope-alpha/frontend/app/(app)/terminal/derivatives/page.tsx  # Regime badge in header
scope-alpha/frontend/components/layout/TerminalLayout.tsx     # WhyIsPriceMovingCard rendering

# Quant Engine
quant-engine/app/main.py                             # Register 3 new routers
quant-engine/app/models/inputs.py                    # Add regime/convergence/insights inputs
quant-engine/app/models/outputs.py                   # Add regime/convergence/insights outputs
```

---

## 11. Proposed Slicing

Phase 6 scope fits the three-slice pattern established in Phase 5. Each slice delivers a working vertical.

### Slice 1 — Regime Classifier (~50% of Phase 6)

**Deliverables**:
- Python: `core/regime.py` with feature builder + rules classifier + persistence filter + confidence scoring + tests.
- Python: `/regime/classify` and `/regime/forward-returns` endpoints.
- Python: `notebooks/regime_backtest.ipynb` — 2-year validation on BTC (derivatives + MVRV only; shallow-history features skipped).
- Frontend: `RegimeSnapshot` Prisma migration.
- Frontend: feature-builder library assembling vectors from cached domain data.
- Frontend: `/api/market/regime/current`, `/history`, `/forward-returns` routes.
- Frontend: `/terminal/regime` page with label, confidence, timeline heatmap, feature contributions, forward-returns table.
- Frontend: nav entry for Regime.
- Frontend: `refresh-regime-convergence` cron (regime portion; convergence portion stubbed for Slice 2).
- Frontend: `regime_change` alert type + evaluator case.

**End state**: `/terminal/regime` renders live with current regime + 90d timeline + forward-return distribution for BTC and ETH. Regime-change alerts fire on transitions.

**Gating blocker before starting**: validation notebook must pass — if the rules classifier produces noisy / unintuitive regime labels on 2 years of BTC history, the rules need tuning before Slice 1 ships the UI.

### Slice 2 — Convergence Engine (~30%)

**Deliverables**:
- Python: `core/convergence.py` with per-domain scorers + composite + strength classifier + tests.
- Python: `/convergence/score` endpoint.
- Frontend: `ConvergenceSnapshot` Prisma migration.
- Frontend: `/api/market/convergence/current` + `/history` routes.
- Frontend: `/terminal/convergence` page with 3-panel layout + composite history chart + alert entry points.
- Frontend: nav entry for Convergence.
- Frontend: `refresh-regime-convergence` cron completion (convergence portion).
- Frontend: `convergence_threshold` alert type + evaluator case.

**End state**: `/terminal/convergence` renders live with 3-panel dashboard. Composite history + convergence-threshold alerts working.

### Slice 3 — "Why is Price Moving?" (~20%)

**Deliverables**:
- Python: `core/insights.py` + `core/pattern_library.py` with evidence aggregator + 5-pattern matcher + tests.
- Python: `/insights/price-move` endpoint.
- Frontend: `/api/market/insights/price-move` route.
- Frontend: `useActiveInsights` trigger hook + `WhyIsPriceMovingCard` component + terminal-layout integration.
- Frontend: contextual metric emphasis (light touch — regime badge + hint on derivatives page).

**End state**: price-move card auto-appears across terminal pages on >3% 1h moves with ranked evidence + pattern match.

**Note**: Slice 3 is the smallest but highest-visibility slice. It's also the one most likely to want iteration after users see it in the wild — v1 ships with 5 patterns; real usage will inform whether more are needed, whether thresholds are right, whether the card is too aggressive or too quiet.

---

## 12. Definition of Done

### Quant Engine
- [ ] `/regime/classify` returns committed regime + raw classification + confidence + feature support
- [ ] `/regime/forward-returns` returns valid distribution with sample-size disclosure
- [ ] `/convergence/score` returns per-domain scores + composite + strength
- [ ] `/insights/price-move` returns pattern + ranked evidence within 500ms
- [ ] Persistence filter prevents single-hour regime flicker in backtest
- [ ] Backtest notebook validates regime assignments on 2y of BTC history (derivatives + MVRV subset)
- [ ] All four endpoints have unit tests; integration tests cover the persistence-filter + missing-domain edge cases
- [ ] Deployed to Railway/Fly.io

### Frontend
- [ ] `/terminal/regime` renders live regime + confidence + 90d timeline + feature contributions + forward returns
- [ ] `/terminal/convergence` renders 3-panel dashboard + composite history
- [ ] "Why is price moving?" card auto-appears on terminal pages when triggered; dismissible; auto-clears
- [ ] Regime badge + context hint on `/terminal/derivatives`
- [ ] Both `regime_change` and `convergence_threshold` alerts create + fire correctly (using `Alert.lastObservedState` pattern from Slice 3)
- [ ] All views degrade to `UnavailableBanner` when Quant Engine is inert
- [ ] Low-confidence regimes (< 50%) show "Contested signal" badge

### Infrastructure
- [ ] `refresh-regime-convergence` cron running hourly
- [ ] Forward-returns recomputed daily
- [ ] `RegimeSnapshot` + `ConvergenceSnapshot` persisting
- [ ] Cache keys and TTLs match §8.2

### Technical
- [ ] Zero TypeScript errors
- [ ] Pydantic validation on all Quant Engine inputs
- [ ] Quant Engine endpoints respond within stated latency targets
- [ ] Backtest notebook checked into `quant-engine/notebooks/`

---

## 13. Open Decisions

1. **Regime state count (5 vs simpler).** v1 proposes 5. A simpler 3-state version (`bull` / `bear` / `neutral`) is easier to validate but loses the tail-event signal. A more granular 7-state version is feasible but loses discriminability on the data we have. **Recommendation: ship 5 states as specced.** Revisit after 6 months of live data.

2. **Persistence-filter commit threshold.** v1 requires 2 consecutive agreeing classifications to commit a regime change. An alternative is a time-weighted approach (e.g., 3 of last 4 hours agree). **Recommendation: ship the simpler 2-of-2 rule.** Revisit if timeline still looks flickery after 30 days of live data.

3. **Convergence weight defaults.** v1 defaults to 40% derivatives / 30% options / 30% on-chain. Arguments exist for 50/25/25 (derivatives has tightest short-term relationship) or equal 33/33/33 (no domain gets structural preference). **Recommendation: ship 40/30/30 and instrument user feedback.** User-overridable weights become a Phase 8 feature bundled with screener customization.

4. **"Why is price moving?" threshold.** v1 fixed at `|Δ_1h| > 3%`. 2% would fire more often (noisier); 5% would miss meaningful moves. **Recommendation: ship 3% and allow user override in preferences after Phase 8.** Monitor fire rate for first 2 weeks — if it's firing 10+ times per day per asset, tighten.

5. **Backtest scope.** v1 notebook validates on BTC only with 2-year depth. ETH backfill is shorter (~2 years from CoinMetrics community). Altcoins have no meaningful history. **Recommendation: ship BTC-only validation for v1.** Document which assets are classifier-ready and which are "insufficient data" in the regime page.

6. **Pattern library extensibility.** v1 ships 5 patterns hardcoded in Python. Longer-term the pattern library should be a Postgres table users (or admin) can extend. **Recommendation: Python file for v1, migrate to DB-backed config in Phase 8 or later if it becomes friction.**

7. **Shallow-history feature inclusion.** GEX regime (3 weeks live), flow regime (since Slice 2), whale intensity (since Slice 2). Including them in the classifier v1 weighting is risky — too little history to know how they behave across regimes. **Recommendation: feature vector INCLUDES these fields but with modifier-only weight (Tier 3); they influence confidence but not the primary classification.** Upgrade to Tier 2 weight once they have 6 months of live history.

8. **Regime classifier for altcoins.** SOL, AVAX, etc. have funding/OI/liquidation data (Phase 1) but no options and limited on-chain. Classifier can run on derivatives-only inputs but confidence will be structurally lower. **Recommendation: ship BTC + ETH full-classifier v1; add "derivatives-only" classifier for altcoins as a Slice 2 or Phase 7 extension.** Don't pretend we have full coverage where we don't.

---

## 14. What This Enables

Phase 6 completes the synthesis layer the platform was architected around. After this:

- **User value, directly.** The "Why is price moving?" card is the most visible feature on the platform — every time BTC moves 3%+, users see cross-domain evidence synthesis that no single-source tool produces. The regime + convergence dashboards are the daily-driver views that institutional desks build internally and retail has never had.
- **Phase 7 (Sentiment & Macro)** plugs into convergence as the 4th panel. Regime classifier gains sentiment + correlation features.
- **Phase 8 (Quant Tools)** uses regime + convergence as screener filters ("show me all assets in `trending_bull` with composite > +60") and backtest conditioning variables ("run this strategy only during `strong_convergence`").
- **Phase 9 (Alerts & Polish)** extends regime + convergence alerts with email/Telegram delivery.
- **Alert sophistication**. `regime_change` and `convergence_threshold` are cross-domain alerts that are structurally impossible on any single-source platform. They are the clearest user-facing manifestation of the synthesis thesis.
- **ML roadmap preservation.** The rules classifier's feature vector is exactly what an ML classifier would take as input. When we have 12+ months of live data including shallow-history features, the ML upgrade is "train a model on the same inputs" — no rework of the data plumbing.

Phase 6 is the phase that tests whether the synthesis thesis holds. If users find these features genuinely useful, the platform's differentiation is validated. If they don't, the remaining phases need rethinking.

---

*This PRD is a draft. Finalize after Phase 5 Slice 3 ships and verified, and after the v4 roadmap revision documents Phase 5's final shape. The slicing proposal is a starting point — Claude Code's implementation-plan pass will surface adjustments. Particular attention to §11 Open Decisions and §2 Data Maturity before Slice 1 kicks off.*
