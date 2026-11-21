import { redirect } from 'next/navigation';
import { BrandLogo } from '@/components/layout/brand-logo';
import { LoginForm } from '@/features/auth/components/login-form';
import type { Locale } from '@/i18n/routing';
import { adminPath } from '@/lib/routes';
import { getCurrentUser } from '@/server/auth/session';

export default async function AdminLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  const { next } = await searchParams;

  const user = await getCurrentUser();
  if (user) redirect(user.twoFactorEnabled ? adminPath(locale) : adminPath(locale, 'two-factor/setup'));

  // Only same-origin, admin-scoped destinations are honoured, so the `next`
  // parameter cannot be used to bounce a signed-in user off to another site.
  const destination =
    next && next.startsWith(`/${locale}/admin`) && !next.includes('//')
      ? next
      : adminPath(locale);

  return (
    <div className="grid min-h-dvh place-items-center bg-surface-muted px-4 py-12">
      <div className="w-full max-w-sm">
        <p className="mb-8 flex items-center justify-center gap-2 text-lg font-semibold tracking-tight text-ink">
          <BrandLogo imageClassName="h-10" />
        </p>
        <div className="rounded-card border border-line bg-surface p-6 shadow-card">
          <LoginForm next={destination} />
        </div>
      </div>
    </div>
  );
}
