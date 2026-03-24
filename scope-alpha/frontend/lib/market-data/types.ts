/**
 * Market data specific types (re-exports + additions).
 */

export type {
  OHLCV,
  Ticker,
  FundingRate,
  OpenInterest,
  Liquidation,
  MarkPrice,
  SSEEventType,
  SSEEvent,
} from '../exchanges/types';

export type {
  SSEClient,
} from './ws-manager';

/** Connection status for client-side display */
export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'reconnecting';
