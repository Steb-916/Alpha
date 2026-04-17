/**
 * Upstash Redis cache wrapper.
 *
 * Used by the slow-metric API routes (funding, OI, basis, health, screener).
 * Provides:
 *   - getCached / setCached for fresh values with TTL
 *   - setStale     for a long-TTL backup copy
 *   - withCacheAndStale: cache → fresh fetch → fallback to stale on failure
 *
 * Cache is OPTIONAL: if Upstash env vars aren't configured (e.g. local dev
 * without an Upstash account), the helpers degrade to a process-local Map so
 * the routes still function.
 */

import { Redis } from '@upstash/redis';

const STALE_SUFFIX = ':stale';
const STALE_TTL_SECONDS = 5 * 60; // 5 minutes

// ─── Client ─────────────────────────────────────────────────────────────────

let _redis: Redis | null = null;
let _initTried = false;

function getClient(): Redis | null {
  if (_initTried) return _redis;
  _initTried = true;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[cache/redis] Upstash env vars not set; falling back to in-memory cache. ' +
          'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for cross-instance cache.',
      );
    }
    return null;
  }
  try {
    _redis = new Redis({ url, token });
  } catch (err) {
    console.error('[cache/redis] Failed to init Upstash client:', err);
    _redis = null;
  }
  return _redis;
}

// ─── In-memory fallback ─────────────────────────────────────────────────────

interface MemEntry {
  value: unknown;
  expiresAt: number; // ms epoch; 0 = no expiry
}
const memStore = new Map<string, MemEntry>();

function memGet<T>(key: string): T | null {
  const entry = memStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
    memStore.delete(key);
    return null;
  }
  return entry.value as T;
}

function memSet<T>(key: string, value: T, ttlSeconds: number): void {
  memStore.set(key, {
    value,
    expiresAt: ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : 0,
  });
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function getCached<T>(key: string): Promise<T | null> {
  const r = getClient();
  if (!r) return memGet<T>(key);
  try {
    const v = await r.get<T>(key);
    return (v ?? null) as T | null;
  } catch (err) {
    console.error(`[cache/redis] get(${key}) failed:`, err);
    return memGet<T>(key);
  }
}

export async function setCached<T>(
  key: string,
  value: T,
  ttlSeconds: number,
): Promise<void> {
  const r = getClient();
  if (!r) {
    memSet(key, value, ttlSeconds);
    return;
  }
  try {
    if (ttlSeconds > 0) {
      await r.set(key, value, { ex: ttlSeconds });
    } else {
      await r.set(key, value);
    }
  } catch (err) {
    console.error(`[cache/redis] set(${key}) failed:`, err);
    memSet(key, value, ttlSeconds);
  }
}

export async function setStale<T>(key: string, value: T): Promise<void> {
  await setCached(`${key}${STALE_SUFFIX}`, value, STALE_TTL_SECONDS);
}

export async function getStale<T>(key: string): Promise<T | null> {
  return getCached<T>(`${key}${STALE_SUFFIX}`);
}

/**
 * Cache + stale-fallback wrapper. Wrap any expensive fetcher in this:
 *
 *   const data = await withCacheAndStale('market:funding:BTCUSDT', 60, () =>
 *     aggregateFunding('BTC'));
 *
 * Behavior:
 *   1. If fresh cache present → return it (with `_cachedAt`).
 *   2. Otherwise call `fetcher()`. On success, write fresh + stale copies and return.
 *   3. On fetcher failure, return stale copy with `_stale: true` if present.
 *   4. If no stale either, rethrow the original error.
 *
 * The wrapper only attaches `_cachedAt` / `_stale` if `value` is an object.
 */
export async function withCacheAndStale<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T & { _cachedAt?: number; _stale?: boolean }> {
  // 1. Fresh hit
  const fresh = await getCached<T & { _cachedAt?: number }>(key);
  if (fresh != null) {
    return fresh;
  }

  // 2. Fresh fetch
  try {
    const value = await fetcher();
    const stamped =
      value && typeof value === 'object' && !Array.isArray(value)
        ? ({ ...(value as object), _cachedAt: Date.now() } as T & {
            _cachedAt: number;
          })
        : value;
    await setCached(key, stamped, ttlSeconds);
    await setStale(key, stamped);
    return stamped as T & { _cachedAt?: number };
  } catch (err) {
    // 3. Stale fallback
    const stale = await getStale<T & { _cachedAt?: number }>(key);
    if (stale != null) {
      console.warn(
        `[cache/redis] ${key}: fresh fetch failed, returning stale (`,
        (err as Error).message,
        ')',
      );
      return { ...(stale as object), _stale: true } as T & {
        _cachedAt?: number;
        _stale: true;
      };
    }
    // 4. No stale either — propagate
    throw err;
  }
}

/**
 * Direct, low-level set used by the screener cron when the wrapper isn't suitable.
 *
 * Arrays are stored as-is (not spread) so array round-tripping works; plain
 * object values get a `_cachedAt` timestamp stamped in.
 */
export async function writeFreshAndStale<T>(
  key: string,
  value: T,
  ttlSeconds: number,
): Promise<void> {
  const stamped =
    value && typeof value === 'object' && !Array.isArray(value)
      ? ({ ...(value as object), _cachedAt: Date.now() } as T)
      : value;
  await setCached(key, stamped, ttlSeconds);
  await setStale(key, stamped);
}

// ─── Phase 6: enumeration helpers for typing/presence ──────────────────────
//
// scanKeys lists all keys matching `${prefix}*`. Used by the chat presence
// route to enumerate currently-typing and currently-online users in a room.
//
// SCALING NOTE: Upstash KEYS is O(n) against the entire keyspace. At alpha
// scale (handful of analyst rooms × < 50 concurrent users) this is fine.
// At higher scale, migrate to a per-room Redis sorted set:
//   ZADD chat:presence:{roomId} <expiryTimestamp> {userId}
//   ZRANGEBYSCORE chat:presence:{roomId} <now> +inf
// Then enumeration is O(log n + m) and TTL semantics live in the score.
// This is a follow-up task — not a Phase 6 blocker.

export async function scanKeys(prefix: string): Promise<string[]> {
  const r = getClient();
  if (!r) {
    // In-memory fallback: iterate the Map.
    const out: string[] = [];
    const now = Date.now();
    for (const [key, entry] of memStore.entries()) {
      if (key.startsWith(prefix)) {
        // Skip expired entries (lazy cleanup).
        if (entry.expiresAt > 0 && now > entry.expiresAt) {
          memStore.delete(key);
          continue;
        }
        out.push(key);
      }
    }
    return out;
  }
  try {
    // Upstash supports the standard KEYS command with glob patterns.
    const keys = await r.keys(`${prefix}*`);
    return Array.isArray(keys) ? keys : [];
  } catch (err) {
    console.error(`[cache/redis] scanKeys(${prefix}) failed:`, err);
    return [];
  }
}

/** Delete a single key from the cache. */
export async function delKey(key: string): Promise<void> {
  const r = getClient();
  if (!r) {
    memStore.delete(key);
    return;
  }
  try {
    await r.del(key);
  } catch (err) {
    console.error(`[cache/redis] del(${key}) failed:`, err);
    memStore.delete(key);
  }
}

// ─── Single-flight locks (for on-demand cache warming) ────────────────────
//
// tryAcquireLock/releaseLock form a short-lived distributed mutex used to
// prevent thundering-herd problems when multiple requests simultaneously hit
// a cold cache and each tries to fetch from the upstream. Only one fetcher
// wins the lock; the others wait briefly and read cache.
//
// Semantics: SET NX EX — atomic "set if not exists, with TTL". In-memory
// fallback uses the same memStore used by the general cache.

const LOCK_PREFIX = '__lock__:';

export async function tryAcquireLock(
  key: string,
  ttlSeconds: number,
): Promise<boolean> {
  const lockKey = `${LOCK_PREFIX}${key}`;
  const r = getClient();
  if (!r) {
    if (memGet<number>(lockKey) != null) return false;
    memSet(lockKey, 1, ttlSeconds);
    return true;
  }
  try {
    const result = await r.set(lockKey, '1', { nx: true, ex: ttlSeconds });
    return result === 'OK';
  } catch (err) {
    console.error(`[cache/redis] tryAcquireLock(${key}) failed:`, err);
    return false;
  }
}

export async function releaseLock(key: string): Promise<void> {
  await delKey(`${LOCK_PREFIX}${key}`);
}

// ─── Phase 7: rate-limit counters ──────────────────────────────────────────
//
// incrementWithExpiry atomically increments a counter and (on the first
// increment that creates the key) sets a TTL. Returns the post-increment
// count and the remaining seconds until expiry.
//
// Used by lib/rateLimit.ts. Falls back to a separate in-memory Map so the
// helper works in dev without Upstash.

interface MemCounter {
  count: number;
  expiresAt: number; // ms epoch
}
const memCounters = new Map<string, MemCounter>();

export async function incrementWithExpiry(
  key: string,
  ttlSeconds: number,
): Promise<{ count: number; ttl: number }> {
  const r = getClient();
  if (!r) {
    const now = Date.now();
    const existing = memCounters.get(key);
    if (!existing || existing.expiresAt <= now) {
      const fresh = { count: 1, expiresAt: now + ttlSeconds * 1000 };
      memCounters.set(key, fresh);
      return { count: 1, ttl: ttlSeconds };
    }
    existing.count += 1;
    return {
      count: existing.count,
      ttl: Math.max(0, Math.ceil((existing.expiresAt - now) / 1000)),
    };
  }
  try {
    const count = await r.incr(key);
    if (count === 1) {
      // First request in this window — set the expiry.
      await r.expire(key, ttlSeconds);
    }
    const ttl = await r.ttl(key);
    return { count, ttl: typeof ttl === 'number' && ttl > 0 ? ttl : ttlSeconds };
  } catch (err) {
    console.error(`[cache/redis] incrementWithExpiry(${key}) failed:`, err);
    // Fail open — don't block users on Redis outage.
    return { count: 0, ttl: ttlSeconds };
  }
}
