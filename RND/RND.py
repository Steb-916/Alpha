import numpy as np
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from matplotlib.widgets import Slider as MSlider, Button, TextBox
from scipy.stats import norm
from scipy.interpolate import UnivariateSpline
from mpl_toolkits.mplot3d import Axes3D
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
import pytz

plt.style.use('dark_background')

# ============================================================
# CHANGE-SIGNAL CACHE  (prior snapshot for ∆ metrics)
# ============================================================
_prior_snapshot = {}   # keyed by ticker → {exp_str: {atm_iv, rr, skew, left_mass}}

def save_snapshot(ticker, term_rows, greek_rows):
    """Store current surface metrics so next refresh can compute deltas."""
    snap = {}
    for row in term_rows:
        key = row['T_days']
        gk  = row.get('greeks')
        snap[key] = {
            'atm_iv':    gk['atm_iv']  if gk else None,
            'rr':        gk['rr_25d']  if gk else None,
            'skew':      row['skew'],
            'left_mass': row.get('left_mass_1pct', None),
        }
    _prior_snapshot[ticker] = snap

def get_deltas(ticker, T_days, atm_iv, rr, skew, left_mass):
    """Return dict of ∆ vs prior snapshot, or None if no prior."""
    snap = _prior_snapshot.get(ticker, {}).get(T_days)
    if snap is None:
        return None
    def _d(new, old, label):
        if new is None or old is None:
            return f'{label}: N/A'
        return f'{label}: {new - old:+.3f}'
    return {
        'datm_iv':    (atm_iv    - snap['atm_iv'])    if (atm_iv    and snap['atm_iv'])    else None,
        'drr':        (rr        - snap['rr'])         if (rr        and snap['rr'])         else None,
        'dskew':      (skew      - snap['skew'])       if (skew      is not None and snap['skew'] is not None) else None,
        'dleft_mass': (left_mass - snap['left_mass'])  if (left_mass is not None and snap['left_mass'] is not None) else None,
    }

# ============================================================
# MARKET HOURS CHECK
# ============================================================
def is_market_open():
    """Returns True if US equity market is currently open."""
    et = pytz.timezone('America/New_York')
    now_et = datetime.now(et)
    if now_et.weekday() >= 5:  # Saturday=5, Sunday=6
        return False
    market_open  = now_et.replace(hour=9,  minute=30, second=0, microsecond=0)
    market_close = now_et.replace(hour=16, minute=0,  second=0, microsecond=0)
    return market_open <= now_et <= market_close

def fetch_realized_vol(ticker_obj, windows=(5, 10)):
    """
    Fetch daily close history and compute annualized realized vol
    for each window (in trading days). Returns dict {5: rv5, 10: rv10, ...}.
    Also returns intraday range (high-low / open) as % for most recent day.
    """
    try:
        hist = ticker_obj.history(period='30d')
        if len(hist) < max(windows) + 1:
            return {w: None for w in windows}, None
        log_rets = np.log(hist['Close'] / hist['Close'].shift(1)).dropna().values
        rv = {}
        for w in windows:
            if len(log_rets) >= w:
                rv[w] = float(np.std(log_rets[-w:]) * np.sqrt(252))
            else:
                rv[w] = None
        # Intraday range: (High - Low) / Open for most recent bar
        last = hist.iloc[-1]
        intraday_range_pct = float((last['High'] - last['Low']) / last['Open'] * 100) if last['Open'] > 0 else None
        return rv, intraday_range_pct
    except Exception as e:
        print(f"    realized vol fetch error: {e}")
        return {w: None for w in windows}, None

# ============================================================
# QUOTE QUALITY FILTER
# ============================================================
def filter_quotes(df, spot, is_call, max_spread_ratio=2.0, min_oi=0):
    """
    pre-filter before any smoothing or parity calc.
    Drops strikes where:
      - bid <= 0 or ask <= 0
      - ask/bid > max_spread_ratio
      - mid violates intrinsic bounds
      - OI below threshold (if available)
    Returns cleaned df, count of dropped rows, and liquidity metrics dict.
    """
    original_len = len(df)
    df = df.copy()

    # Must have positive bid AND ask
    df = df[(df['bid'] > 0) & (df['ask'] > 0)]

    # Spread ratio filter
    df = df[df['ask'] / df['bid'].clip(lower=0.001) <= max_spread_ratio]

    # Intrinsic bound check
    df['mid'] = (df['bid'] + df['ask']) / 2
    if is_call:
        intrinsic = np.maximum(0, spot - df['strike'])
    else:
        intrinsic = np.maximum(0, df['strike'] - spot)
    df = df[df['mid'] >= intrinsic * 0.95]  # allow 5% tolerance

    # OI filter if column exists and threshold set
    if min_oi > 0 and 'openInterest' in df.columns:
        df = df[df['openInterest'] >= min_oi]

    dropped = original_len - len(df)

    # --- Liquidity metrics ---
    liq = {}
    if len(df) > 0:
        spreads = df['ask'] - df['bid']
        mids    = df['mid'].clip(lower=0.01)
        rel_spreads = spreads / mids
        liq['avg_bid_ask_width']    = float(spreads.mean())
        liq['avg_rel_spread']       = float(rel_spreads.mean())
        liq['pct_strikes_retained'] = float(len(df) / max(original_len, 1))
        if 'openInterest' in df.columns:
            liq['total_oi'] = int(df['openInterest'].sum())
        if 'volume' in df.columns:
            liq['total_vol'] = int(df['volume'].fillna(0).sum())
    else:
        liq = {'avg_bid_ask_width': None, 'avg_rel_spread': None,
               'pct_strikes_retained': 0.0}

    return df, dropped, liq


# ============================================================
# ADAPTIVE STEP SIZE
# ============================================================
def calc_k_step(K_common):
    K_range   = K_common[-1] - K_common[0]
    step_size = K_range * 0.02
    return max(1, int(step_size / (K_common[1] - K_common[0])))

# ============================================================
# IMPLIED FORWARD FROM PUT-CALL PARITY
# ============================================================
def infer_forward(calls, puts, spot, T, r=0.05):
    """
    only use near-ATM, liquid pairs for parity forward.
    Reports dispersion — high dispersion flags expiry as unreliable.
    """
    try:
        # Only near-ATM strikes (within ±5% of spot)
        atm_band = spot * 0.05
        calls_atm = calls[
            (calls['bid'] > 0) & (calls['ask'] > 0) &
            (abs(calls['strike'] - spot) <= atm_band)
        ][['strike', 'bid', 'ask']].copy()
        puts_atm = puts[
            (puts['bid'] > 0) & (puts['ask'] > 0) &
            (abs(puts['strike'] - spot) <= atm_band)
        ][['strike', 'bid', 'ask']].copy()

        calls_atm['mid'] = (calls_atm['bid'] + calls_atm['ask']) / 2
        puts_atm['mid']  = (puts_atm['bid']  + puts_atm['ask'])  / 2

        merged = pd.merge(
            calls_atm[['strike', 'mid']],
            puts_atm[['strike',  'mid']],
            on='strike', suffixes=('_c', '_p')
        )

        if len(merged) < 2:
            return None, None, 0

        merged['F_impl'] = merged['strike'] + np.exp(r * T) * (
            merged['mid_c'] - merged['mid_p']
        )

        # Filter obviously bad parity values
        merged = merged[merged['F_impl'].between(spot * 0.85, spot * 1.15)]
        if len(merged) < 2:
            return None, None, 0

        fwd_median = float(merged['F_impl'].median())
        fwd_iqr    = float(merged['F_impl'].quantile(0.75) -
                           merged['F_impl'].quantile(0.25))
        n_pairs    = len(merged)

        return fwd_median, fwd_iqr, n_pairs

    except:
        return None, None, 0

# ============================================================
# MATURITY-DEPENDENT STRIKE BOUNDS
# ============================================================
def get_strike_bounds(spot, T, atm_iv=0.20, n_sigma=5.0):
    sigma_t = atm_iv * np.sqrt(max(T, 1/365))
    lower   = spot * np.exp(-n_sigma * sigma_t)
    upper   = spot * np.exp( n_sigma * sigma_t)
    lower   = max(lower, spot * 0.50)
    upper   = min(upper, spot * 2.00)
    return lower, upper

# ============================================================
# FETCH AND CLEAN ONE EXPIRATION
# ============================================================
def fetch_and_clean(ticker_obj, exp_date, spot, T, r=0.05, market_open=True):
    try:
        chain = ticker_obj.option_chain(exp_date)
        calls = chain.calls.copy()
        puts  = chain.puts.copy()

        # --- Quote quality filter ---
        # Tighter spread ratio near ATM, looser in wings
        calls_filtered, calls_dropped, calls_liq = filter_quotes(
            calls, spot, is_call=True, max_spread_ratio=2.0)
        puts_filtered, puts_dropped, puts_liq = filter_quotes(
            puts, spot, is_call=False, max_spread_ratio=2.0)

        # Merge liquidity metrics (average across calls+puts)
        liq_metrics = {}
        for k in ['avg_bid_ask_width', 'avg_rel_spread', 'pct_strikes_retained']:
            vals = [v for v in [calls_liq.get(k), puts_liq.get(k)] if v is not None]
            liq_metrics[k] = float(np.mean(vals)) if vals else None
        for k in ['total_oi', 'total_vol']:
            vals = [v for v in [calls_liq.get(k), puts_liq.get(k)] if v is not None]
            liq_metrics[k] = int(sum(vals)) if vals else None

        total_raw     = len(calls) + len(puts)
        total_kept    = len(calls_filtered) + len(puts_filtered)
        drop_pct      = (total_raw - total_kept) / max(total_raw, 1)

        # if >30% of strikes fail spread filter, mark unreliable
        quote_reliable = drop_pct < 0.30 and market_open

        # Fall back to IV-only filtering when market closed or quotes unreliable
        if not quote_reliable:
            calls_filtered = calls[
                (calls['impliedVolatility'] > 0.01) &
                (calls['impliedVolatility'] < 5.0)
            ].copy()
            puts_filtered = puts[
                (puts['impliedVolatility'] > 0.01) &
                (puts['impliedVolatility'] < 5.0)
            ].copy()

        # Strike bounds
        if T < 5/365:
            lower = spot * 0.90
            upper = spot * 1.10
        else:
            atm_calls = calls[(calls['strike'] - spot).abs() < spot * 0.10]
            atm_iv    = float(atm_calls['impliedVolatility'].median()) if len(atm_calls) > 0 else 0.20
            atm_iv    = np.clip(atm_iv, 0.08, 1.5)
            lower, upper = get_strike_bounds(spot, T, atm_iv=atm_iv, n_sigma=5.0)
            lower = min(lower, spot * 0.80)
            upper = max(upper, spot * 1.20)

        calls_clean = calls_filtered[
            (calls_filtered['strike'] >= lower) &
            (calls_filtered['strike'] <= upper) &
            (calls_filtered['impliedVolatility'] > 0.01) &
            (calls_filtered['impliedVolatility'] < 5.0)
        ].copy()
        puts_clean = puts_filtered[
            (puts_filtered['strike'] >= lower) &
            (puts_filtered['strike'] <= upper) &
            (puts_filtered['impliedVolatility'] > 0.01) &
            (puts_filtered['impliedVolatility'] < 5.0)
        ].copy()

        # Forward inference — ATM liquid pairs only
        fwd_impl, fwd_iqr, n_pairs = infer_forward(
            calls_clean, puts_clean, spot, T, r)

        status_str = 'LIVE' if (market_open and quote_reliable) else 'OFFHOURS'
        print(f"    [{status_str}] bounds:{lower:.0f}-{upper:.0f}  "
              f"calls:{len(calls_clean)}  puts:{len(puts_clean)}  "
              f"drop:{drop_pct*100:.0f}%  "
              f"fwd:{fwd_impl:.2f}(±{fwd_iqr:.2f},n={n_pairs})" if fwd_impl
              else f"    [{status_str}] bounds:{lower:.0f}-{upper:.0f}  "
              f"calls:{len(calls_clean)}  puts:{len(puts_clean)}  "
              f"drop:{drop_pct*100:.0f}%  fwd:N/A")

        return calls_clean, puts_clean, fwd_impl, fwd_iqr, n_pairs, quote_reliable, liq_metrics

    except Exception as e:
        print(f"    fetch error: {e}")
        return None, None, None, None, 0, False, {}

# ============================================================
# BUILD DENSITY FROM ONE EXPIRATION
# ============================================================
def build_density(spot, calls, puts, T, fwd_impl=None, r=0.05, is_american=False):
    otm_calls = calls[calls['strike'] >  spot][['strike', 'impliedVolatility']].copy()
    otm_puts  = puts[ puts['strike']  <= spot][['strike', 'impliedVolatility']].copy()

    # IV cleaning
    for df in [otm_calls, otm_puts]:
        df.drop(df[df['impliedVolatility'] > 2.0].index,  inplace=True)
        df.drop(df[df['impliedVolatility'] < 0.02].index, inplace=True)

    # American EE adjustment — puts only, T > 2 weeks only
    if is_american and T > 2/52:
        ee_haircut = np.clip(r * T * 0.5, 0.0, 0.03)
        otm_puts['impliedVolatility'] = (
            otm_puts['impliedVolatility'] - ee_haircut
        ).clip(0.02)

    iv_data = (
        pd.concat([
            otm_puts[['strike', 'impliedVolatility']],
            otm_calls[['strike', 'impliedVolatility']]
        ])
        .drop_duplicates('strike')
        .sort_values('strike')
        .dropna()
    )

    if len(iv_data) < 10:
        return None, None

    strikes = iv_data['strike'].values
    ivs     = iv_data['impliedVolatility'].values

    iv_median = np.median(ivs)
    iv_mask   = np.abs(ivs - iv_median) < 3 * np.std(ivs)
    strikes   = strikes[iv_mask]
    ivs       = ivs[iv_mask]

    if len(strikes) < 8:
        return None, None

    try:
        spline = UnivariateSpline(strikes, ivs, s=len(strikes) * 0.003, k=4)
    except:
        return None, None

    atm_iv_est       = float(np.clip(spline(spot), 0.05, 1.5))
    K_left_ext, K_right_ext = get_strike_bounds(spot, T, atm_iv=atm_iv_est, n_sigma=5.0)
    K_dense          = np.linspace(K_left_ext, K_right_ext, 800)
    iv_interior      = np.clip(spline(K_dense), 0.01, 2.0)

    # ---- Improved wing model: lognormal tail match ----
    # At the boundary of observed data, match level AND slope from spline,
    # then blend into a lognormal (flat) tail so density stays non-negative.
    iv_at_left  = float(np.clip(spline(strikes.min()), 0.02, 2.0))
    iv_at_right = float(np.clip(spline(strikes.max()), 0.02, 2.0))

    # Slope at boundary (finite diff over inner 5%)
    left_ref   = strikes.min() * 1.02
    right_ref  = strikes.max() * 0.98
    dIV_dK_left  = float((spline(left_ref)  - iv_at_left)  / (left_ref  - strikes.min() + 1e-8))
    dIV_dK_right = float((iv_at_right - spline(right_ref)) / (strikes.max() - right_ref + 1e-8))

    iv_smooth  = iv_interior.copy()
    left_mask  = K_dense < strikes.min()
    right_mask = K_dense > strikes.max()

    if left_mask.any():
        dist_left = strikes.min() - K_dense[left_mask]
        # Linear extrapolation clipped to not go below 0.5× boundary IV
        iv_ext = iv_at_left - dIV_dK_left * dist_left
        iv_ext = np.clip(iv_ext, iv_at_left * 0.5, 2.0)
        # Blend with flat (lognormal-like) tail over distance > 5% of spot
        blend_weight = np.clip(dist_left / (spot * 0.05), 0, 1)
        iv_smooth[left_mask] = (1 - blend_weight) * iv_ext + blend_weight * iv_at_left

    if right_mask.any():
        dist_right = K_dense[right_mask] - strikes.max()
        iv_ext = iv_at_right + dIV_dK_right * dist_right
        iv_ext = np.clip(iv_ext, iv_at_right * 0.5, 2.0)
        blend_weight = np.clip(dist_right / (spot * 0.05), 0, 1)
        iv_smooth[right_mask] = (1 - blend_weight) * iv_ext + blend_weight * iv_at_right

    iv_smooth      = np.convolve(iv_smooth, np.ones(15) / 15, mode='same')
    iv_smooth[:7]  = iv_smooth[7]
    iv_smooth[-7:] = iv_smooth[-7]
    iv_smooth      = np.clip(iv_smooth, 0.01, 2.0)

    def bs_call(S, K, T, r, sigma):
        with np.errstate(divide='ignore', invalid='ignore'):
            d1 = (np.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))
            d2 = d1 - sigma * np.sqrt(T)
            return S * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2)

    call_prices = bs_call(spot, K_dense, T, r, iv_smooth)

    # ---- Arbitrage constraints: enforce monotonicity (call prices non-increasing) ----
    for i in range(1, len(call_prices)):
        if call_prices[i] > call_prices[i - 1]:
            call_prices[i] = call_prices[i - 1]

    # ---- Convexity: enforce call_prices[i] >= 0.5*(call_prices[i-1]+call_prices[i+1]) ----
    for i in range(1, len(call_prices) - 1):
        call_prices[i] = max(call_prices[i],
                              0.5 * (call_prices[i - 1] + call_prices[i + 1]))

    # ---- Calendar monotonicity: not enforced here (per-slice) — handled by surface interp ----

    dK           = K_dense[1] - K_dense[0]
    first_deriv  = np.diff(call_prices) / dK
    second_deriv = np.diff(first_deriv) / dK
    K_density    = K_dense[1:-1]
    density      = np.exp(r * T) * second_deriv

    # ---- Hard non-negativity: no negative densities ----
    density = np.clip(density, 0, None)
    if density.max() > 0:
        p99     = np.percentile(density[density > 0], 99)
        density = np.clip(density, 0, p99)

    return K_density, density


# ============================================================
# STATS
# ============================================================
def compute_stats(K_density, density):
    dK   = K_density[1] - K_density[0]
    mass = np.sum(density) * dK
    if mass < 1e-6:
        return 0, 0, 0, 0, 0
    dn       = density / mass
    mean     = np.sum(K_density * dn) * dK
    std      = np.sqrt(np.sum((K_density - mean)**2 * dn) * dK)
    skewness = np.sum(((K_density - mean) / (std + 1e-9))**3 * dn) * dK
    cdf      = np.cumsum(dn * dK)
    p5       = K_density[np.searchsorted(cdf, 0.05)]
    p95      = K_density[np.searchsorted(cdf, 0.95)]
    return mean, std, skewness, p5, p95


def compute_tail_metrics(K_density, density, spot):
    """
    Compute standardized tail probabilities and expected shortfall (ES).
    Returns dict with:
      - P[ret < -1%], P[ret < -2%], P[ret < -3%]  (risk-neutral, Q-measure)
      - ES_1pct, ES_5pct  (conditional expected loss beyond threshold)
      - left_mass_1pct  (probability mass below spot*0.99)
    """
    dK   = K_density[1] - K_density[0]
    mass = np.sum(density) * dK
    if mass < 1e-6:
        return {}

    dn  = density / mass
    cdf = np.cumsum(dn * dK)

    def prob_below(threshold_spot):
        K_thresh = spot * threshold_spot
        idx = np.searchsorted(K_density, K_thresh)
        if idx <= 0:
            return 0.0
        if idx >= len(cdf):
            return 1.0
        return float(cdf[min(idx, len(cdf)-1)])

    def es_below(prob_level):
        """Expected shortfall: E[K | K < VaR(prob_level)] / spot - 1"""
        if prob_level <= 0 or prob_level >= 1:
            return None
        # Find VaR level
        var_idx = np.searchsorted(cdf, prob_level)
        if var_idx <= 0:
            return None
        tail_dn    = dn[:var_idx]
        tail_K     = K_density[:var_idx]
        tail_mass  = np.sum(tail_dn) * dK
        if tail_mass < 1e-9:
            return None
        tail_mean  = np.sum(tail_K * tail_dn) * dK / tail_mass
        return float(tail_mean / spot - 1)

    p_1pct  = prob_below(0.99)
    p_2pct  = prob_below(0.98)
    p_3pct  = prob_below(0.97)
    es_1pct = es_below(0.01)
    es_5pct = es_below(0.05)

    return {
        'p_down_1pct':    round(p_1pct  * 100, 3),
        'p_down_2pct':    round(p_2pct  * 100, 3),
        'p_down_3pct':    round(p_3pct  * 100, 3),
        'es_1pct_ret':    round(es_1pct * 100, 3) if es_1pct is not None else None,
        'es_5pct_ret':    round(es_5pct * 100, 3) if es_5pct is not None else None,
        'left_mass_1pct': round(p_1pct  * 100, 3),
    }


def compute_confidence_score(mass, fwd_err, spot, fwd_iqr, pct_retained, avg_rel_spread, reliable):
    """
    Single numeric confidence score 0–100 for a density slice.
    Components:
      - Mass score:        mass in [0.9, 1.1] → 30 pts
      - Fwd error score:   fwdErr < 0.5% spot → 25 pts
      - Fwd IQR score:     IQR < 0.3 → 15 pts
      - Retention score:   % strikes retained > 70% → 15 pts
      - Spread score:      avg rel spread < 0.5 → 15 pts
    Halved if not reliable (off-hours).
    """
    score = 0.0

    # Mass score (30 pts)
    if 0.90 <= mass <= 1.10:
        score += 30
    elif 0.80 <= mass <= 1.20:
        score += 15

    # Forward error score (25 pts)
    fwd_err_pct = fwd_err / max(spot, 1)
    if fwd_err_pct < 0.005:
        score += 25
    elif fwd_err_pct < 0.015:
        score += 12

    # Forward IQR score (15 pts)
    if fwd_iqr is not None and fwd_iqr != 'N/A':
        try:
            iqr = float(fwd_iqr)
            if iqr < 0.3:
                score += 15
            elif iqr < 1.0:
                score += 7
        except:
            pass

    # Strike retention (15 pts)
    if pct_retained is not None:
        if pct_retained >= 0.70:
            score += 15
        elif pct_retained >= 0.50:
            score += 7

    # Spread quality (15 pts)
    if avg_rel_spread is not None:
        if avg_rel_spread < 0.30:
            score += 15
        elif avg_rel_spread < 0.60:
            score += 7

    if not reliable:
        score *= 0.5

    return round(score, 1)



# ============================================================
# LOAD TICKER
# ============================================================
def load_ticker(ticker_str):
    print(f"\nFetching data for {ticker_str}...")
    ticker_obj  = yf.Ticker(ticker_str)
    spot        = ticker_obj.fast_info['last_price']
    expirations = ticker_obj.options
    today       = datetime.today()
    is_american = not ticker_str.startswith('^')
    mkt_open    = is_market_open()

    print(f"Spot: {spot:.2f}")
    print(f"Option style: {'American' if is_american else 'European'}")
    print(f"Market status: {'OPEN' if mkt_open else 'CLOSED — data quality may be degraded'}")
    if not mkt_open:
        print("  WARNING: Off-hours data. RR/skew metrics unreliable. "
              "Run during market hours (9:30-16:00 ET) for tradeable signals.")

    # Realized vol
    rv, intraday_range = fetch_realized_vol(ticker_obj, windows=(5, 10))
    print(f"Realized Vol: 5d={rv.get(5,'N/A'):.1%} | 10d={rv.get(10,'N/A'):.1%}" if rv.get(5) else "Realized Vol: N/A")
    if intraday_range is not None:
        print(f"Intraday Range (last day): {intraday_range:.2f}%")

    print("Building surface...")

    surface_data = []

    for exp in expirations[:24]:
        exp_dt = datetime.strptime(exp, '%Y-%m-%d')
        T      = max((exp_dt - today).days / 365, 1/365)
        result = fetch_and_clean(ticker_obj, exp, spot, T,
                                  market_open=mkt_open)
        calls, puts, fwd_impl, fwd_iqr, n_pairs, reliable, liq_metrics = result
        if calls is None or (len(calls) + len(puts)) < 5:
            continue
        K_density, density = build_density(
            spot, calls, puts, T,
            fwd_impl=fwd_impl,
            is_american=is_american
        )
        if K_density is None:
            continue
        surface_data.append((T, K_density, density, fwd_impl, fwd_iqr,
                              n_pairs, reliable, liq_metrics))
        fwd_str = f"{fwd_impl:.2f}" if fwd_impl else "N/A"
        print(f"  >>> built {exp}  T={T:.3f}y  fwd={fwd_str}  "
              f"pts={len(K_density)}  reliable={reliable}")

    if len(surface_data) < 2:
        print(f"Not enough data for {ticker_str} — only got {len(surface_data)} slices")
        K_dummy = np.linspace(spot * 0.8, spot * 1.2, 400)
        return (spot, np.array([0.1, 0.2]), np.zeros((2, 400)),
                K_dummy, [None, None], [None, None], [0, 0],
                [False, False], is_american, mkt_open,
                rv, intraday_range, [{}, {}])

    K_min    = min(d[1].min() for d in surface_data)
    K_max    = max(d[1].max() for d in surface_data)
    K_common = np.linspace(K_min, K_max, 400)

    maturities_real = []
    Z_rows          = []
    fwd_list        = []
    fwd_iqr_list    = []
    n_pairs_list    = []
    reliable_list   = []
    liq_list        = []

    for T, K_density, density, fwd_impl, fwd_iqr, n_pairs, reliable, liq_metrics in surface_data:
        interp_density           = np.zeros(len(K_common))
        in_range                 = (K_common >= K_density.min()) & (K_common <= K_density.max())
        interp_density[in_range] = np.interp(K_common[in_range], K_density, density)
        maturities_real.append(T)
        Z_rows.append(interp_density)
        fwd_list.append(fwd_impl)
        fwd_iqr_list.append(fwd_iqr)
        n_pairs_list.append(n_pairs)
        reliable_list.append(reliable)
        liq_list.append(liq_metrics)

    print(f"Successfully built {len(maturities_real)} slices")
    return (spot,
            np.array(maturities_real),
            np.array(Z_rows),
            K_common,
            fwd_list,
            fwd_iqr_list,
            n_pairs_list,
            reliable_list,
            is_american,
            mkt_open,
            rv,
            intraday_range,
            liq_list)

# ============================================================
# INITIAL LOAD
# ============================================================
current_ticker = '^SPX'
(spot, maturities_real, Z_real, K_common,
 fwd_list, fwd_iqr_list, n_pairs_list,
 reliable_list, is_american, mkt_open,
 rv_dict, intraday_range, liq_list) = load_ticker(current_ticker)

n_slices = len(maturities_real)
K_step   = calc_k_step(K_common)

# ============================================================
# STATE
# ============================================================
mat_state = {
    'imin':     0,
    'imax':     n_slices - 1,
    'kmin_idx': 0,
    'kmax_idx': len(K_common) - 1
}

# ============================================================
# FIGURE 1 — 3D Surface
# ============================================================
fig1 = plt.figure(figsize=(14, 8), facecolor='#0d0d0d')
ax3d = fig1.add_subplot(111, projection='3d')
ax3d.set_facecolor('#0d0d0d')

K_grid, T_grid = np.meshgrid(K_common, maturities_real)
surf = ax3d.plot_surface(K_grid, T_grid, Z_real,
                          cmap='plasma', edgecolor='none', alpha=0.95)

cbar = fig1.colorbar(surf, ax=ax3d, shrink=0.5, aspect=10, label='Density')
cbar.ax.yaxis.label.set_color('white')
cbar.ax.tick_params(colors='white')

def style_3d(ax, tmin=None, tmax=None):
    mkt_str = 'LIVE' if mkt_open else 'OFF-HOURS'
    title   = f'{current_ticker} Risk-Neutral Density  [{mkt_str}]  Spot: {spot:.2f}'
    if tmin is not None:
        title += (f'\nT = {tmin:.3f}y to {tmax:.3f}y  '
                  f'({round(tmin*365)}d – {round(tmax*365)}d)')
    ax.set_title(title, fontsize=11, color='white', pad=15)
    ax.set_xlabel('Strike',         color='white', labelpad=10)
    ax.set_ylabel('Maturity (Yrs)', color='white', labelpad=10)
    ax.set_zlabel('Density',        color='white', labelpad=10)
    ax.tick_params(colors='white')
    ax.xaxis.pane.fill = False
    ax.yaxis.pane.fill = False
    ax.zaxis.pane.fill = False
    ax.xaxis.pane.set_edgecolor('#333333')
    ax.yaxis.pane.set_edgecolor('#333333')
    ax.zaxis.pane.set_edgecolor('#333333')
    ax.grid(True, color='#333333', linestyle='--', alpha=0.5)

style_3d(ax3d)
ax3d.view_init(elev=30, azim=-60)

# ============================================================
# FIGURE 2 — 2D Slice + ALL controls
# ============================================================
fig2 = plt.figure(figsize=(14, 10), facecolor='#0d0d0d')
fig2.patch.set_facecolor('#0d0d0d')

gs = gridspec.GridSpec(
    7, 6,
    figure=fig2,
    top=0.93, bottom=0.04,
    left=0.08, right=0.97,
    hspace=0.7, wspace=0.5
)

ax2d = fig2.add_subplot(gs[0:3, :])
ax2d.set_facecolor('#0d0d0d')

ax_trade   = fig2.add_subplot(gs[3, 0:3])
ax_ticker  = fig2.add_subplot(gs[3, 3])
ax_refresh = fig2.add_subplot(gs[3, 4])
ax_report  = fig2.add_subplot(gs[3, 5])

ax_elev       = fig2.add_subplot(gs[4, :4])
ax_elev.set_facecolor('#2a2a2a')
ax_btn_kmin_m = fig2.add_subplot(gs[4, 4])
ax_btn_kmin_p = fig2.add_subplot(gs[4, 5])

ax_azim       = fig2.add_subplot(gs[5, :4])
ax_azim.set_facecolor('#2a2a2a')
ax_btn_kmax_m = fig2.add_subplot(gs[5, 4])
ax_btn_kmax_p = fig2.add_subplot(gs[5, 5])

ax_btn_min_m      = fig2.add_subplot(gs[6, 0])
ax_btn_min_p      = fig2.add_subplot(gs[6, 1])
ax_mat_display    = fig2.add_subplot(gs[6, 2])
ax_btn_max_m      = fig2.add_subplot(gs[6, 3])
ax_btn_max_p      = fig2.add_subplot(gs[6, 4])
ax_strike_display = fig2.add_subplot(gs[6, 5])

for ax in [ax_mat_display, ax_strike_display]:
    ax.set_facecolor('#1a1a1a')
    ax.set_xticks([])
    ax.set_yticks([])

for sp in ax_mat_display.spines.values():
    sp.set_edgecolor('#00CED1')
for sp in ax_strike_display.spines.values():
    sp.set_edgecolor('#f4a261')

mat_text = ax_mat_display.text(
    0.5, 0.5, '', transform=ax_mat_display.transAxes,
    ha='center', va='center', fontsize=8, color='white')
strike_text = ax_strike_display.text(
    0.5, 0.5, '', transform=ax_strike_display.transAxes,
    ha='center', va='center', fontsize=8, color='white')

slider_elev = MSlider(ax_elev, 'Elevation',  0,   90,
                      valinit=30,  color='#00CED1',
                      handle_style={'facecolor': 'white'})
slider_azim = MSlider(ax_azim, 'Rotation', -180, 180,
                      valinit=-60, color='#00CED1',
                      handle_style={'facecolor': 'white'})
for sl in [slider_elev, slider_azim]:
    sl.label.set_color('white')
    sl.valtext.set_color('white')

ticker_box = TextBox(ax_ticker, 'Ticker: ', initial='^SPX',
                     color='#2a2a2a', hovercolor='#3a3a3a')
ticker_box.label.set_color('white')
ticker_box.text_disp.set_color('#00CED1')

btn_style   = {'color': '#2a2a2a', 'hovercolor': '#00CED1'}
btn_trade   = Button(ax_trade,   '⚡ Generate Trade Ticket', color='#1a3a1a', hovercolor='#2a5a2a')
btn_refresh = Button(ax_refresh, 'Refresh',      **btn_style)
btn_report  = Button(ax_report,  'Print Report', **btn_style)
btn_min_m   = Button(ax_btn_min_m,  '−  Mat.Min', **btn_style)
btn_min_p   = Button(ax_btn_min_p,  '+  Mat.Min', **btn_style)
btn_max_m   = Button(ax_btn_max_m,  '−  Mat.Max', **btn_style)
btn_max_p   = Button(ax_btn_max_p,  '+  Mat.Max', **btn_style)
btn_kmin_m  = Button(ax_btn_kmin_m, '−  K.Min',   **btn_style)
btn_kmin_p  = Button(ax_btn_kmin_p, '+  K.Min',   **btn_style)
btn_kmax_m  = Button(ax_btn_kmax_m, '−  K.Max',   **btn_style)
btn_kmax_p  = Button(ax_btn_kmax_p, '+  K.Max',   **btn_style)

btn_trade.label.set_color('#00FF88')
btn_trade.label.set_fontweight('bold')

for btn in [btn_refresh, btn_report,
            btn_min_m, btn_min_p, btn_max_m, btn_max_p,
            btn_kmin_m, btn_kmin_p, btn_kmax_m, btn_kmax_p]:
    btn.label.set_color('white')
    btn.label.set_fontsize(9)

# ============================================================
# DISPLAY UPDATERS
# ============================================================
def update_mat_display():
    imin = mat_state['imin']
    imax = mat_state['imax']
    mat_text.set_text(
        f'Mat.Min: slice {imin} ({round(maturities_real[imin]*365)}d)\n'
        f'Mat.Max: slice {imax} ({round(maturities_real[imax]*365)}d)'
    )
    fig2.canvas.draw_idle()

def update_strike_display():
    kmin = K_common[mat_state['kmin_idx']]
    kmax = K_common[mat_state['kmax_idx']]
    strike_text.set_text(f'K.Min: {kmin:.2f}\nK.Max: {kmax:.2f}')
    fig2.canvas.draw_idle()

# ============================================================
# DRAW 2D SLICE
# ============================================================
def draw_2d_slice(idx):
    T_slice   = maturities_real[idx]
    d_slice   = Z_real[idx]
    fwd_impl  = fwd_list[idx]
    fwd       = fwd_impl if fwd_impl else spot * np.exp(0.05 * T_slice)
    reliable  = reliable_list[idx]
    n_pairs   = n_pairs_list[idx]

    mean, std, skewness, p5, p95 = compute_stats(K_common, d_slice)
    dK           = K_common[1] - K_common[0]
    mass         = np.sum(d_slice) * dK
    moment_check = np.sum(K_common * d_slice) * dK
    fwd_err      = abs(moment_check - fwd)

    kmin   = K_common[mat_state['kmin_idx']]
    kmax   = K_common[mat_state['kmax_idx']]
    k_mask = (K_common >= kmin) & (K_common <= kmax)
    K_view = K_common[k_mask]
    d_view = d_slice[k_mask]

    ax2d.clear()
    ax2d.set_facecolor('#0d0d0d')

    plot_color = '#00CED1' if reliable else '#888888'
    ax2d.plot(K_view, d_view, color=plot_color, linewidth=2)
    ax2d.fill_between(K_view, d_view,
                       where=(K_view <= p5),
                       color='#e94560', alpha=0.4, label='5th pct tail')
    ax2d.fill_between(K_view, d_view,
                       where=(K_view >= p95),
                       color='#f4a261', alpha=0.4, label='95th pct tail')
    ax2d.fill_between(K_view, d_view,
                       where=((K_view > p5) & (K_view < p95)),
                       color=plot_color, alpha=0.15, label='5th–95th range')
    ax2d.axvline(spot, color='yellow', linestyle='--',
                 linewidth=1.2, label=f'Spot ({spot:.2f})')
    ax2d.axvline(fwd,  color='lime',   linestyle=':',
                 linewidth=1.2, label=f'Impl.Fwd ({fwd:.2f})')

    mkt_str  = 'LIVE' if mkt_open else 'OFF-HOURS'
    rel_str  = '' if reliable else '  [QUOTE QUALITY WARN]'
    ax2d.set_title(
        f'{current_ticker} [{mkt_str}] Risk-Neutral Density  —  '
        f'T = {T_slice:.3f}y  ({round(T_slice*365)} days){rel_str}',
        fontsize=11, color='white' if reliable else '#f4a261')
    ax2d.set_xlabel('Strike', color='white')
    ax2d.set_ylabel('Probability Density', color='white')
    ax2d.tick_params(colors='white')
    ax2d.grid(True, color='#333333', linestyle='--', alpha=0.5)
    for sp in ax2d.spines.values():
        sp.set_color('#444444')
    ax2d.legend(loc='upper right', facecolor='#1a1a1a',
                edgecolor='#444444', labelcolor='white', fontsize=8)

    mass_ok  = 0.85 < mass < 1.15
    fwd_ok   = fwd_err < (spot * 0.01)
    diag_col = 'lightgreen' if (mass_ok and fwd_ok and reliable) else '#e94560'

    ax2d.text(0.02, 0.97,
              f'Mean:      {mean:.2f}\n'
              f'Std Dev:  {std:.2f}\n'
              f'Skew:      {skewness:.3f}\n'
              f'5th pct:   {p5:.2f}\n'
              f'95th pct: {p95:.2f}',
              transform=ax2d.transAxes, fontsize=9, color='white',
              verticalalignment='top',
              bbox=dict(boxstyle='round', facecolor='#1a1a1a',
                        edgecolor='#00CED1', alpha=0.8))

    ax2d.text(0.02, 0.62,
              f'── Diagnostics ──\n'
              f'Mass:      {mass:.3f}  {"✓" if mass_ok else "✗"}\n'
              f'E[S_T]:    {moment_check:.2f}\n'
              f'Impl.Fwd: {fwd:.2f}  (n={n_pairs})\n'
              f'Fwd Err:  {fwd_err:.2f}  {"✓" if fwd_ok else "✗"}\n'
              f'Quotes:   {"LIVE ✓" if reliable else "OFFHOURS ✗"}',
              transform=ax2d.transAxes, fontsize=9, color='white',
              verticalalignment='top',
              bbox=dict(boxstyle='round', facecolor='#1a1a1a',
                        edgecolor=diag_col, alpha=0.8))

    fig2.canvas.draw_idle()

# ============================================================
# UPDATE 3D SURFACE
# ============================================================
def update_3d():
    imin = mat_state['imin']
    imax = mat_state['imax']
    tmin = maturities_real[imin]
    tmax = maturities_real[imax]

    mask       = (maturities_real >= tmin) & (maturities_real <= tmax)
    T_filtered = maturities_real[mask]
    Z_filtered = Z_real[mask]

    if len(T_filtered) < 2:
        return

    kmin_idx = mat_state['kmin_idx']
    kmax_idx = mat_state['kmax_idx']
    K_view   = K_common[kmin_idx:kmax_idx + 1]
    Z_view   = Z_filtered[:, kmin_idx:kmax_idx + 1]

    K_grid_f, T_grid_f = np.meshgrid(K_view, T_filtered)
    ax3d.clear()
    ax3d.plot_surface(K_grid_f, T_grid_f, Z_view,
                      cmap='plasma', edgecolor='none', alpha=0.95)
    style_3d(ax3d, tmin, tmax)
    ax3d.view_init(elev=slider_elev.val, azim=slider_azim.val)
    fig1.canvas.draw_idle()

# ============================================================
# PRINT REPORT
# ============================================================
def print_report(event):
    idx      = mat_state['imin']
    T_slice  = maturities_real[idx]
    d_slice  = Z_real[idx]
    fwd_impl = fwd_list[idx]
    fwd      = fwd_impl if fwd_impl else spot * np.exp(0.05 * T_slice)
    reliable = reliable_list[idx]
    n_pairs  = n_pairs_list[idx]
    fwd_iqr  = fwd_iqr_list[idx]

    mean, std, skewness, p5, p95 = compute_stats(K_common, d_slice)
    dK           = K_common[1] - K_common[0]
    mass         = np.sum(d_slice) * dK
    moment_check = np.sum(K_common * d_slice) * dK
    fwd_err      = abs(moment_check - fwd)

    kmin = K_common[mat_state['kmin_idx']]
    kmax = K_common[mat_state['kmax_idx']]
    tmin = maturities_real[mat_state['imin']]
    tmax = maturities_real[mat_state['imax']]

    k_mask = (K_common >= kmin) & (K_common <= kmax)
    K_view = K_common[k_mask]
    d_view = d_slice[k_mask]

    mat_mask     = (maturities_real >= tmin) & (maturities_real <= tmax)
    visible_idx  = [i for i, t in enumerate(maturities_real) if tmin <= t <= tmax]
    visible_mats = maturities_real[mat_mask]
    visible_Z    = Z_real[mat_mask]
    visible_fwds    = [fwd_list[i]      for i in visible_idx]
    visible_iqrs    = [fwd_iqr_list[i]  for i in visible_idx]
    visible_npairs  = [n_pairs_list[i]  for i in visible_idx]
    visible_reliable= [reliable_list[i] for i in visible_idx]

    option_style = ('European (index — cash settled)'
                    if not is_american else
                    'American (ETF/equity — put IV haircut T>2wk)')

    def bs_iv_from_price(S, K, T, r, price, is_call=True):
        lo, hi = 0.001, 5.0
        for _ in range(60):
            mid = (lo + hi) / 2
            d1  = (np.log(S / K) + (r + 0.5 * mid**2) * T) / (mid * np.sqrt(T))
            d2  = d1 - mid * np.sqrt(T)
            px  = (S * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2) if is_call
                   else K * np.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1))
            if px > price:
                hi = mid
            else:
                lo = mid
        return (lo + hi) / 2

    def slice_greeks(T, d, fwd_use, rel):
        if T < 1/365 or np.sum(d) * dK < 0.3:
            return None
        atm_idx  = np.argmin(np.abs(K_common - fwd_use))
        atm_K    = K_common[atm_idx]
        atm_call = np.exp(-0.05 * T) * np.sum(
            np.maximum(K_common - atm_K, 0) * d) * dK
        if atm_call < 1e-6:
            return None
        try:
            atm_iv = bs_iv_from_price(spot, atm_K, T, 0.05, atm_call, True)
        except:
            return None
        if atm_iv < 0.01 or atm_iv > 3.0:
            return None

        best_call_K, best_put_K = None, None
        best_cd, best_pd        = 999, 999

        for K_scan in K_common:
            with np.errstate(divide='ignore', invalid='ignore'):
                d1 = (np.log(fwd_use / K_scan) + 0.5 * atm_iv**2 * T) / (atm_iv * np.sqrt(T))
            cd = norm.cdf(d1)
            pd = cd - 1
            if abs(cd - 0.25) < best_cd:
                best_cd, best_call_K = abs(cd - 0.25), K_scan
            if abs(pd - (-0.25)) < best_pd:
                best_pd, best_put_K = abs(pd - (-0.25)), K_scan

        if best_call_K is None or best_put_K is None:
            return None
        if best_call_K <= fwd_use or best_put_K >= fwd_use:
            return None

        call_25 = np.exp(-0.05*T) * np.sum(
            np.maximum(K_common - best_call_K, 0) * d) * dK
        put_25  = np.exp(-0.05*T) * np.sum(
            np.maximum(best_put_K - K_common, 0) * d) * dK
        if call_25 < 1e-6 or put_25 < 1e-6:
            return None
        try:
            iv_c = bs_iv_from_price(spot, best_call_K, T, 0.05, call_25, True)
            iv_p = bs_iv_from_price(spot, best_put_K,  T, 0.05, put_25,  False)
        except:
            return None
        if iv_c < 0.01 or iv_p < 0.01 or iv_c > 3.0 or iv_p > 3.0:
            return None

        return {
            'atm_iv':      round(atm_iv * 100, 2),
            'atm_K':       round(atm_K, 2),
            'K_25d_call':  round(best_call_K, 2),
            'K_25d_put':   round(best_put_K, 2),
            'iv_25d_call': round(iv_c * 100, 2),
            'iv_25d_put':  round(iv_p * 100, 2),
            'rr_25d':      round((iv_c - iv_p) * 100, 2),
            'bf_25d':      round(((iv_c + iv_p) / 2 - atm_iv) * 100, 2),
            'reliable':    rel,
        }

    term_rows = []
    for idx_t, (T, d, fi, fiqr, np_, rel) in enumerate(zip(
            visible_mats, visible_Z, visible_fwds,
            visible_iqrs, visible_npairs, visible_reliable)):
        m, s, sk, p5t, p95t = compute_stats(K_common, d)
        mass_  = np.sum(d) * dK
        fwd_   = fi if fi else spot * np.exp(0.05 * T)
        mom_   = np.sum(K_common * d) * dK
        ferr_  = abs(mom_ - fwd_)
        green  = mass_ >= 0.85 and ferr_ < spot * 0.01 and rel
        gk     = slice_greeks(T, d, fwd_, rel)
        atm_iv_est = float(np.clip(gk['atm_iv'] / 100 if gk else 0.20, 0.05, 1.5))
        lb, ub = get_strike_bounds(spot, T, atm_iv=atm_iv_est, n_sigma=5.0)

        # Tail risk metrics
        tail_m = compute_tail_metrics(K_common, d, spot)
        left_mass_1pct = tail_m.get('left_mass_1pct')

        # Liquidity metrics for this slice
        liq_idx = visible_idx[idx_t] if idx_t < len(visible_idx) else 0
        liq_m = liq_list[liq_idx] if liq_idx < len(liq_list) else {}
        pct_retained   = liq_m.get('pct_strikes_retained')
        avg_rel_spread = liq_m.get('avg_rel_spread')

        # Confidence score
        conf = compute_confidence_score(
            mass_, ferr_, spot, fiqr, pct_retained, avg_rel_spread, rel)

        # Change signals vs prior snapshot
        atm_iv_val = gk['atm_iv'] if gk else None
        rr_val     = gk['rr_25d'] if gk else None
        deltas     = get_deltas(current_ticker, round(T * 365),
                                atm_iv_val, rr_val, round(sk, 3), left_mass_1pct)

        exp_date_dt = datetime.today() + timedelta(days=round(T * 365))
        exp_date_str = exp_date_dt.strftime('%d-%b-%Y')

        term_rows.append({
            'T_years':        round(T, 4),
            'T_days':         round(T * 365),
            'exp_date':       exp_date_str,
            'mean':           round(m, 2),
            'std':            round(s, 2),
            'skew':           round(sk, 3),
            'p5':             round(p5t, 2),
            'p95':            round(p95t, 2),
            'mass':           round(mass_, 3),
            'width_5_95':     round(p95t - p5t, 2),
            'fwd_impl':       round(fwd_, 2),
            'fwd_iqr':        round(fiqr, 3) if fiqr else 'N/A',
            'n_pairs':        np_,
            'fwd_err':        round(ferr_, 2),
            'k_lower':        round(lb, 2),
            'k_upper':        round(ub, 2),
            'reliable':       rel,
            'green':          green,
            'greeks':         gk,
            'tail_metrics':   tail_m,
            'left_mass_1pct': left_mass_1pct,
            'liq':            liq_m,
            'conf_score':     conf,
            'deltas':         deltas,
        })

    # Save snapshot for next refresh
    save_snapshot(current_ticker, term_rows, [r.get('greeks') for r in term_rows])

    stride   = max(1, len(K_view) // 40)
    K_sample = K_view[::stride]
    d_sample = d_view[::stride]
    cdf_full = np.cumsum(d_slice) * dK
    sep      = '=' * 70
    mkt_str  = 'LIVE MARKET' if mkt_open else 'OFF-HOURS — REDUCED RELIABILITY'

    T_slice_date = (datetime.today() + timedelta(days=round(T_slice * 365))).strftime('%d-%b-%Y')

    report = f"""
{sep}
RISK-NEUTRAL DENSITY REPORT  —  FULL TRADING PACKET  v3.0
Market Status: {mkt_str}
{sep}
Ticker:           {current_ticker}
Option Style:     {option_style}
Spot Price:       {spot:.2f}
Risk-Free Rate:   5.00%  (assumed constant — consider OIS for long tenors)
Forward Method:   Put-call parity, near-ATM pairs only (±5% of spot)
                  Fallback: spot * e^{{rT}} if <2 pairs available
Wing Method:      Spline OTM IV + lognormal tail blend (non-negativity enforced)
                  Bounds: ±5 sigma log-space, hard limits 50-200% spot
Arb Constraints: Call price monotonicity + convexity enforced; density clipped ≥ 0
American Adj:     {'Put IV haircut r*T*0.5 for T>2wk' if is_american else 'N/A'}
Delta Convention: Forward-based (standard vol surface convention)
Quote Filter:     bid>0, ask>0, ask/bid<=2.0, intrinsic bound check
                  If >30% strikes fail or market closed → OFFHOURS flag
Conf.Threshold:   Slices with score < 40 should NOT drive trade decisions
Report Time:      {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

--- REALIZED VOLATILITY (historical, P-measure) ---
5-day Realized Vol:   {f"{rv_dict.get(5)*100:.2f}%" if rv_dict.get(5) else "N/A"}
10-day Realized Vol:  {f"{rv_dict.get(10)*100:.2f}%" if rv_dict.get(10) else "N/A"}
Intraday Range (last): {f"{intraday_range:.2f}%" if intraday_range else "N/A"}
NOTE: Compare ATM IV (Q-measure) vs realized vol to assess vol risk premium.
      IV >> RV → vol-selling opportunity; IV << RV → vol-buying / hedging.
{'⚠️  WARNING: Market closed. RR/skew/BF metrics unreliable. Do not trade off this packet.' if not mkt_open else '✓  Market open. Quote quality filters active.'}

--- CURRENT SLICE (2D View) ---
Maturity:         {T_slice:.4f} years  ({round(T_slice*365)} days)  →  Expiry: {T_slice_date}
Implied Forward:  {fwd:.2f}  (n_pairs={n_pairs}, IQR={f"{fwd_iqr:.3f}" if fwd_iqr else "N/A"})
Strike Range:     {kmin:.2f} — {kmax:.2f}  (zoomed view)
Full K Range:     {K_common[0]:.2f} — {K_common[-1]:.2f}
Quote Quality:    {'LIVE ✓' if reliable else 'OFFHOURS — treat as indicative only'}

Distribution Statistics:
  Mean:             {mean:.2f}
  Std Dev:          {std:.2f}
  Skewness:         {skewness:.4f}
  5th Pct:          {p5:.2f}  ({((p5/spot)-1)*100:.2f}% from spot)
  95th Pct:         {p95:.2f}  ({((p95/spot)-1)*100:.2f}% from spot)
  5-95 Width:       {p95-p5:.2f}
  Mass (∫f dK):     {mass:.4f}  {'[PASS]' if 0.85 < mass < 1.15 else '[WARN]'}
  E[S_T]:           {moment_check:.2f}
  Forward Err:      {fwd_err:.2f}  {'[PASS]' if fwd_err < spot*0.01 else '[WARN]'}

Downside tail:    {((p5/spot)-1)*100:.2f}%
Upside tail:      {((p95/spot)-1)*100:.2f}%
Tail asymmetry:   {abs(((p5/spot)-1)) / max(abs(((p95/spot)-1)), 0.0001):.2f}x

--- DENSITY SAMPLE TABLE (zoomed view ~40 pts) ---
{'Strike':>10}  {'Density':>12}  {'CDF':>8}
{'-'*35}"""

    for k, d in zip(K_sample, d_sample):
        k_idx = np.searchsorted(K_common, k)
        cdf_v = cdf_full[min(k_idx, len(cdf_full)-1)]
        report += f"\n{k:>10.2f}  {d:>12.6f}  {cdf_v:>8.4f}"

    report += f"""

--- TERM STRUCTURE (window: {round(tmin*365)}d – {round(tmax*365)}d) ---
[GREEN]   = mass>=0.85, fwdErr<1% spot, AND quote_reliable=True
[WARN]    = fails mass or fwdErr
[OFFHOURS]= quote quality flag set (market closed or >30% strikes failed filter)
Conf      = Confidence score 0-100 (skip trading if <40)

{'Expiry':>11}  {'T(yr)':>6}  {'ImplFwd':>8}  {'FwdIQR':>7}  {'nPair':>5}  {'Mean':>8}  {'Std':>7}  {'Skew':>7}  {'p5':>8}  {'p95':>8}  {'Mass':>6}  {'FwdErr':>7}  {'Conf':>5}  {'Status':>10}
{'-'*140}"""

    for row in term_rows:
        if row['green']:
            status = '[GREEN]   '
        elif not row['reliable']:
            status = '[OFFHOURS]'
        else:
            status = '[WARN]    '
        iqr_str = f"{row['fwd_iqr']:.3f}" if row['fwd_iqr'] != 'N/A' else ' N/A'
        report += (
            f"\n{row['exp_date']:>11}  "
            f"{row['T_years']:>6.3f}  "
            f"{row['fwd_impl']:>8.2f}  "
            f"{iqr_str:>7}  "
            f"{row['n_pairs']:>5}  "
            f"{row['mean']:>8.2f}  "
            f"{row['std']:>7.2f}  "
            f"{row['skew']:>7.3f}  "
            f"{row['p5']:>8.2f}  "
            f"{row['p95']:>8.2f}  "
            f"{row['mass']:>6.3f}  "
            f"{row['fwd_err']:>7.2f}  "
            f"{row['conf_score']:>5.1f}  "
            f"{status:>10}"
        )

    report += f"""

--- VOL SURFACE (ATM IV, 25-Delta RR & BF) + CHANGE SIGNALS ---
RR = IV(25C) - IV(25P)  [negative = put skew, normal equities]
BF = (IV(25C)+IV(25P))/2 - ATM  [positive = fat wings]
∆ columns = change vs prior snapshot (refresh again to populate)
25d delta: forward-based convention
NOTE: OFFHOURS rows marked — RR/BF unreliable when market closed

{'Expiry':>11}  {'ATM_K':>8}  {'ATM_IV%':>8}  {'∆ATM_IV':>8}  {'K_25C':>8}  {'K_25P':>8}  {'IV_25C':>7}  {'IV_25P':>7}  {'RR':>7}  {'∆RR':>7}  {'BF':>7}  {'∆Skew':>7}  {'Status':>10}
{'-'*125}"""

    for row in term_rows:
        gk = row['greeks']
        dl = row.get('deltas') or {}
        if row['green']:
            status = '[GREEN]   '
        elif not row['reliable']:
            status = '[OFFHOURS]'
        else:
            status = '[WARN]    '
        datm = f"{dl.get('datm_iv'):+.2f}" if dl.get('datm_iv') is not None else '  N/A'
        drr  = f"{dl.get('drr'):+.2f}"     if dl.get('drr')     is not None else '  N/A'
        dsk  = f"{dl.get('dskew'):+.3f}"   if dl.get('dskew')   is not None else '  N/A'
        if gk:
            report += (
                f"\n{row['exp_date']:>11}  "
                f"{gk['atm_K']:>8.2f}  "
                f"{gk['atm_iv']:>8.2f}  "
                f"{datm:>8}  "
                f"{gk['K_25d_call']:>8.2f}  "
                f"{gk['K_25d_put']:>8.2f}  "
                f"{gk['iv_25d_call']:>7.2f}  "
                f"{gk['iv_25d_put']:>7.2f}  "
                f"{gk['rr_25d']:>7.2f}  "
                f"{drr:>7}  "
                f"{gk['bf_25d']:>7.2f}  "
                f"{dsk:>7}  "
                f"{status:>10}"
            )
        else:
            report += (
                f"\n{row['exp_date']:>11}  "
                f"{'N/A — failed sanity check':>68}  "
                f"{status:>10}"
            )

    report += f"""

--- TAIL RISK METRICS (risk-neutral Q-measure) ---
P[ret<-X%] = probability mass below spot*(1-X%). ES = expected loss conditional on tail breach.
NOTE: These are Q-measure probabilities — may overstate tail risk due to vol risk premium.

{'Expiry':>11}  {'P[<-1%]':>8}  {'P[<-2%]':>8}  {'P[<-3%]':>8}  {'ES@1%':>8}  {'ES@5%':>8}  {'∆LeftMass':>10}  {'Conf':>5}  {'Status':>10}
{'-'*95}"""

    for row in term_rows:
        tm = row.get('tail_metrics', {})
        dl = row.get('deltas') or {}
        if row['green']:
            status = '[GREEN]   '
        elif not row['reliable']:
            status = '[OFFHOURS]'
        else:
            status = '[WARN]    '
        p1  = f"{tm.get('p_down_1pct','N/A'):>8}" if tm.get('p_down_1pct') is not None else '     N/A'
        p2  = f"{tm.get('p_down_2pct','N/A'):>8}" if tm.get('p_down_2pct') is not None else '     N/A'
        p3  = f"{tm.get('p_down_3pct','N/A'):>8}" if tm.get('p_down_3pct') is not None else '     N/A'
        es1 = f"{tm.get('es_1pct_ret','N/A'):>8}" if tm.get('es_1pct_ret') is not None else '     N/A'
        es5 = f"{tm.get('es_5pct_ret','N/A'):>8}" if tm.get('es_5pct_ret') is not None else '     N/A'
        dlm = f"{dl.get('dleft_mass'):+.3f}" if dl.get('dleft_mass') is not None else '       N/A'
        report += (
            f"\n{row['exp_date']:>11}  {p1}  {p2}  {p3}  {es1}  {es5}  {dlm:>10}  "
            f"{row['conf_score']:>5.1f}  {status:>10}"
        )

    report += f"""

--- LIQUIDITY METRICS ---
avg_ba  = average bid-ask spread ($)  |  rel_spread = avg(ask-bid)/mid  |  retained = % strikes passing filter

{'Expiry':>11}  {'AvgBA($)':>9}  {'RelSpread':>10}  {'%Retained':>10}  {'TotalOI':>8}  {'TotalVol':>9}  {'Conf':>5}  {'Status':>10}
{'-'*90}"""

    for row in term_rows:
        lq = row.get('liq', {})
        if row['green']:
            status = '[GREEN]   '
        elif not row['reliable']:
            status = '[OFFHOURS]'
        else:
            status = '[WARN]    '
        ba   = f"{lq.get('avg_bid_ask_width',0):.3f}" if lq.get('avg_bid_ask_width') is not None else 'N/A'
        rs   = f"{lq.get('avg_rel_spread',0):.3f}"    if lq.get('avg_rel_spread')    is not None else 'N/A'
        ret  = f"{lq.get('pct_strikes_retained',0)*100:.1f}%" if lq.get('pct_strikes_retained') is not None else 'N/A'
        oi   = f"{lq.get('total_oi','N/A')}"
        vol  = f"{lq.get('total_vol','N/A')}"
        report += (
            f"\n{row['exp_date']:>11}  {ba:>9}  {rs:>10}  {ret:>10}  {oi:>8}  {vol:>9}  "
            f"{row['conf_score']:>5.1f}  {status:>10}"
        )

    report += f"""

--- NOTES FOR QUANT AGENT ---
- All stats are risk-neutral (Q-measure), not real-world probabilities
- [GREEN] slices only should anchor live strike selection; prefer Conf >= 60
- [OFFHOURS] slices: density shape may be ok, but RR/BF/skew unreliable
- Forward IQR: dispersion of parity-implied forwards across paired strikes
  Low IQR (<0.5) = consistent forward estimate. High IQR = noisy chain.
- Negative RR = put skew dominant (normal for equities/ETFs)
- Positive RR after-hours is likely a stale quote artifact, not real call skew
- BF > 0 = fat tails vs ATM
- Wing model: lognormal tail blend preserves non-negativity; density >= 0 enforced
- Arb constraints: call prices monotone and convex before differentiation
- American put haircut is first-order only — not full BAW/binomial
- Change signals (∆): require two consecutive refreshes to populate
- Realized vol vs ATM IV: if RV5d << ATMIV → elevated vol risk premium → consider selling vol
- Conf score < 40 → auto-disable; 40-60 → use with caution; >60 → tradeable
{sep}
END OF REPORT — FULL TRADING PACKET v3.0
{sep}
"""

    print(report)
    filename = (f"{current_ticker.replace('^', '')}_"
                f"{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.txt")
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(report)
    print(f">>> Saved to: {filename}")
    print(">>> trade instructions <<<")

btn_report.on_clicked(print_report)

# ============================================================
# TRADE TICKET ENGINE
# ============================================================
ACCOUNT_SIZE_USD    = 50_000
RISK_PER_TRADE_PCT  = 0.10          # 10% of account per trade
SPX_WIDTH_PTS       = 50
SPX_ROUND           = 5
MIN_CONF            = 60
MIN_DAYS            = 5
MAX_DAYS_PREFERRED  = 12
MAX_DAYS_FALLBACK   = 20
VRP_BUFFER          = 1.0           # ATM_IV must exceed max(RV5,RV10) by this %
MASS_MIN            = 0.90
MASS_MAX            = 1.10
MAX_REL_SPREAD_PCT  = 8.0
MIN_RETAINED_PCT    = 70.0


def _snap_to_spx_expiry(target_date):
    """Snap target_date forward to nearest SPX expiry (Mon/Wed/Fri)."""
    allowed = {0, 2, 4}   # Mon=0, Wed=2, Fri=4
    d = target_date
    for _ in range(7):
        if d.weekday() in allowed:
            return d
        d += timedelta(days=1)
    return d


def _round_strike(k, increment=5, direction='nearest'):
    if direction == 'nearest':
        return int(round(k / increment) * increment)
    elif direction == 'down':
        return int((k // increment) * increment)
    return int(round(k / increment) * increment)


def _build_term_rows_for_ticket():
    """
    Re-compute term rows across ALL slices (not just window view),
    identical logic to print_report but for the full surface.
    Returns list of dicts with all fields needed for trade logic.
    """
    dK = K_common[1] - K_common[0]

    def bs_call(S, K, T, r, sigma):
        with np.errstate(divide='ignore', invalid='ignore'):
            d1 = (np.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))
            d2 = d1 - sigma * np.sqrt(T)
        return S * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2)

    def bs_iv_bisect(S, K, T, r, price, is_call=True):
        lo, hi = 0.001, 5.0
        for _ in range(60):
            mid = (lo + hi) / 2
            d1  = (np.log(S / K) + (r + 0.5 * mid**2) * T) / (mid * np.sqrt(T))
            d2  = d1 - mid * np.sqrt(T)
            px  = (S * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2) if is_call
                   else K * np.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1))
            if px > price:
                hi = mid
            else:
                lo = mid
        return (lo + hi) / 2

    rows = []
    for i, (T, d, fi, fiqr, np_, rel, liq) in enumerate(zip(
            maturities_real, Z_real, fwd_list,
            fwd_iqr_list, n_pairs_list, reliable_list, liq_list)):

        T_days = round(T * 365)
        fwd_   = fi if fi else spot * np.exp(0.05 * T)
        mass_  = float(np.sum(d) * dK)
        mom_   = float(np.sum(K_common * d) * dK)
        ferr_  = abs(mom_ - fwd_)
        green  = mass_ >= 0.85 and ferr_ < spot * 0.01 and rel

        m, s, sk, p5t, p95t = compute_stats(K_common, d)
        tail_m = compute_tail_metrics(K_common, d, spot)

        # --- greeks (ATM IV + 25d strikes) ---
        atm_iv_pct  = None
        rr_25d      = None
        K_25d_put   = None
        K_25d_call  = None

        if T > 1/365 and mass_ > 0.3:
            atm_idx  = np.argmin(np.abs(K_common - fwd_))
            atm_K    = K_common[atm_idx]
            atm_call = np.exp(-0.05 * T) * float(np.sum(
                np.maximum(K_common - atm_K, 0) * d) * dK)
            if atm_call > 1e-6:
                try:
                    atm_iv = bs_iv_bisect(spot, atm_K, T, 0.05, atm_call, True)
                    if 0.01 < atm_iv < 3.0:
                        atm_iv_pct = round(atm_iv * 100, 2)

                        # scan for 25d strikes
                        best_call_K, best_put_K = None, None
                        best_cd, best_pd        = 999, 999
                        for K_scan in K_common:
                            with np.errstate(divide='ignore', invalid='ignore'):
                                d1  = (np.log(fwd_ / K_scan) + 0.5 * atm_iv**2 * T) / (atm_iv * np.sqrt(T))
                            cd  = float(norm.cdf(d1))
                            pd  = cd - 1
                            if abs(cd - 0.25) < best_cd and K_scan > fwd_:
                                best_cd, best_call_K = abs(cd - 0.25), K_scan
                            if abs(pd - (-0.25)) < best_pd and K_scan < fwd_:
                                best_pd, best_put_K = abs(pd - (-0.25)), K_scan

                        if best_call_K and best_put_K:
                            call_25 = np.exp(-0.05*T) * float(np.sum(
                                np.maximum(K_common - best_call_K, 0) * d) * dK)
                            put_25  = np.exp(-0.05*T) * float(np.sum(
                                np.maximum(best_put_K - K_common, 0) * d) * dK)
                            if call_25 > 1e-6 and put_25 > 1e-6:
                                try:
                                    iv_c = bs_iv_bisect(spot, best_call_K, T, 0.05, call_25, True)
                                    iv_p = bs_iv_bisect(spot, best_put_K,  T, 0.05, put_25,  False)
                                    if 0.01 < iv_c < 3.0 and 0.01 < iv_p < 3.0:
                                        rr_25d     = round((iv_c - iv_p) * 100, 2)
                                        K_25d_call = round(best_call_K, 2)
                                        K_25d_put  = round(best_put_K,  2)
                                except:
                                    pass
                except:
                    pass

        pct_retained   = liq.get('pct_strikes_retained', 0)
        avg_rel_spread = liq.get('avg_rel_spread', None)
        conf = compute_confidence_score(
            mass_, ferr_, spot, fiqr,
            pct_retained, avg_rel_spread, rel)

        exp_date = _snap_to_spx_expiry(
            datetime.today() + timedelta(days=T_days))

        rows.append({
            'i':            i,
            'T_years':      round(T, 4),
            'T_days':       T_days,
            'exp_date':     exp_date,
            'green':        green,
            'reliable':     rel,
            'conf':         conf,
            'mass':         round(mass_, 4),
            'fwd':          round(fwd_, 2),
            'fwd_err':      round(ferr_, 2),
            'atm_iv_pct':   atm_iv_pct,
            'rr_25d':       rr_25d,
            'K_25d_put':    K_25d_put,
            'K_25d_call':   K_25d_call,
            'p5':           round(p5t, 2),
            'p95':          round(p95t, 2),
            'std':          round(s,   2),
            'skew':         round(sk,  3),
            'tail':         tail_m,
            'pct_retained': (pct_retained * 100) if pct_retained else None,
            'rel_spread':   (avg_rel_spread * 100) if avg_rel_spread else None,
        })
    return rows


def _score_trade_quality(row, strategy, short_strike, rv5, rv10):
    """
    Score 0-100 based on JSON criteria.
    Components:
      Confidence score      25 pts
      VRP strength          20 pts  (ATM_IV - max(RV5,RV10))
      Tail probability      20 pts  (lower p_down_2pct = better for puts)
      Buffer to short strike15 pts
      Liquidity             10 pts
      Mass quality          10 pts
    """
    score = 0.0
    breakdown = []

    # 1. Confidence (25 pts)
    conf = row['conf']
    if conf >= 85:
        c = 25
    elif conf >= 70:
        c = 18
    elif conf >= 60:
        c = 10
    else:
        c = 0
    score += c
    breakdown.append(('Confidence', c))

    # 2. VRP strength (20 pts)
    atm_iv = row['atm_iv_pct'] or 0
    rv_max = max(rv5 or 0, rv10 or 0)
    vrp    = atm_iv - rv_max
    if vrp >= 5:
        v = 20
    elif vrp >= 3:
        v = 14
    elif vrp >= 1:
        v = 7
    else:
        v = 0
    score += v
    breakdown.append(('VRP_strength', v))

    # 3. Tail probability (20 pts) — for puts: p_down_2pct; for calls: p_up_2pct proxy
    tail = row['tail']
    if strategy == 'PUT_CREDIT_SPREAD':
        p2 = tail.get('p_down_2pct', 100) if tail else 100
        if p2 <= 5:
            t = 20
        elif p2 <= 10:
            t = 15
        elif p2 <= 18:
            t = 8
        else:
            t = 0
    else:  # CALL_CREDIT_SPREAD — use 1 - CDF above call strike proxy via p95
        # RR is positive meaning call skew → use p_down_1pct as inverse proxy
        p1 = tail.get('p_down_1pct', 100) if tail else 100
        if p1 <= 10:
            t = 20
        elif p1 <= 20:
            t = 12
        else:
            t = 5
    score += t
    breakdown.append(('Tail_prob', t))

    # 4. Buffer to short strike (15 pts)
    buf_pct = abs(spot - short_strike) / spot * 100
    if buf_pct >= 3.0:
        b = 15
    elif buf_pct >= 2.0:
        b = 10
    elif buf_pct >= 1.3:
        b = 5
    else:
        b = 0
    score += b
    breakdown.append(('Buffer_pct', b))

    # 5. Liquidity (10 pts)
    rel_sp = row['rel_spread'] or 100
    ret    = row['pct_retained'] or 0
    if rel_sp <= 3 and ret >= 80:
        l = 10
    elif rel_sp <= 6 and ret >= 70:
        l = 6
    else:
        l = 2
    score += l
    breakdown.append(('Liquidity', l))

    # 6. Mass quality (10 pts)
    mass = row['mass']
    if 0.95 <= mass <= 1.05:
        mq = 10
    elif 0.90 <= mass <= 1.10:
        mq = 6
    else:
        mq = 0
    score += mq
    breakdown.append(('Mass_quality', mq))

    total = int(round(min(score, 100)))
    if total >= 80:
        label = 'HIGH_QUALITY'
    elif total >= 65:
        label = 'GOOD'
    elif total >= 50:
        label = 'MODERATE'
    else:
        label = 'LOW'
    return total, label, breakdown


def generate_trade_ticket(event):
    """
    Full one-click workflow:
      1. Refresh surface (primary)
      2. Refresh surface again (validation)
      3. Run trade logic on both snapshots
      4. Save ticket to file
    """
    print("\n" + "="*60)
    print("TRADE TICKET GENERATOR — Starting...")
    print("="*60)

    # ── Step 1: Primary refresh ──────────────────────────────
    print("\n[1/3] Primary surface refresh...")
    current_ticker_local = ticker_box.text.strip().upper()
    result1 = load_ticker(current_ticker_local)
    (spot1, mats1, Z1, Kc1,
     fwd1, fiqr1, np1, rel1,
     is_am1, mkt1, rv1, idr1, liq1_list) = result1
    ts1 = datetime.now()
    print(f"      Primary done at {ts1.strftime('%H:%M:%S')}  spot={spot1:.2f}")

    # ── Step 2: Validation refresh ───────────────────────────
    print("\n[2/3] Validation surface refresh...")
    result2 = load_ticker(current_ticker_local)
    (spot2, mats2, Z2, Kc2,
     fwd2, fiqr2, np2, rel2,
     is_am2, mkt2, rv2, idr2, liq2_list) = result2
    ts2 = datetime.now()
    print(f"      Validation done at {ts2.strftime('%H:%M:%S')}  spot={spot2:.2f}")

    # ── Update global state with latest data ─────────────────
    global spot, maturities_real, Z_real, K_common
    global fwd_list, fwd_iqr_list, n_pairs_list, reliable_list
    global is_american, mkt_open, rv_dict, intraday_range, liq_list
    global n_slices, K_step, current_ticker

    current_ticker  = current_ticker_local
    spot            = spot2
    maturities_real = mats2
    Z_real          = Z2
    K_common        = Kc2
    fwd_list        = fwd2
    fwd_iqr_list    = fiqr2
    n_pairs_list    = np2
    reliable_list   = rel2
    is_american     = is_am2
    mkt_open        = mkt2
    rv_dict         = rv2
    intraday_range  = idr2
    liq_list        = liq2_list
    n_slices        = len(maturities_real)
    K_step          = calc_k_step(K_common)
    mat_state['imin']     = 0
    mat_state['imax']     = n_slices - 1
    mat_state['kmin_idx'] = 0
    mat_state['kmax_idx'] = len(K_common) - 1

    # Redraw UI with latest data
    update_mat_display()
    update_strike_display()
    draw_2d_slice(1)
    K_grid_new, T_grid_new = np.meshgrid(K_common, maturities_real)
    ax3d.clear()
    ax3d.plot_surface(K_grid_new, T_grid_new, Z_real,
                      cmap='plasma', edgecolor='none', alpha=0.95)
    style_3d(ax3d)
    ax3d.view_init(elev=slider_elev.val, azim=slider_azim.val)
    fig1.canvas.draw_idle()

    # ── Step 3: Trade logic ───────────────────────────────────
    print("\n[3/3] Running trade logic...")

    # Compute term rows for BOTH snapshots (share K_common from pass 2)
    # For primary, temporarily swap globals so helper uses pass-1 data
    _save = (maturities_real, Z_real, K_common, fwd_list,
             fwd_iqr_list, n_pairs_list, reliable_list, liq_list)

    maturities_real = mats1
    Z_real = Z1
    K_common = Kc1
    fwd_list = fwd1
    fwd_iqr_list = fiqr1
    n_pairs_list = np1
    reliable_list = rel1
    liq_list = liq1_list
    rows1 = _build_term_rows_for_ticket()

    maturities_real, Z_real, K_common, fwd_list, \
        fwd_iqr_list, n_pairs_list, reliable_list, liq_list = _save

    rows2 = _build_term_rows_for_ticket()

    rv5_pct  = (rv1.get(5)  or rv2.get(5)  or 0) * 100
    rv10_pct = (rv1.get(10) or rv2.get(10) or 0) * 100

    # ── Stability check between primary and validation ────────
    def _stable(r1, r2):
        issues = []
        spot_chg = abs(spot1 - spot2) / max(spot1, 1) * 100
        if spot_chg > 0.25:
            issues.append(f"Spot moved {spot_chg:.2f}% between snapshots")
        if r1['atm_iv_pct'] and r2['atm_iv_pct']:
            if abs(r1['atm_iv_pct'] - r2['atm_iv_pct']) > 0.4:
                issues.append("ATM IV drift > 0.4%")
        if r1['mass'] and r2['mass']:
            if abs(r1['mass'] - r2['mass']) > 0.05:
                issues.append("Mass diff > 0.05")
        if r1['rr_25d'] is not None and r2['rr_25d'] is not None:
            if abs(r1['rr_25d'] - r2['rr_25d']) > 0.6:
                issues.append("RR25d drift > 0.6")
        return len(issues) == 0, issues

    # ── Eligibility filter ────────────────────────────────────
    NO_TRADE_REASON = None
    best_row1 = None
    best_row2 = None
    best_score = -1
    best_strategy = None
    best_short_k = None
    best_long_k  = None

    # Match slices by T_days between primary and validation
    r2_by_days = {r['T_days']: r for r in rows2}

    eligible = []
    for r1 in rows1:
        T_days = r1['T_days']
        r2 = r2_by_days.get(T_days)
        if r2 is None:
            continue

        # Day range filter
        if T_days < MIN_DAYS:
            continue
        if T_days > MAX_DAYS_FALLBACK:
            continue

        # Must be GREEN in BOTH snapshots
        if not r1['green'] or not r2['green']:
            continue

        # Confidence
        if r1['conf'] < MIN_CONF or r2['conf'] < MIN_CONF:
            continue

        # Mass bounds
        if not (MASS_MIN <= r1['mass'] <= MASS_MAX):
            continue
        if not (MASS_MIN <= r2['mass'] <= MASS_MAX):
            continue

        # Liquidity
        if r1['pct_retained'] is not None and r1['pct_retained'] < MIN_RETAINED_PCT:
            continue
        if r1['rel_spread'] is not None and r1['rel_spread'] > MAX_REL_SPREAD_PCT:
            continue

        # VRP filter — ATM IV must exceed max(RV5, RV10) + buffer
        atm_iv = r1['atm_iv_pct'] or 0
        if atm_iv < max(rv5_pct, rv10_pct) + VRP_BUFFER:
            continue

        # Stability check
        passed, issues = _stable(r1, r2)
        if not passed:
            continue

        # ── Determine strategy from RR sign ───────────────────
        rr = r1['rr_25d']
        if rr is not None and rr > 0:
            strategy = 'CALL_CREDIT_SPREAD'
        else:
            strategy = 'PUT_CREDIT_SPREAD'

        # ── Strike selection ──────────────────────────────────
        if strategy == 'PUT_CREDIT_SPREAD':
            # Anchor: K_25d_put → else spot*(1-2%) → else p5+0.5*std
            if r1['K_25d_put']:
                anchor = r1['K_25d_put']
            else:
                anchor = spot * 0.98
            short_k = _round_strike(anchor, SPX_ROUND)
            long_k  = short_k - SPX_WIDTH_PTS
            # Reduce width if conf < 75 or rel_spread > 6
            if r1['conf'] < 75 or (r1['rel_spread'] or 0) > 6:
                long_k = short_k - (SPX_WIDTH_PTS // 2)
            # Sanity: short must be below spot
            if short_k >= spot:
                short_k = _round_strike(spot * 0.98, SPX_ROUND, 'down')
                long_k  = short_k - SPX_WIDTH_PTS
        else:
            # CALL CS: anchor = K_25d_call → spot*(1+2%)
            if r1['K_25d_call']:
                anchor = r1['K_25d_call']
            else:
                anchor = spot * 1.02
            short_k = _round_strike(anchor, SPX_ROUND)
            long_k  = short_k + SPX_WIDTH_PTS
            if r1['conf'] < 75 or (r1['rel_spread'] or 0) > 6:
                long_k = short_k + (SPX_WIDTH_PTS // 2)
            if short_k <= spot:
                short_k = _round_strike(spot * 1.02, SPX_ROUND)
                long_k  = short_k + SPX_WIDTH_PTS

        buf_pct = abs(spot - short_k) / spot * 100
        if buf_pct < 1.0:
            continue   # buffer too small

        score, label, breakdown = _score_trade_quality(
            r1, strategy, short_k, rv5_pct, rv10_pct)

        eligible.append({
            'r1': r1, 'r2': r2,
            'strategy': strategy,
            'short_k': short_k, 'long_k': long_k,
            'score': score, 'label': label,
            'breakdown': breakdown,
        })

    # ── Select best eligible slice ────────────────────────────
    # Priority: score DESC, then conf DESC, then rel_spread ASC,
    # then prefer 5-12d range
    def _sort_key(e):
        in_preferred = 1 if MIN_DAYS <= e['r1']['T_days'] <= MAX_DAYS_PREFERRED else 0
        return (e['score'], e['r1']['conf'],
                -(e['r1']['rel_spread'] or 99), in_preferred)

    eligible.sort(key=_sort_key, reverse=True)

    sep = '=' * 62

    if not eligible:
        # Diagnose the best no-trade reason
        if not mkt_open:
            reason = 'OFFHOURS — market closed, quote quality insufficient'
        elif all(not r['green'] for r in rows2):
            reason = 'STATUS_NOT_GREEN — no slices passed density quality checks'
        elif all(r['conf'] < MIN_CONF for r in rows2):
            reason = 'LOW_CONFIDENCE — all slices below minimum confidence threshold'
        elif all((r['atm_iv_pct'] or 0) < max(rv5_pct, rv10_pct) + VRP_BUFFER
                 for r in rows2 if r['green']):
            reason = 'NO_VOL_RISK_PREMIUM — IV not sufficiently elevated vs realized vol'
        else:
            reason = 'NO_ELIGIBLE_SLICE — failed combined filter (mass/liquidity/stability/buffer)'

        ticket = f"""
{sep}
TRADE TICKET  —  {current_ticker}
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
Primary:   {ts1.strftime('%H:%M:%S')}   Validation: {ts2.strftime('%H:%M:%S')}
{sep}

  *** NO TRADE ***

  Reason: {reason}

  Market: {'OPEN' if mkt_open else 'CLOSED'}
  RV5d: {rv5_pct:.2f}%   RV10d: {rv10_pct:.2f}%
  Green slices available: {sum(1 for r in rows2 if r['green'])}
  Eligible (post-filter): 0

{sep}
"""
    else:
        best = eligible[0]
        r1       = best['r1']
        r2       = best['r2']
        strategy = best['strategy']
        short_k  = best['short_k']
        long_k   = best['long_k']
        score    = best['score']
        label    = best['label']
        breakdown= best['breakdown']

        exp_date    = r1['exp_date']
        exp_str     = exp_date.strftime('%d-%b-%Y')
        T_days      = r1['T_days']
        atm_iv      = r1['atm_iv_pct'] or 0
        rr          = r1['rr_25d']
        tail        = r1['tail'] or {}
        p_down_2pct = tail.get('p_down_2pct', None)
        p_down_3pct = tail.get('p_down_3pct', None)
        p_down_1pct = tail.get('p_down_1pct', None)

        # Risk/reward
        width_usd     = SPX_WIDTH_PTS * 100         # 1 contract
        # Estimate credit as ~30-35% of width for ATM-proximate spreads (placeholder)
        # Exact credit requires live chain; flagged as NEEDS_QUOTES
        est_credit_pts = round(SPX_WIDTH_PTS * 0.32, 1)
        est_credit_usd = round(est_credit_pts * 100, 0)
        max_loss_usd   = width_usd - est_credit_usd
        max_risk_usd   = ACCOUNT_SIZE_USD * RISK_PER_TRADE_PCT
        n_contracts    = max(1, int(max_risk_usd / max_loss_usd))

        # Exit levels
        tp_spread_pts  = round(est_credit_pts * 0.50, 1)   # 50% profit
        sl_spread_pts  = round(est_credit_pts * 2.00, 1)   # 2× credit SL
        if strategy == 'PUT_CREDIT_SPREAD':
            underlying_sl  = round(long_k  - SPX_WIDTH_PTS * 0.10, 0)   # near long strike
            underlying_em  = round(long_k  - 5, 0)
            move_risk_str  = (f"P[SPX ends below -{2:.0f}% in {T_days}d] = "
                              f"{p_down_2pct:.2f}%  (Q-measure)"
                              if p_down_2pct is not None else 'N/A')
        else:
            underlying_sl  = round(long_k  + SPX_WIDTH_PTS * 0.10, 0)
            underlying_em  = round(long_k  + 5, 0)
            move_risk_str  = (f"P[SPX ends above +{2:.0f}% in {T_days}d] = "
                              f"{p_down_1pct:.2f}% proxy  (Q-measure)"
                              if p_down_1pct is not None else 'N/A')

        time_exit_date = (exp_date - timedelta(days=1)).strftime('%d-%b-%Y')

        # Stability notes
        _, stab_issues1 = _stable(r1, r2)
        stab_str = 'PASSED' if not stab_issues1 else f"WARN: {'; '.join(stab_issues1)}"

        # Breakdown string
        bd_str = '  '.join(f"{k}:{v}" for k, v in breakdown)

        # Aggressiveness label
        buf_pct = abs(spot - short_k) / spot * 100
        if buf_pct >= 3.0:
            agg_label = 'CONSERVATIVE'
        elif buf_pct >= 2.0:
            agg_label = 'MODERATE'
        elif buf_pct >= 1.3:
            agg_label = 'AGGRESSIVE'
        else:
            agg_label = 'VERY_AGGRESSIVE'

        ticket = f"""
{sep}
TRADE TICKET  —  {current_ticker}
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
Primary:   {ts1.strftime('%H:%M:%S')}   Validation: {ts2.strftime('%H:%M:%S')}
{sep}

  DECISION: TRADE
  Strategy: {strategy}
  Stability: {stab_str}

  ── STRUCTURE ──────────────────────────────────────────────
  Type:            {'Put' if 'PUT' in strategy else 'Call'} Credit Spread
  Expiry:          {exp_str}  ({T_days} calendar days)
  Sell Strike:     {short_k}   (SELL TO OPEN)
  Buy Strike:      {long_k}   (BUY TO OPEN)
  Width:           {SPX_WIDTH_PTS} pts  |  Multiplier: 100  |  Suggested: {n_contracts} contract(s)
  Aggressiveness:  {agg_label}  (buffer {buf_pct:.2f}% from spot {spot:.2f})

  ── ENTRY ──────────────────────────────────────────────────
  ⚠ Credit estimate: ~{est_credit_pts} pts (~${est_credit_usd:,.0f}/contract)
    IMPORTANT: Verify live chain before entry — exact quote required.
  Target credit:   >= {round(est_credit_pts * 0.85, 1)} pts
  Max profit:      ~${est_credit_usd * n_contracts:,.0f}  ({n_contracts} contract(s))
  Max loss:        ~${max_loss_usd * n_contracts:,.0f}  (gap/assignment worst case)

  ── EXITS ──────────────────────────────────────────────────
  Take Profit:     Close spread when spread mark <= {tp_spread_pts} pts  (~50% profit)
  Stop Loss:       Close if spread mark >= {sl_spread_pts} pts  OR  {current_ticker} {'below' if 'PUT' in strategy else 'above'} {underlying_sl:.0f}
  Emergency Exit:  {current_ticker} {'below' if 'PUT' in strategy else 'above'} {underlying_em:.0f}  (near {'long put' if 'PUT' in strategy else 'long call'} strike)
  Time Exit:       Close by {time_exit_date}  (day before expiry)

  ── RISK METRICS ───────────────────────────────────────────
  Movement Risk:   {move_risk_str}
  ATM IV:          {atm_iv:.2f}%   RV5d: {rv5_pct:.2f}%   RV10d: {rv10_pct:.2f}%
  VRP:             {atm_iv - max(rv5_pct, rv10_pct):.2f}% premium
  RR 25d:          {rr if rr is not None else 'N/A'}  ({'put skew' if (rr or 0) < 0 else 'call skew'})
  P[<-2%]:         {f"{p_down_2pct:.3f}%" if p_down_2pct is not None else 'N/A'}
  P[<-3%]:         {f"{p_down_3pct:.3f}%" if p_down_3pct is not None else 'N/A'}

  ── QUALITY SCORE ──────────────────────────────────────────
  Score:           {score}/100  [{label}]
  Breakdown:       {bd_str}
  Confidence:      {r1['conf']:.1f}  (primary)  /  {r2['conf']:.1f}  (validation)
  Mass:            {r1['mass']:.4f} (p) / {r2['mass']:.4f} (v)

  ── ALL ELIGIBLE SLICES ────────────────────────────────────
  {'Expiry':>11}  {'Days':>4}  {'Strat':>18}  {'ShortK':>6}  {'LongK':>6}  {'Score':>5}  {'Label'}"""

        for e in eligible:
            er    = e['r1']
            edstr = e['r1']['exp_date'].strftime('%d-%b-%Y')
            ticket += (f"\n  {edstr:>11}  {er['T_days']:>4}  "
                       f"{e['strategy']:>18}  {e['short_k']:>6}  "
                       f"{e['long_k']:>6}  {e['score']:>5}  {e['label']}")

        ticket += f"\n\n{sep}\n"

    # ── Save ticket ───────────────────────────────────────────
    fname = (f"{current_ticker.replace('^','')}_TICKET_"
             f"{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.txt")
    with open(fname, 'w', encoding='utf-8') as f:
        f.write(ticket)

    print(ticket)
    print(f">>> Ticket saved to: {fname}")


btn_trade.on_clicked(generate_trade_ticket)

# ============================================================
# REFRESH CALLBACK
# ============================================================
def refresh(event):
    global spot, maturities_real, Z_real, K_common
    global n_slices, K_step, current_ticker
    global fwd_list, fwd_iqr_list, n_pairs_list, reliable_list
    global is_american, mkt_open, rv_dict, intraday_range, liq_list

    current_ticker = ticker_box.text.strip().upper()
    result = load_ticker(current_ticker)

    (spot, maturities_real, Z_real, K_common,
     fwd_list, fwd_iqr_list, n_pairs_list,
     reliable_list, is_american, mkt_open,
     rv_dict, intraday_range, liq_list) = result

    n_slices = len(maturities_real)
    K_step   = calc_k_step(K_common)

    mat_state['imin']     = 0
    mat_state['imax']     = n_slices - 1
    mat_state['kmin_idx'] = 0
    mat_state['kmax_idx'] = len(K_common) - 1

    update_mat_display()
    update_strike_display()
    draw_2d_slice(1)

    K_grid_new, T_grid_new = np.meshgrid(K_common, maturities_real)
    ax3d.clear()
    ax3d.plot_surface(K_grid_new, T_grid_new, Z_real,
                      cmap='plasma', edgecolor='none', alpha=0.95)
    style_3d(ax3d)
    ax3d.view_init(elev=slider_elev.val, azim=slider_azim.val)
    fig1.canvas.draw_idle()

btn_refresh.on_clicked(refresh)

# ============================================================
# BUTTON CALLBACKS
# ============================================================
def min_minus(event):
    if mat_state['imin'] > 0:
        mat_state['imin'] -= 1
        update_mat_display()
        draw_2d_slice(mat_state['imin'])
        update_3d()

def min_plus(event):
    if mat_state['imin'] < mat_state['imax'] - 1:
        mat_state['imin'] += 1
        update_mat_display()
        draw_2d_slice(mat_state['imin'])
        update_3d()

def max_minus(event):
    if mat_state['imax'] > mat_state['imin'] + 1:
        mat_state['imax'] -= 1
        update_mat_display()
        update_3d()

def max_plus(event):
    if mat_state['imax'] < n_slices - 1:
        mat_state['imax'] += 1
        update_mat_display()
        update_3d()

def kmin_minus(event):
    if mat_state['kmin_idx'] >= K_step:
        mat_state['kmin_idx'] -= K_step
        update_strike_display()
        draw_2d_slice(mat_state['imin'])
        update_3d()

def kmin_plus(event):
    if mat_state['kmin_idx'] < mat_state['kmax_idx'] - K_step:
        mat_state['kmin_idx'] += K_step
        update_strike_display()
        draw_2d_slice(mat_state['imin'])
        update_3d()

def kmax_minus(event):
    if mat_state['kmax_idx'] > mat_state['kmin_idx'] + K_step:
        mat_state['kmax_idx'] -= K_step
        update_strike_display()
        draw_2d_slice(mat_state['imin'])
        update_3d()

def kmax_plus(event):
    if mat_state['kmax_idx'] <= len(K_common) - 1 - K_step:
        mat_state['kmax_idx'] += K_step
        update_strike_display()
        draw_2d_slice(mat_state['imin'])
        update_3d()

btn_min_m.on_clicked(min_minus)
btn_min_p.on_clicked(min_plus)
btn_max_m.on_clicked(max_minus)
btn_max_p.on_clicked(max_plus)
btn_kmin_m.on_clicked(kmin_minus)
btn_kmin_p.on_clicked(kmin_plus)
btn_kmax_m.on_clicked(kmax_minus)
btn_kmax_p.on_clicked(kmax_plus)

# ============================================================
# ROTATION CALLBACKS
# ============================================================
def rotate(val):
    ax3d.view_init(elev=slider_elev.val, azim=slider_azim.val)
    fig1.canvas.draw_idle()

slider_elev.on_changed(rotate)
slider_azim.on_changed(rotate)

# ============================================================
# INITIAL DRAW
# ============================================================
draw_2d_slice(1)
update_mat_display()
update_strike_display()

plt.show()