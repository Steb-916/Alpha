/**
 * Backtesting engine — daily resolution, single asset, long/short.
 *
 * Accepts a list of entry/exit conditions (same FilterRule shape as screener),
 * runs them against a time-series of daily market snapshots, and returns
 * equity curve, trade log, and summary statistics.
 */

export type BacktestOperator = ">" | "<" | ">=" | "<=" | "==" | "!=";

export interface BacktestCondition {
  field: string;
  operator: BacktestOperator;
  value: number;
}

/** One row per calendar day — all fields normalised to human-readable units */
export interface DaySnapshot {
  date: string;        // "YYYY-MM-DD"
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  // derived
  priceChange1d: number;  // % change vs prev close
  // optional metric fields (may be missing for early dates)
  fundingRate?: number;   // decimal, e.g. 0.0001
  healthScore?: number;   // 0–100
  oiChangeDay?: number;   // % OI change vs prev day
  mvrvZScore?: number;
  sopr?: number;
  iv30d?: number;         // decimal
}

export interface BacktestConfig {
  asset: string;
  direction: "long" | "short";
  entry: BacktestCondition[];
  exit: BacktestCondition[];
  stopLossPct?: number;    // e.g. 5 = 5%
  takeProfitPct?: number;  // e.g. 10 = 10%
  initialCapital: number;
}

export interface BacktestTrade {
  entryDate: string;
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  pnlPct: number;
  pnlUsd: number;
  exitReason: "stop_loss" | "take_profit" | "metric_exit" | "end_of_data";
  entryMetrics: Record<string, number | undefined>;
}

export interface EquityPoint {
  date: string;
  equity: number;
  drawdown: number;  // as %
}

export interface BacktestStats {
  totalReturn: number;      // %
  cagr: number;             // %
  totalTrades: number;
  winRate: number;          // %
  avgWin: number;           // %
  avgLoss: number;          // %
  profitFactor: number;
  maxDrawdown: number;      // %
  sharpe: number;
  sortino: number;
  daysInMarket: number;     // %
}

export interface BacktestResult {
  equity: EquityPoint[];
  trades: BacktestTrade[];
  stats: BacktestStats;
  monthlyReturns: Record<string, number>;  // "YYYY-MM" -> %
}

function evaluateCondition(snap: DaySnapshot, cond: BacktestCondition): boolean {
  const raw = (snap as Record<string, unknown>)[cond.field];
  if (raw == null) return false;
  const v = raw as number;
  switch (cond.operator) {
    case ">":  return v > cond.value;
    case "<":  return v < cond.value;
    case ">=": return v >= cond.value;
    case "<=": return v <= cond.value;
    case "==": return Math.abs(v - cond.value) < 1e-9;
    case "!=": return Math.abs(v - cond.value) >= 1e-9;
  }
}

function allTrue(snap: DaySnapshot, conditions: BacktestCondition[]): boolean {
  return conditions.length > 0 && conditions.every((c) => evaluateCondition(snap, c));
}

function computeSharpe(dailyReturns: number[]): number {
  if (dailyReturns.length < 2) return 0;
  const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const variance =
    dailyReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (dailyReturns.length - 1);
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  return (mean / std) * Math.sqrt(252);
}

function computeSortino(dailyReturns: number[]): number {
  if (dailyReturns.length < 2) return 0;
  const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const downsideSq = dailyReturns.filter((r) => r < 0).map((r) => r ** 2);
  if (downsideSq.length === 0) return 10; // no losing days
  const downstd = Math.sqrt(downsideSq.reduce((a, b) => a + b, 0) / downsideSq.length);
  if (downstd === 0) return 10;
  return (mean / downstd) * Math.sqrt(252);
}

export function runBacktest(
  snapshots: DaySnapshot[],
  config: BacktestConfig,
): BacktestResult {
  const { direction, entry, exit, stopLossPct, takeProfitPct, initialCapital } = config;

  let equity = initialCapital;
  const equityCurve: EquityPoint[] = [];
  const trades: BacktestTrade[] = [];
  const dailyReturns: number[] = [];
  const monthlyReturns: Record<string, number> = {};

  let position: {
    entryDate: string;
    entryPrice: number;
    entryMetrics: Record<string, number | undefined>;
    startEquity: number;
  } | null = null;

  let peakEquity = initialCapital;
  let maxDrawdown = 0;
  let daysInMarket = 0;

  for (let i = 0; i < snapshots.length; i++) {
    const snap = snapshots[i];
    const dayStartEquity = equity;

    if (position) {
      daysInMarket++;
      const ep = position.entryPrice;

      // Check intra-day stop-loss / take-profit against high/low
      let exitPrice: number | null = null;
      let exitReason: BacktestTrade["exitReason"] | null = null;

      if (direction === "long") {
        if (stopLossPct != null) {
          const slPrice = ep * (1 - stopLossPct / 100);
          if (snap.low <= slPrice) {
            exitPrice = slPrice;
            exitReason = "stop_loss";
          }
        }
        if (!exitReason && takeProfitPct != null) {
          const tpPrice = ep * (1 + takeProfitPct / 100);
          if (snap.high >= tpPrice) {
            exitPrice = tpPrice;
            exitReason = "take_profit";
          }
        }
        if (!exitReason && exit.length > 0 && allTrue(snap, exit)) {
          exitPrice = snap.close;
          exitReason = "metric_exit";
        }
      } else {
        // short
        if (stopLossPct != null) {
          const slPrice = ep * (1 + stopLossPct / 100);
          if (snap.high >= slPrice) {
            exitPrice = slPrice;
            exitReason = "stop_loss";
          }
        }
        if (!exitReason && takeProfitPct != null) {
          const tpPrice = ep * (1 - takeProfitPct / 100);
          if (snap.low <= tpPrice) {
            exitPrice = tpPrice;
            exitReason = "take_profit";
          }
        }
        if (!exitReason && exit.length > 0 && allTrue(snap, exit)) {
          exitPrice = snap.close;
          exitReason = "metric_exit";
        }
      }

      // Last day — force close
      if (!exitReason && i === snapshots.length - 1) {
        exitPrice = snap.close;
        exitReason = "end_of_data";
      }

      if (exitPrice != null && exitReason != null) {
        const pnlPct =
          direction === "long"
            ? ((exitPrice - ep) / ep) * 100
            : ((ep - exitPrice) / ep) * 100;

        const pnlUsd = (position.startEquity * pnlPct) / 100;
        equity += pnlUsd;

        trades.push({
          entryDate: position.entryDate,
          entryPrice: position.entryPrice,
          exitDate: snap.date,
          exitPrice,
          pnlPct,
          pnlUsd,
          exitReason,
          entryMetrics: position.entryMetrics,
        });
        position = null;
      }
    }

    // Check entry (only if not in position)
    if (!position && allTrue(snap, entry)) {
      position = {
        entryDate: snap.date,
        entryPrice: snap.close,
        startEquity: equity,
        entryMetrics: {
          fundingRate: snap.fundingRate,
          healthScore: snap.healthScore,
          mvrvZScore: snap.mvrvZScore,
          sopr: snap.sopr,
          iv30d: snap.iv30d,
        },
      };
    }

    // Daily return for Sharpe
    const dayReturn = equity - dayStartEquity;
    dailyReturns.push(dayStartEquity > 0 ? (dayReturn / dayStartEquity) * 100 : 0);

    // Drawdown
    peakEquity = Math.max(peakEquity, equity);
    const dd = peakEquity > 0 ? ((peakEquity - equity) / peakEquity) * 100 : 0;
    maxDrawdown = Math.max(maxDrawdown, dd);

    // Monthly P&L
    const month = snap.date.slice(0, 7);
    if (!(month in monthlyReturns)) monthlyReturns[month] = 0;
    monthlyReturns[month] += dayReturn;

    equityCurve.push({ date: snap.date, equity, drawdown: -dd });
  }

  // Convert monthly P&L to %
  const monthlyReturnsPct: Record<string, number> = {};
  let runningEquity = initialCapital;
  for (const [month, pnl] of Object.entries(monthlyReturns)) {
    monthlyReturnsPct[month] = runningEquity > 0 ? (pnl / runningEquity) * 100 : 0;
    runningEquity += pnl;
  }

  // Stats
  const totalReturn = ((equity - initialCapital) / initialCapital) * 100;
  const days = snapshots.length;
  const years = days / 365;
  const cagr =
    years > 0
      ? (Math.pow(equity / initialCapital, 1 / years) - 1) * 100
      : 0;

  const wins = trades.filter((t) => t.pnlPct > 0);
  const losses = trades.filter((t) => t.pnlPct <= 0);
  const grossWin = wins.reduce((s, t) => s + t.pnlPct, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0));

  const stats: BacktestStats = {
    totalReturn,
    cagr,
    totalTrades: trades.length,
    winRate: trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
    avgWin: wins.length > 0 ? grossWin / wins.length : 0,
    avgLoss: losses.length > 0 ? grossLoss / losses.length : 0,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
    maxDrawdown,
    sharpe: computeSharpe(dailyReturns),
    sortino: computeSortino(dailyReturns),
    daysInMarket: days > 0 ? (daysInMarket / days) * 100 : 0,
  };

  return { equity: equityCurve, trades, stats, monthlyReturns: monthlyReturnsPct };
}
