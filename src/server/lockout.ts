import 'server-only';

import { Redis } from '@upstash/redis';
import { serverEnv } from '@/env';
import { lockoutSecondsForFailures } from '@/lib/lockout';

/**
 * Account lockout with exponential backoff.
 *
 * Sliding-window rate limits cap burst attempts; this layer lengthens the wait
 * after repeated failures so a password-spray that stays under the window still
 * gets slower, not just counted. The delay is keyed on the account, not the IP,
 * so distributing the attack across addresses does not reset the clock.
 */

const STATE_TTL_SECONDS = 24 * 60 * 60;

export type LockoutStatus = {
  readonly locked: boolean;
  readonly failures: number;
  readonly retryAfterSeconds: number;
};

type StoredState = {
  failures: number;
  lockedUntil: number;
};

const redis =
  serverEnv.UPSTASH_REDIS_REST_URL && serverEnv.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: serverEnv.UPSTASH_REDIS_REST_URL,
        token: serverEnv.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

const memory = new Map<string, StoredState>();

function keyFor(account: string): string {
  return `estate:lockout:${account.toLowerCase()}`;
}

async function readState(account: string): Promise<StoredState | null> {
  const key = keyFor(account);
  if (redis) {
    const stored = await redis.get<StoredState>(key);
    return stored ?? null;
  }
  return memory.get(key) ?? null;
}

async function writeState(account: string, state: StoredState): Promise<void> {
  const key = keyFor(account);
  if (redis) {
    await redis.set(key, state, { ex: STATE_TTL_SECONDS });
    return;
  }
  memory.set(key, state);
}

async function deleteState(account: string): Promise<void> {
  const key = keyFor(account);
  if (redis) {
    await redis.del(key);
    return;
  }
  memory.delete(key);
}

function toStatus(state: StoredState | null): LockoutStatus {
  if (!state) return { locked: false, failures: 0, retryAfterSeconds: 0 };
  const retryAfterSeconds = Math.max(0, Math.ceil((state.lockedUntil - Date.now()) / 1000));
  return {
    locked: retryAfterSeconds > 0,
    failures: state.failures,
    retryAfterSeconds,
  };
}

export async function getLockout(account: string): Promise<LockoutStatus> {
  return toStatus(await readState(account));
}

/** Record a failed sign-in and return the new lockout status. */
export async function recordAuthFailure(account: string): Promise<LockoutStatus> {
  const previous = await readState(account);
  const failures = (previous?.failures ?? 0) + 1;
  const lockSeconds = lockoutSecondsForFailures(failures);
  const state: StoredState = {
    failures,
    lockedUntil: lockSeconds > 0 ? Date.now() + lockSeconds * 1000 : 0,
  };
  await writeState(account, state);
  return toStatus(state);
}

/** A successful sign-in wipes the failure counter so a legitimate user is not punished later. */
export async function clearLockout(account: string): Promise<void> {
  await deleteState(account);
}
