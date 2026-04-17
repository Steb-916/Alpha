/**
 * Alert throttling — prevents a single alert from firing repeatedly within
 * a short window. The default throttle is 1 hour per alert.
 */

export interface ThrottleInput {
  lastTriggered: Date | null;
  throttleMs?: number;
}

const DEFAULT_THROTTLE_MS = 60 * 60 * 1000; // 1h

export function shouldFire(input: ThrottleInput): boolean {
  if (!input.lastTriggered) return true;
  const throttle = input.throttleMs ?? DEFAULT_THROTTLE_MS;
  return Date.now() - input.lastTriggered.getTime() > throttle;
}
