/**
 * Technical indicator calculations.
 *
 * All functions are pure: given the same Candle[] + params, they return the
 * same output. Inputs are assumed to be sorted ascending by time. Output
 * points are aligned to the candle times at which each indicator becomes
 * defined (e.g. SMA(20) starts emitting at bar index 19).
 */

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Line = { time: number; value: number }[];

// ─── Simple Moving Average ─────────────────────────────────────────────────

export function sma(candles: Candle[], period: number): Line {
  if (period <= 0 || candles.length < period) return [];
  const out: Line = [];
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= period) sum -= candles[i - period].close;
    if (i >= period - 1) {
      out.push({ time: candles[i].time, value: sum / period });
    }
  }
  return out;
}

// ─── Exponential Moving Average ────────────────────────────────────────────

export function ema(candles: Candle[], period: number): Line {
  if (period <= 0 || candles.length < period) return [];
  const k = 2 / (period + 1);
  const out: Line = [];

  // Seed with SMA of the first `period` closes.
  let seed = 0;
  for (let i = 0; i < period; i++) seed += candles[i].close;
  let prev = seed / period;
  out.push({ time: candles[period - 1].time, value: prev });

  for (let i = period; i < candles.length; i++) {
    prev = candles[i].close * k + prev * (1 - k);
    out.push({ time: candles[i].time, value: prev });
  }
  return out;
}

// Same formula but driven off of an existing Line (used by MACD's signal
// which is an EMA of the MACD line, not of candle closes).
function emaOfValues(points: Line, period: number): Line {
  if (period <= 0 || points.length < period) return [];
  const k = 2 / (period + 1);
  const out: Line = [];

  let seed = 0;
  for (let i = 0; i < period; i++) seed += points[i].value;
  let prev = seed / period;
  out.push({ time: points[period - 1].time, value: prev });

  for (let i = period; i < points.length; i++) {
    prev = points[i].value * k + prev * (1 - k);
    out.push({ time: points[i].time, value: prev });
  }
  return out;
}

// ─── Bollinger Bands ───────────────────────────────────────────────────────

export function bollingerBands(
  candles: Candle[],
  period: number,
  stdDev: number,
): { upper: Line; middle: Line; lower: Line } {
  if (period <= 0 || candles.length < period) {
    return { upper: [], middle: [], lower: [] };
  }
  const upper: Line = [];
  const middle: Line = [];
  const lower: Line = [];

  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += candles[j].close;
    const mean = sum / period;

    let varSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const d = candles[j].close - mean;
      varSum += d * d;
    }
    const sigma = Math.sqrt(varSum / period);

    middle.push({ time: candles[i].time, value: mean });
    upper.push({ time: candles[i].time, value: mean + stdDev * sigma });
    lower.push({ time: candles[i].time, value: mean - stdDev * sigma });
  }

  return { upper, middle, lower };
}

// ─── VWAP (session-anchored to UTC day) ────────────────────────────────────

export function vwap(candles: Candle[]): Line {
  if (candles.length === 0) return [];
  const out: Line = [];
  const DAY_SECONDS = 86400;

  let cumPV = 0;
  let cumV = 0;
  let currentDay: number | null = null;

  for (const c of candles) {
    // time is unix seconds; bucket into UTC days
    const day = Math.floor(c.time / DAY_SECONDS);
    if (day !== currentDay) {
      cumPV = 0;
      cumV = 0;
      currentDay = day;
    }
    const typical = (c.high + c.low + c.close) / 3;
    cumPV += typical * c.volume;
    cumV += c.volume;
    // Guard against zero-volume candles — hold the previous value instead of
    // NaN.
    const value = cumV > 0 ? cumPV / cumV : typical;
    out.push({ time: c.time, value });
  }
  return out;
}

// ─── RSI (Wilder's smoothing) ──────────────────────────────────────────────

export function rsi(candles: Candle[], period: number): Line {
  if (period <= 0 || candles.length <= period) return [];
  const out: Line = [];

  // Seed: simple average of first `period` gains/losses (i.e. over candles
  // [1..period], which is `period` differences).
  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff > 0) gainSum += diff;
    else lossSum -= diff;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  const firstRs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
  const firstRsi = 100 - 100 / (1 + firstRs);
  out.push({
    time: candles[period].time,
    value: Number.isFinite(firstRsi) ? firstRsi : 100,
  });

  for (let i = period + 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    const value = 100 - 100 / (1 + rs);
    out.push({
      time: candles[i].time,
      value: Number.isFinite(value) ? value : 100,
    });
  }
  return out;
}

// ─── MACD ──────────────────────────────────────────────────────────────────

export function macd(
  candles: Candle[],
  fast = 12,
  slow = 26,
  signal = 9,
): { macd: Line; signal: Line; histogram: Line } {
  if (candles.length < slow) {
    return { macd: [], signal: [], histogram: [] };
  }
  const fastEma = ema(candles, fast);
  const slowEma = ema(candles, slow);

  // Align the two EMAs by time. The fast one starts emitting earlier, so
  // skip its leading points until it meets the slow one.
  const slowStart = slowEma[0].time;
  const fastAligned = fastEma.filter((p) => p.time >= slowStart);

  const macdLine: Line = [];
  for (let i = 0; i < slowEma.length; i++) {
    const f = fastAligned[i];
    const s = slowEma[i];
    if (!f || !s || f.time !== s.time) continue;
    macdLine.push({ time: s.time, value: f.value - s.value });
  }

  const signalLine = emaOfValues(macdLine, signal);
  const signalStart = signalLine[0]?.time ?? Infinity;
  const histogram: Line = [];
  for (const m of macdLine) {
    if (m.time < signalStart) continue;
    const sig = signalLine.find((p) => p.time === m.time);
    if (!sig) continue;
    histogram.push({ time: m.time, value: m.value - sig.value });
  }

  return { macd: macdLine, signal: signalLine, histogram };
}
