/**
 * Stage-message arrays narrating the computation pipeline behind each
 * volatility tool. ComputeLoader advances through these with a minimum
 * display time so the user sees the work being done, even if the Quant
 * Engine returns faster than the narrative.
 */

export const RND_STAGES = [
  "Fetching options chain from Deribit...",
  "Filtering illiquid strikes...",
  "Fitting implied volatility spline...",
  "Extracting risk-neutral density...",
  "Computing tail probabilities...",
] as const;

export const VOL_SURFACE_STAGES = [
  "Fetching options chain across expirations...",
  "Building density per maturity slice...",
  "Interpolating to common strike grid...",
  "Fitting volatility surface...",
] as const;

export const SKEW_STAGES = [
  "Fetching options chain...",
  "Computing ATM implied volatility...",
  "Extracting 25-delta risk reversals...",
  "Building term structure...",
] as const;

export const TERM_STAGES = [
  "Fetching options chain...",
  "Locating ATM strikes per expiry...",
  "Assembling term structure...",
] as const;

export const VOL_CONE_STAGES = [
  "Loading 180 days of historical prices...",
  "Computing realized volatility windows...",
  "Calculating percentile distributions...",
  "Overlaying current implied volatility...",
] as const;

export const VRP_STAGES = [
  "Loading IV and realized vol history...",
  "Aligning time series...",
  "Computing volatility risk premium...",
  "Ranking current VRP percentile...",
] as const;

export const GEX_STAGES = [
  "Fetching options chain with Greeks...",
  "Aggregating gamma exposure by strike...",
  "Detecting gamma flip level...",
  "Classifying dealer positioning regime...",
] as const;

export const DEX_STAGES = [
  "Fetching options chain...",
  "Aggregating dealer delta exposure...",
  "Scoring directional bias...",
] as const;

export const VANNA_CHARM_STAGES = [
  "Fetching options chain with Greeks...",
  "Computing vanna from delta-IV sensitivity...",
  "Computing charm from time-decay profile...",
  "Classifying IV and time-decay bias...",
] as const;

export const FLOW_STAGES = [
  "Fetching current and previous options chain...",
  "Scanning for volume spikes...",
  "Detecting open-interest surges...",
  "Ranking unusual-activity anomalies...",
] as const;
