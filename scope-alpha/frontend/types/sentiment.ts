export type FearGreedClassification =
  | 'Extreme Fear'
  | 'Fear'
  | 'Neutral'
  | 'Greed'
  | 'Extreme Greed';

export interface FearGreedPoint {
  value: number;
  classification: FearGreedClassification;
  timestamp: string;
}

export interface FearGreedResponse {
  current: FearGreedPoint;
  history: FearGreedPoint[];
  computed_at: string;
}

export type SentimentBias = 'bullish' | 'slightly_bullish' | 'neutral' | 'slightly_bearish' | 'bearish';

export interface SectorAsset {
  symbol: string;
  funding_rate: number;
}

export interface SectorGroup {
  name: string;
  assets: SectorAsset[];
  avg_funding: number;
  score: number;
  bias: SentimentBias;
}

export interface SectorSentimentResponse {
  sectors: SectorGroup[];
  computed_at: string;
}
