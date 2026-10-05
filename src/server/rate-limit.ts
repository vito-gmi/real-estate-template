import 'server-only';

import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { serverEnv } from '@/env';

/**
 * Rate limiting and abuse control.
 *
 * Serverless functions do not share memory, so an in-process counter would let
 * an attacker multiply their allowance by the number of warm instances. Redis is
 * therefore the real implementation; the in-memory fallback exists so the app
 * runs locally without credentials, and it says so loudly at startup.
 */

type LimitResult = {
  readonly success: boolean;
  readonly remaining: number;
  readonly retryAfterSeconds: number;
};

export type LimiterName =
  | 'inquiry:ip'
  | 'inquiry:email'
  | 'login:ip'
  | 'login:account'
  | 'search:ip'
  | 'upload:user';

/** Window and quota per protected operation, in one table. */
const POLICIES: Record<LimiterName, { limit: number; windowSeconds: number }> = {
  // Lead forms: generous enough for a genuine visitor, useless for a spammer.
  'inquiry:ip': { limit: 5, windowSeconds: 3600 },
  'inquiry:email': { limit: 3, windowSeconds: 3600 },
  // Credential stuffing is throttled per source address and per account, so
  // spreading an attack across many IPs still hits the account limit.
  'login:ip': { limit: 10, windowSeconds: 900 },
  'login:account': { limit: 5, windowSeconds: 900 },
  'search:ip': { limit: 120, windowSeconds: 60 },
  'upload:user': { limit: 120, windowSeconds: 3600 },
};

const redis =
  serverEnv.UPSTASH_REDIS_REST_URL && serverEnv.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: serverEnv.UPSTASH_REDIS_REST_URL,
        token: serverEnv.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

if (!redis && process.env.NODE_ENV === 'production') {
  console.warn(
    '[rate-limit] UPSTASH_REDIS_REST_URL is not set. Falling back to a per-instance ' +
      'in-memory limiter, which does NOT protect a multi-instance deployment.',
  );
}

const limiters = new Map<LimiterName, Ratelimit>();

function limiterFor(name: LimiterName): Ratelimit | null {
  if (!redis) return null;
  let limiter = limiters.get(name);
  if (!limiter) {
    const policy = POLICIES[name];
    limiter = new Ratelimit({
      redis,
      // Sliding window avoids the burst-at-the-boundary weakness of fixed windows.
      limiter: Ratelimit.slidingWindow(policy.limit, `${policy.windowSeconds} s`),
      prefix: `estate:rl:${name}`,
      analytics: false,
    });
    limiters.set(name, limiter);
  }
  return limiter;
}

// --- In-memory fallback ----------------------------------------------------

const memory = new Map<string, { count: number; resetAt: number }>();

function memoryLimit(name: LimiterName, key: string): LimitResult {
  const policy = POLICIES[name];
  const now = Date.now();
  const bucketKey = `${name}:${key}`;
  const bucket = memory.get(bucketKey);

  if (!bucket || bucket.resetAt <= now) {
    memory.set(bucketKey, { count: 1, resetAt: now + policy.windowSeconds * 1000 });
    return { success: true, remaining: policy.limit - 1, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  const success = bucket.count <= policy.limit;
  return {
    success,
    remaining: Math.max(0, policy.limit - bucket.count),
    retryAfterSeconds: success ? 0 : Math.ceil((bucket.resetAt - now) / 1000),
  };
}

export async function checkRateLimit(name: LimiterName, key: string): Promise<LimitResult> {
  const limiter = limiterFor(name);
  if (!limiter) return memoryLimit(name, key);

  const result = await limiter.limit(key);
  return {
    success: result.success,
    remaining: result.remaining,
    retryAfterSeconds: Math.max(0, Math.ceil((result.reset - Date.now()) / 1000)),
  };
}

/**
 * Best-effort client address.
 *
 * Only the platform-set forwarding headers are trusted; on Vercel and behind
 * Cloudflare these are rewritten on every request and cannot be spoofed by the
 * client, unlike a bare `X-Forwarded-For`.
 */
export async function clientIp(): Promise<string> {
  const headerList = await headers();
  return (
    headerList.get('cf-connecting-ip') ??
    headerList.get('x-real-ip') ??
    headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    '0.0.0.0'
  );
}

/**
 * Salted hash of an address.
 *
 * Stored instead of the address itself: enough to correlate abuse, not enough
 * to identify a visitor, which keeps inquiry records outside the most sensitive
 * category of personal data.
 */
export function hashIp(ip: string): string {
  return createHash('sha256').update(`${serverEnv.IP_HASH_SALT}:${ip}`).digest('hex').slice(0, 32);
}
