'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { actionClient, actionErr, actionOk, type ActionResult } from '@/lib/safe-action';
import { auth } from '@/server/auth/config';
import { recordAudit } from '@/server/repositories/audit';
import { checkRateLimit, clientIp, hashIp } from '@/server/rate-limit';
import { clearLockout, getLockout, recordAuthFailure } from '@/server/lockout';

/**
 * Sign-in, in two steps.
 *
 * Routing credentials through a server action rather than posting straight at
 * better-auth's endpoint buys three things worth having on an admin console:
 * per-account rate limiting in addition to per-IP (so an attacker spreading a
 * password-spray across a botnet still hits the account ceiling), an audit
 * entry for every attempt, and a uniform error message that never reveals
 * whether an email address exists.
 */

const signInSchema = z.object({
  email: z.email().max(160),
  password: z.string().min(1).max(200),
});

const totpSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$|^[A-Za-z0-9-]{8,}$/, 'admin.invalidCredentials'),
  trustDevice: z.boolean().default(false),
});

export type SignInOutcome = { readonly needsTwoFactor: boolean };

export const signIn = actionClient
  .metadata({ name: 'signIn' })
  .inputSchema(signInSchema)
  .action(async ({ parsedInput }): Promise<ActionResult<SignInOutcome>> => {
    const ip = await clientIp();
    const ipHash = hashIp(ip);
    const account = parsedInput.email.toLowerCase();

    const [byIp, byAccount] = await Promise.all([
      checkRateLimit('login:ip', ipHash),
      checkRateLimit('login:account', account),
    ]);

    const lockout = await getLockout(account);
    if (lockout.locked || !byIp.success || !byAccount.success) {
      await recordAudit({
        actorEmail: account,
        action: lockout.locked ? 'auth.locked' : 'auth.rate_limited',
        entityType: 'session',
        ipHash,
      });
      return actionErr('rate_limited', 'errors.rateLimited', {
        retryAfterSeconds: Math.max(
          lockout.retryAfterSeconds,
          byIp.retryAfterSeconds,
          byAccount.retryAfterSeconds,
        ),
      });
    }

    try {
      const result = await auth.api.signInEmail({
        body: { email: parsedInput.email, password: parsedInput.password },
        headers: await headers(),
        asResponse: false,
      });

      // The plugin reports "credentials were correct, now prove the second
      // factor" through this flag rather than by issuing a session.
      const needsTwoFactor = Boolean(
        (result as { twoFactorRedirect?: boolean }).twoFactorRedirect,
      );

      await clearLockout(account);
      await recordAudit({
        actorEmail: account,
        action: needsTwoFactor ? 'auth.password_ok' : 'auth.signed_in',
        entityType: 'session',
        ipHash,
      });

      return actionOk({ needsTwoFactor });
    } catch {
      const nextLockout = await recordAuthFailure(account);
      await recordAudit({
        actorEmail: account,
        action: nextLockout.locked ? 'auth.locked' : 'auth.failed',
        entityType: 'session',
        ipHash,
      });
      if (nextLockout.locked) {
        return actionErr('rate_limited', 'errors.rateLimited', {
          retryAfterSeconds: nextLockout.retryAfterSeconds,
        });
      }
      // Deliberately identical for "no such user" and "wrong password".
      return actionErr('unauthorized', 'admin.invalidCredentials');
    }
  });

export const verifyTwoFactor = actionClient
  .metadata({ name: 'verifyTwoFactor' })
  .inputSchema(totpSchema)
  .action(async ({ parsedInput }): Promise<ActionResult<{ verified: true }>> => {
    const ipHash = hashIp(await clientIp());

    const limit = await checkRateLimit('login:ip', `${ipHash}:totp`);
    if (!limit.success) {
      return actionErr('rate_limited', 'errors.rateLimited', {
        retryAfterSeconds: limit.retryAfterSeconds,
      });
    }

    const requestHeaders = await headers();
    const isBackupCode = !/^\d{6}$/.test(parsedInput.code);

    try {
      if (isBackupCode) {
        await auth.api.verifyBackupCode({
          body: { code: parsedInput.code, trustDevice: parsedInput.trustDevice },
          headers: requestHeaders,
        });
      } else {
        await auth.api.verifyTOTP({
          body: { code: parsedInput.code, trustDevice: parsedInput.trustDevice },
          headers: requestHeaders,
        });
      }

      await recordAudit({
        actorEmail: 'unknown',
        action: isBackupCode ? 'auth.backup_code_used' : 'auth.two_factor_ok',
        entityType: 'session',
        ipHash,
      });

      return actionOk({ verified: true });
    } catch {
      await recordAudit({
        actorEmail: 'unknown',
        action: 'auth.two_factor_failed',
        entityType: 'session',
        ipHash,
      });
      return actionErr('unauthorized', 'admin.invalidCredentials');
    }
  });

export const signOut = actionClient
  .metadata({ name: 'signOut' })
  .inputSchema(z.object({}))
  .action(async (): Promise<ActionResult<{ signedOut: true }>> => {
    await auth.api.signOut({ headers: await headers() });
    return actionOk({ signedOut: true });
  });
