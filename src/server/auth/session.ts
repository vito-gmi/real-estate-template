import 'server-only';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import type { Locale } from '@/i18n/routing';
import type { UserRole } from '@/lib/domain/enums';
import { adminPath } from '@/lib/routes';
import { db } from '@/server/db/client';
import { users } from '@/server/db/schema';
import { auth } from './config';

/**
 * Session access for server components and actions.
 *
 * Every admin route calls `requireStaff`. The proxy's cookie check is only a
 * fast redirect for the common case — this is the actual authorisation
 * boundary, and it re-reads the user from the database on every request so a
 * suspended account loses access immediately rather than at session expiry.
 */

export type StaffUser = {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: UserRole;
  readonly twoFactorEnabled: boolean;
};

export async function getCurrentUser(): Promise<StaffUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      disabledAt: users.disabledAt,
      twoFactorEnabled: users.twoFactorEnabled,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!row || row.disabledAt) return null;

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    twoFactorEnabled: row.twoFactorEnabled,
  };
}

/** Roles ordered by capability; each inherits everything below it. */
const ROLE_RANK: Record<UserRole, number> = { agent: 1, editor: 2, admin: 3 };

export function hasRole(user: StaffUser, minimum: UserRole): boolean {
  return ROLE_RANK[user.role] >= ROLE_RANK[minimum];
}

/**
 * Gate for every admin page and mutation.
 *
 * Enforcing two-factor enrolment here rather than at sign-in is deliberate: a
 * user who somehow obtains a session without it still cannot reach anything,
 * and the redirect walks them through setup instead of locking them out.
 */
export async function requireStaff(
  locale: Locale,
  options: { minimumRole?: UserRole } = {},
): Promise<StaffUser> {
  const user = await getCurrentUser();

  if (!user) redirect(adminPath(locale, 'login'));
  if (!user.twoFactorEnabled) redirect(adminPath(locale, 'two-factor/setup'));
  if (options.minimumRole && !hasRole(user, options.minimumRole)) {
    redirect(adminPath(locale));
  }

  return user;
}

/** Non-redirecting variant, for server actions that return a Result. */
export async function currentStaffOrNull(minimumRole?: UserRole): Promise<StaffUser | null> {
  const user = await getCurrentUser();
  if (!user || !user.twoFactorEnabled) return null;
  if (minimumRole && !hasRole(user, minimumRole)) return null;
  return user;
}
