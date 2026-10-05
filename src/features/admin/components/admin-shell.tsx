import Link from 'next/link';
import {
  Building2,
  ExternalLink,
  FolderTree,
  Inbox,
  LayoutDashboard,
  ScrollText,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { siteConfig } from '@/config/site';
import type { Locale } from '@/i18n/routing';
import { adminPath, homePath } from '@/lib/routes';
import type { StaffUser } from '@/server/auth/session';
import { SignOutButton } from './sign-out-button';

/**
 * Chrome for the admin console.
 *
 * A separate shell from the public site on purpose: nothing here should share a
 * layout, a cache policy or a navigation model with pages a visitor can see.
 */
export async function AdminShell({
  locale,
  user,
  children,
}: {
  locale: Locale;
  user: StaffUser;
  children: React.ReactNode;
}) {
  const t = await getTranslations('admin');

  const nav = [
    { href: adminPath(locale), label: t('dashboard'), icon: LayoutDashboard },
    { href: adminPath(locale, 'listings'), label: t('listings'), icon: Building2 },
    { href: adminPath(locale, 'inquiries'), label: t('inquiries'), icon: Inbox },
    { href: adminPath(locale, 'taxonomy'), label: t('taxonomy.title'), icon: FolderTree },
    { href: adminPath(locale, 'audit'), label: t('auditLog'), icon: ScrollText },
  ];

  return (
    <div className="min-h-dvh bg-surface-muted">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link href={adminPath(locale)} className="font-semibold tracking-tight text-ink">
            {siteConfig.name}
            <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">
              {t('title')}
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-3">
            <Link
              href={homePath(locale)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-brand"
            >
              <ExternalLink className="size-4" />
              <span className="hidden sm:inline">{siteConfig.domain}</span>
            </Link>
            <span className="hidden text-sm text-ink-muted sm:inline">{user.email}</span>
            <SignOutButton loginPath={adminPath(locale, 'login')} label={t('signOut')} />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <nav aria-label={t('title')} className="hidden w-52 shrink-0 lg:block">
          <ul className="sticky top-8 space-y-1">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center gap-2.5 rounded-control px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface hover:text-ink"
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <nav
        aria-label={t('title')}
        className="sticky bottom-0 border-t border-line bg-surface lg:hidden"
      >
        <ul className="mx-auto flex max-w-7xl">
          {nav.map((item) => (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className="flex flex-col items-center gap-1 py-2.5 text-xs text-ink-muted"
              >
                <item.icon className="size-5" />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
