/**
 * Lock duration after `failures` consecutive failures.
 *
 * The first four misses are handled by the sliding-window limiter only. From
 * the fifth, the wait doubles each time (1, 2, 4, … minutes) and caps at 32.
 */
export const FAILURES_BEFORE_LOCK = 5;
export const MAX_LOCK_SECONDS = 32 * 60;

export function lockoutSecondsForFailures(failures: number): number {
  if (failures < FAILURES_BEFORE_LOCK) return 0;
  return Math.min(MAX_LOCK_SECONDS, 60 * 2 ** (failures - FAILURES_BEFORE_LOCK));
}
