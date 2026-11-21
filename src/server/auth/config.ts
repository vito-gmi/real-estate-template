import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { twoFactor } from 'better-auth/plugins';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { siteConfig } from '@/config/site';
import { clientEnv, serverEnv } from '@/env';
import { db } from '@/server/db/client';
import * as schema from '@/server/db/schema';

/**
 * Staff authentication.
 *
 * There are no public visitor accounts: favourites live in the browser, so every
 * row in the users table belongs to someone who can change what the world sees.
 * The configuration is tightened accordingly — self-service sign-up is off,
 * sessions are short, and two-factor authentication is enforced for anyone with
 * write access (see `requireStaff`).
 */

/**
 * OWASP's recommended Argon2id parameters: 19 MiB of memory, two passes, one
 * lane. Memory-hard hashing is what makes an offline attack on a stolen digest
 * expensive; the default scrypt settings are considerably weaker.
 */
const ARGON2_OPTIONS = {
  algorithm: 2, // Argon2id — const enum is unusable under isolatedModules
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

const EIGHT_HOURS = 60 * 60 * 8;

export const auth = betterAuth({
  appName: siteConfig.name,
  baseURL: clientEnv.NEXT_PUBLIC_SITE_URL,
  secret: serverEnv.AUTH_SECRET,
  basePath: '/api/auth',
  // Lets staff sign in through a tunnel or a LAN address while developing.
  ...(process.env.NODE_ENV === 'development'
    ? {
        trustedOrigins: [
          'https://*.ngrok-free.app',
          'https://*.ngrok.app',
          'https://*.ngrok.io',
          'https://*.trycloudflare.com',
          'http://192.168.*.*:*',
          'http://10.*.*.*:*',
        ],
      }
    : {}),

  /**
   * Staff sign in only through the `signIn` server action, which adds the
   * per-account limit, the lockout backoff and the audit trail. Left open, this
   * HTTP endpoint is a side door around all three (validated: 21 wrong guesses,
   * no lockout, no audit row, then a session). `disabledPaths` is enforced by
   * the HTTP router only, so the action's `auth.api.signInEmail` still works.
   */
  disabledPaths: ['/sign-in/email'],

  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
    // Our tables are named `users`, `sessions`, … rather than the singular
    // defaults, because `user` is awkward to quote in raw SQL.
    usePlural: true,
  }),

  emailAndPassword: {
    enabled: true,
    // Accounts are provisioned deliberately (`npm run admin:create`) — an open
    // registration endpoint on an admin console is an unnecessary risk.
    disableSignUp: true,
    minPasswordLength: 12,
    maxPasswordLength: 200,
    autoSignIn: false,
    revokeSessionsOnPasswordReset: true,
    password: {
      hash: (password) => argonHash(password, ARGON2_OPTIONS),
      verify: ({ hash, password }) => argonVerify(hash, password, ARGON2_OPTIONS),
    },
  },

  user: {
    additionalFields: {
      role: { type: 'string', required: false, defaultValue: 'agent', input: false },
      disabledAt: { type: 'date', required: false, input: false },
    },
  },

  session: {
    // Short-lived by design: an admin session is a high-value credential, and
    // staff sign in from an office rather than from a phone on a bus.
    expiresIn: EIGHT_HOURS,
    updateAge: 60 * 60,
    freshAge: 60 * 15,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },

  advanced: {
    // Same single trusted header as the app's own limiters (see rate-limit.ts).
    ipAddress: { ipAddressHeaders: [serverEnv.CLIENT_IP_HEADER] },
    useSecureCookies: process.env.NODE_ENV === 'production',
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    },
  },

  // Defence in depth: the login server action applies its own per-IP and
  // per-account limits, and better-auth throttles its whole endpoint surface.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
  },

  plugins: [
    twoFactor({ issuer: siteConfig.name }),
    // Must stay last: it lets server actions set the session cookie.
    nextCookies(),
  ],
});

export type Auth = typeof auth;
