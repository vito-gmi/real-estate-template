import { redirect } from 'next/navigation';
import { TwoFactorSetup } from '@/features/auth/components/two-factor-setup';
import type { Locale } from '@/i18n/routing';
import { adminPath } from '@/lib/routes';
import { getCurrentUser } from '@/server/auth/session';

export default async function TwoFactorSetupPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();

  if (!user) redirect(adminPath(locale, 'login'));
  if (user.twoFactorEnabled) redirect(adminPath(locale));

  return (
    <div className="grid min-h-dvh place-items-center bg-surface-muted px-4 py-12">
      <div className="w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-card">
        <TwoFactorSetup redirectTo={adminPath(locale)} />
      </div>
    </div>
  );
}
