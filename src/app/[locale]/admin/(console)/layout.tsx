import type { ReactNode } from 'react';
import { AdminShell } from '@/features/admin/components/admin-shell';
import type { Locale } from '@/i18n/routing';
import { requireStaff } from '@/server/auth/session';

/**
 * The authorisation boundary for the console.
 *
 * Login and two-factor enrolment sit outside this group precisely so they are
 * reachable without a session; everything inside it is gated here.
 */
export default async function AdminConsoleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const user = await requireStaff(locale);

  return (
    <AdminShell locale={locale} user={user}>
      {children}
    </AdminShell>
  );
}
