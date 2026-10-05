'use client';

import { createAuthClient } from 'better-auth/react';
import { twoFactorClient } from 'better-auth/client/plugins';
import { clientEnv } from '@/env';

/**
 * Browser-side auth client.
 *
 * Sign-in itself goes through a server action so it can be rate-limited and
 * audited; this client is used for the flows that genuinely belong in the
 * browser — enrolling an authenticator, rotating backup codes, signing out.
 */
export const authClient = createAuthClient({
  baseURL: typeof window === 'undefined' ? clientEnv.NEXT_PUBLIC_SITE_URL : window.location.origin,
  plugins: [twoFactorClient()],
});

export const { useSession, signOut: clientSignOut, twoFactor } = authClient;
