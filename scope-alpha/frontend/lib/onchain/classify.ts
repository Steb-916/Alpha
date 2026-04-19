/**
 * Whale-transfer classification from a seed list of known exchange hot wallets.
 *
 * A transfer is classified as:
 *   - to_exchange      — destination is a known exchange, source is not
 *   - from_exchange    — source is a known exchange, destination is not
 *   - wallet_to_wallet — neither side labelled (unknown)
 *   - wallet_to_wallet (both labelled) — exchange-to-exchange transfers are
 *     intentionally folded into wallet_to_wallet because they signal neither
 *     accumulation nor distribution for the market-structure question we care
 *     about. Labels are still returned so the UI can show both.
 *
 * Lookup is case-insensitive (ETH addresses are lowercased on both sides).
 * Built once per provider boot via lazy-init — the seed files are static
 * bundles, safe to hold in memory.
 */

import type { OnChainAsset, TransferClassification } from '@/types/onchain';
import btcSeed from './exchange-addresses/btc.json';
import ethSeed from './exchange-addresses/eth.json';

interface SeedFile {
  _meta: { version: string; [k: string]: unknown };
  exchanges: Record<string, string[]>;
}

export interface Classified {
  fromLabel: string | null;
  toLabel: string | null;
  classification: TransferClassification;
}

let _btcMap: Map<string, string> | null = null;
let _ethMap: Map<string, string> | null = null;

function buildMap(seed: SeedFile, normalize: (s: string) => string): Map<string, string> {
  const map = new Map<string, string>();
  for (const [exchange, addresses] of Object.entries(seed.exchanges)) {
    for (const addr of addresses) {
      map.set(normalize(addr), exchange);
    }
  }
  return map;
}

function getLookup(asset: OnChainAsset): {
  map: Map<string, string>;
  normalize: (s: string) => string;
} {
  if (asset === 'BTC') {
    if (!_btcMap) _btcMap = buildMap(btcSeed as SeedFile, (s) => s);
    return { map: _btcMap, normalize: (s) => s };
  }
  if (!_ethMap) _ethMap = buildMap(ethSeed as SeedFile, (s) => s.toLowerCase());
  return { map: _ethMap, normalize: (s) => s.toLowerCase() };
}

export function classifyTransfer(
  asset: OnChainAsset,
  fromAddress: string,
  toAddress: string,
): Classified {
  const { map, normalize } = getLookup(asset);
  const fromLabel = map.get(normalize(fromAddress)) ?? null;
  const toLabel = map.get(normalize(toAddress)) ?? null;

  let classification: TransferClassification;
  if (fromLabel && !toLabel) classification = 'from_exchange';
  else if (toLabel && !fromLabel) classification = 'to_exchange';
  else classification = 'wallet_to_wallet';

  return { fromLabel, toLabel, classification };
}

export function seedVersion(asset: OnChainAsset): string {
  const seed = (asset === 'BTC' ? btcSeed : ethSeed) as SeedFile;
  return seed._meta.version;
}
