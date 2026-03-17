import type {
  MarketSnapshot,
  Candle,
  FundingData,
  OpenInterestData,
  LiquidationData,
  LiquidationEvent,
  BasisData,
  HealthScore,
  ScreenerRow,
} from "./types";

// ---------------------------------------------------------------------------
// Deterministic seeded PRNG (mulberry32) so values stay stable across renders
// ---------------------------------------------------------------------------
function seedFromSymbol(symbol: string): number {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) {
    h = (Math.imul(31, h) + symbol.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let s = seed | 0;
  return (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededRng(symbol: string) {
  return mulberry32(seedFromSymbol(symbol));
}

// Utility: random float in [min, max)
function randRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

// Fixed base timestamp to avoid server/client hydration mismatches from Date.now()
const BASE_TIME = 1742169600000; // 2025-03-17T00:00:00Z

// ---------------------------------------------------------------------------
// Static instrument definitions
// ---------------------------------------------------------------------------
interface InstrumentDef {
  symbol: string;
  name: string;
  price: number;
  marketCap: number;
  volume24h: number;
  rank: number;
}

const INSTRUMENT_DEFS: InstrumentDef[] = [
  { symbol: "BTC", name: "Bitcoin", price: 67234.5, marketCap: 1_323_000_000_000, volume24h: 28_400_000_000, rank: 1 },
  { symbol: "ETH", name: "Ethereum", price: 3512.8, marketCap: 422_000_000_000, volume24h: 14_200_000_000, rank: 2 },
  { symbol: "SOL", name: "Solana", price: 145.32, marketCap: 63_800_000_000, volume24h: 2_870_000_000, rank: 3 },
  { symbol: "BNB", name: "BNB", price: 598.4, marketCap: 91_600_000_000, volume24h: 1_620_000_000, rank: 4 },
  { symbol: "XRP", name: "XRP", price: 0.5284, marketCap: 28_900_000_000, volume24h: 1_040_000_000, rank: 5 },
  { symbol: "ADA", name: "Cardano", price: 0.4518, marketCap: 16_000_000_000, volume24h: 412_000_000, rank: 6 },
  { symbol: "AVAX", name: "Avalanche", price: 36.78, marketCap: 14_100_000_000, volume24h: 584_000_000, rank: 7 },
  { symbol: "DOGE", name: "Dogecoin", price: 0.1542, marketCap: 22_100_000_000, volume24h: 1_230_000_000, rank: 8 },
  { symbol: "DOT", name: "Polkadot", price: 7.24, marketCap: 10_200_000_000, volume24h: 326_000_000, rank: 9 },
  { symbol: "LINK", name: "Chainlink", price: 14.87, marketCap: 8_750_000_000, volume24h: 478_000_000, rank: 10 },
  { symbol: "MATIC", name: "Polygon", price: 0.7136, marketCap: 7_100_000_000, volume24h: 345_000_000, rank: 11 },
  { symbol: "UNI", name: "Uniswap", price: 7.82, marketCap: 5_880_000_000, volume24h: 198_000_000, rank: 12 },
  { symbol: "ATOM", name: "Cosmos", price: 8.94, marketCap: 3_480_000_000, volume24h: 172_000_000, rank: 13 },
  { symbol: "LTC", name: "Litecoin", price: 84.6, marketCap: 6_300_000_000, volume24h: 412_000_000, rank: 14 },
  { symbol: "NEAR", name: "NEAR Protocol", price: 5.72, marketCap: 6_100_000_000, volume24h: 298_000_000, rank: 15 },
  { symbol: "APT", name: "Aptos", price: 8.95, marketCap: 3_920_000_000, volume24h: 186_000_000, rank: 16 },
  { symbol: "ARB", name: "Arbitrum", price: 1.12, marketCap: 3_410_000_000, volume24h: 324_000_000, rank: 17 },
  { symbol: "OP", name: "Optimism", price: 2.48, marketCap: 2_820_000_000, volume24h: 256_000_000, rank: 18 },
  { symbol: "FIL", name: "Filecoin", price: 5.94, marketCap: 2_960_000_000, volume24h: 214_000_000, rank: 19 },
  { symbol: "INJ", name: "Injective", price: 24.36, marketCap: 2_280_000_000, volume24h: 178_000_000, rank: 20 },
];

// ---------------------------------------------------------------------------
// 1. MOCK_INSTRUMENTS - MarketSnapshot[]
// ---------------------------------------------------------------------------
function buildSparkline(rng: () => number, basePrice: number): number[] {
  const points: number[] = [];
  let p = basePrice;
  for (let i = 0; i < 20; i++) {
    p = p * (1 + (rng() - 0.48) * 0.025);
    points.push(parseFloat(p.toFixed(6)));
  }
  return points;
}

export const MOCK_INSTRUMENTS: MarketSnapshot[] = INSTRUMENT_DEFS.map((def) => {
  const rng = seededRng(def.symbol);
  return {
    symbol: def.symbol,
    name: def.name,
    price: def.price,
    marketCap: def.marketCap,
    volume24h: def.volume24h,
    change24h: parseFloat((randRange(rng, -8, 8)).toFixed(2)),
    change7d: parseFloat((randRange(rng, -15, 18)).toFixed(2)),
    rank: def.rank,
    sparkline: buildSparkline(rng, def.price),
  };
});

// ---------------------------------------------------------------------------
// 2. generateCandles
// ---------------------------------------------------------------------------
export function generateCandles(basePrice: number, count: number): Candle[] {
  const rng = mulberry32(Math.floor(basePrice * 100));
  const candles: Candle[] = [];
  let price = basePrice;
  const now = BASE_TIME;
  const interval = 60_000; // 1-minute candles

  for (let i = count - 1; i >= 0; i--) {
    const drift = (rng() - 0.48) * 0.006;
    const volatility = 0.003 + rng() * 0.008;

    const open = price;
    const close = open * (1 + drift);
    const wickUp = Math.abs(close - open) * (0.2 + rng() * 1.5);
    const wickDown = Math.abs(close - open) * (0.2 + rng() * 1.5);
    const high = Math.max(open, close) + wickUp;
    const low = Math.min(open, close) - wickDown;
    const volume = basePrice * (500 + rng() * 4500) * (1 + volatility * 50);

    candles.push({
      time: now - i * interval,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: parseFloat(volume.toFixed(0)),
    });

    price = close;
  }

  return candles;
}

// ---------------------------------------------------------------------------
// 3. generateFundingData
// ---------------------------------------------------------------------------
export function generateFundingData(symbol: string): FundingData {
  const rng = seededRng(symbol + "funding");
  const currentRate = parseFloat((randRange(rng, -0.0005, 0.001)).toFixed(6));
  const avg8h = parseFloat((currentRate + randRange(rng, -0.0001, 0.0001)).toFixed(6));
  const zScore = parseFloat((randRange(rng, -2.5, 2.5)).toFixed(2));
  const annualizedCarry = parseFloat((currentRate * 3 * 365 * 100).toFixed(2)); // rough annualization

  // 30 days of 8-hour intervals = ~90 data points
  const history: { time: number; rate: number }[] = [];
  const now = BASE_TIME;
  let rate = currentRate;
  for (let i = 89; i >= 0; i--) {
    rate = rate + randRange(rng, -0.00015, 0.00015);
    rate = Math.max(-0.001, Math.min(0.002, rate));
    history.push({
      time: now - i * 8 * 3_600_000,
      rate: parseFloat(rate.toFixed(6)),
    });
  }

  const byExchange = [
    { exchange: "Binance", rate: parseFloat((currentRate + randRange(rng, -0.00005, 0.00005)).toFixed(6)) },
    { exchange: "OKX", rate: parseFloat((currentRate + randRange(rng, -0.0001, 0.0001)).toFixed(6)) },
    { exchange: "Bybit", rate: parseFloat((currentRate + randRange(rng, -0.0001, 0.0001)).toFixed(6)) },
  ];

  return { symbol, currentRate, avg8h, zScore, annualizedCarry, history, byExchange };
}

// ---------------------------------------------------------------------------
// 4. generateOIData
// ---------------------------------------------------------------------------
export function generateOIData(symbol: string): OpenInterestData {
  const rng = seededRng(symbol + "oi");
  const def = INSTRUMENT_DEFS.find((d) => d.symbol === symbol) ?? INSTRUMENT_DEFS[0];

  // OI is typically 1-5% of market cap for large caps
  const oiFraction = randRange(rng, 0.01, 0.05);
  const aggregateOI = parseFloat((def.marketCap * oiFraction).toFixed(0));
  const change1h = parseFloat((randRange(rng, -2, 3)).toFixed(2));
  const change4h = parseFloat((randRange(rng, -5, 6)).toFixed(2));
  const change24h = parseFloat((randRange(rng, -10, 12)).toFixed(2));

  // 7 days of hourly data = 168 points
  const history: { time: number; value: number }[] = [];
  const now = BASE_TIME;
  let val = aggregateOI;
  for (let i = 167; i >= 0; i--) {
    val = val * (1 + randRange(rng, -0.005, 0.005));
    history.push({
      time: now - i * 3_600_000,
      value: parseFloat(val.toFixed(0)),
    });
  }

  const byExchange = [
    { exchange: "Binance", value: parseFloat((aggregateOI * randRange(rng, 0.35, 0.45)).toFixed(0)) },
    { exchange: "OKX", value: parseFloat((aggregateOI * randRange(rng, 0.2, 0.3)).toFixed(0)) },
    { exchange: "Bybit", value: parseFloat((aggregateOI * randRange(rng, 0.15, 0.25)).toFixed(0)) },
  ];

  return { symbol, aggregateOI, change1h, change4h, change24h, history, byExchange };
}

// ---------------------------------------------------------------------------
// 5. generateLiquidationData
// ---------------------------------------------------------------------------
export function generateLiquidationData(symbol: string): LiquidationData {
  const rng = seededRng(symbol + "liq");
  const def = INSTRUMENT_DEFS.find((d) => d.symbol === symbol) ?? INSTRUMENT_DEFS[0];

  const totalLong24h = parseFloat((def.volume24h * randRange(rng, 0.002, 0.01)).toFixed(0));
  const totalShort24h = parseFloat((def.volume24h * randRange(rng, 0.001, 0.008)).toFixed(0));

  const exchanges = ["Binance", "OKX", "Bybit", "Bitget", "dYdX"];
  const sides: ("long" | "short")[] = ["long", "short"];
  const events: LiquidationEvent[] = [];
  const now = BASE_TIME;

  for (let i = 0; i < 50; i++) {
    const timeOffset = Math.floor(rng() * 24 * 3_600_000);
    const side = sides[Math.floor(rng() * 2)];
    const amount = parseFloat((def.price * randRange(rng, 10, 5000)).toFixed(0));
    const priceDeviation = def.price * (1 + randRange(rng, -0.03, 0.03));

    events.push({
      time: new Date(now - timeOffset).toISOString(),
      symbol,
      exchange: exchanges[Math.floor(rng() * exchanges.length)],
      side,
      amount,
      price: parseFloat(priceDeviation.toFixed(2)),
    });
  }

  // Sort events newest first
  events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  // 24 hours of hourly liquidation volumes
  const history: { time: number; longVol: number; shortVol: number }[] = [];
  for (let i = 23; i >= 0; i--) {
    history.push({
      time: now - i * 3_600_000,
      longVol: parseFloat((totalLong24h / 24 * randRange(rng, 0.3, 2.5)).toFixed(0)),
      shortVol: parseFloat((totalShort24h / 24 * randRange(rng, 0.3, 2.5)).toFixed(0)),
    });
  }

  return { symbol, totalLong24h, totalShort24h, events, history };
}

// ---------------------------------------------------------------------------
// 6. generateBasisData
// ---------------------------------------------------------------------------
export function generateBasisData(symbol: string): BasisData {
  const rng = seededRng(symbol + "basis");
  const currentBasis = parseFloat((randRange(rng, -0.5, 2.5)).toFixed(3));
  const annualizedBasis = parseFloat((currentBasis * 4).toFixed(2)); // quarterly rough estimate

  // 30 days of 4-hour data = 180 points
  const history: { time: number; basis: number }[] = [];
  const now = BASE_TIME;
  let basis = currentBasis;
  for (let i = 179; i >= 0; i--) {
    basis = basis + randRange(rng, -0.08, 0.08);
    basis = Math.max(-1, Math.min(5, basis));
    history.push({
      time: now - i * 4 * 3_600_000,
      basis: parseFloat(basis.toFixed(3)),
    });
  }

  const byExchange = [
    { exchange: "Binance", basis: parseFloat((currentBasis + randRange(rng, -0.1, 0.1)).toFixed(3)) },
    { exchange: "OKX", basis: parseFloat((currentBasis + randRange(rng, -0.15, 0.15)).toFixed(3)) },
    { exchange: "Bybit", basis: parseFloat((currentBasis + randRange(rng, -0.12, 0.12)).toFixed(3)) },
  ];

  return { symbol, currentBasis, annualizedBasis, history, byExchange };
}

// ---------------------------------------------------------------------------
// 7. generateHealthScore
// ---------------------------------------------------------------------------
export function generateHealthScore(symbol: string): HealthScore {
  const rng = seededRng(symbol + "health");

  const funding = parseFloat((randRange(rng, 10, 100)).toFixed(0));
  const oi = parseFloat((randRange(rng, 10, 100)).toFixed(0));
  const liquidation = parseFloat((randRange(rng, 10, 100)).toFixed(0));
  const basis = parseFloat((randRange(rng, 10, 100)).toFixed(0));

  const score = parseFloat(((funding * 0.3 + oi * 0.25 + liquidation * 0.25 + basis * 0.2)).toFixed(1));

  let regime: HealthScore["regime"];
  if (score < 25) regime = "Risk Off";
  else if (score < 40) regime = "Cautious";
  else if (score < 60) regime = "Neutral";
  else if (score < 80) regime = "Risk On";
  else regime = "Overheated";

  return {
    symbol,
    score,
    regime,
    components: { funding, oi, liquidation, basis },
  };
}

// ---------------------------------------------------------------------------
// 8. generateScreenerData
// ---------------------------------------------------------------------------
export function generateScreenerData(): ScreenerRow[] {
  return MOCK_INSTRUMENTS.map((inst) => {
    const fundingData = generateFundingData(inst.symbol);
    const oiData = generateOIData(inst.symbol);
    const liqData = generateLiquidationData(inst.symbol);
    const basisData = generateBasisData(inst.symbol);
    const health = generateHealthScore(inst.symbol);

    const totalLiq = liqData.totalLong24h + liqData.totalShort24h;
    const liqRatio =
      liqData.totalShort24h > 0
        ? parseFloat((liqData.totalLong24h / liqData.totalShort24h).toFixed(2))
        : 0;

    return {
      // MarketSnapshot fields
      symbol: inst.symbol,
      name: inst.name,
      price: inst.price,
      marketCap: inst.marketCap,
      volume24h: inst.volume24h,
      change24h: inst.change24h,
      change7d: inst.change7d,
      rank: inst.rank,
      sparkline: inst.sparkline,

      // Screener-specific fields
      fundingRate: fundingData.currentRate,
      fundingZ: fundingData.zScore,
      oi: oiData.aggregateOI,
      oiChange24h: oiData.change24h,
      liq24h: totalLiq,
      liqRatio,
      basis: basisData.currentBasis,
      healthScore: health.score,
      regime: health.regime,
    };
  });
}
