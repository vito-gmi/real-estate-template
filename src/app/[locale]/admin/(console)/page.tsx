import Link from 'next/link';
import { Building2, FileEdit, Eye, Inbox, Plus } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/i18n/routing';
import { AdminPrice } from '@/features/admin/components/admin-price';
import { formatDate, formatNumber } from '@/lib/format';
import { adminPath } from '@/lib/routes';
import {
  countListingsByStatus,
  listAdminListings,
  sumRecentViews,
} from '@/server/repositories/admin-listings';
import { listInquiries } from '@/server/repositories/inquiries';

export default async function AdminDashboard({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  const [t, tEnum, statuses, views, recent, inquiries] = await Promise.all([
    getTranslations('admin'),
    getTranslations('enums'),
    countListingsByStatus(),
    sumRecentViews(),
    listAdminListings(locale, { limit: 6 }),
    listInquiries({ statuses: ['new'], limit: 5 }),
  ]);

  const stats = [
    { label: t('stats.activeListings'), value: statuses.active ?? 0, icon: Building2 },
    { label: t('stats.draftListings'), value: statuses.draft ?? 0, icon: FileEdit },
    { label: t('stats.newInquiries'), value: inquiries.length, icon: Inbox },
    { label: t('stats.totalViews'), value: views, icon: Eye },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{t('dashboard')}</h1>
        <Button asChild>
          <Link href={adminPath(locale, 'listings/new')}>
            <Plus />
            {t('newListing')}
          </Link>
        </Button>
      </div>

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-card border border-line bg-surface p-5">
            <div className="flex items-center justify-between">
              <dt className="text-sm text-ink-muted">{stat.label}</dt>
              <stat.icon className="size-4 text-ink-subtle" aria-hidden="true" />
            </div>
            <dd className="mt-2 text-2xl font-semibold text-ink">
              {formatNumber(locale, stat.value)}
            </dd>
          </div>
        ))}
      </dl>

      <section className="rounded-card border border-line bg-surface">
        <header className="flex items-center justify-between border-b border-line p-5">
          <h2 className="font-semibold text-ink">{t('listings')}</h2>
          <Link href={adminPath(locale, 'listings')} className="text-sm text-brand hover:underline">
            {t('listings')}
          </Link>
        </header>
        <ul className="divide-y divide-line">
          {recent.rows.map((row) => (
            <li key={row.id}>
              <Link
                href={adminPath(locale, `listings/${row.id}`)}
                className="flex flex-wrap items-center gap-3 p-4 transition-colors hover:bg-surface-muted"
              >
                <span className="font-mono text-xs text-ink-subtle">{row.reference}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                  {row.title}
                </span>
                <span className="text-sm text-ink-muted">
                  <AdminPrice
                    locale={locale}
                    price={row.price}
                    currency={row.currency}
                    showPrice={row.showPrice}
                    hiddenLabel={t('price.hidden')}
                  />
                </span>
                <Badge tone={row.status === 'active' ? 'success' : 'neutral'}>
                  {tEnum(`status.${row.status}`)}
                </Badge>
                <span className="hidden text-xs text-ink-subtle sm:inline">
                  {formatDate(locale, row.updatedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-card border border-line bg-surface">
        <header className="flex items-center justify-between border-b border-line p-5">
          <h2 className="font-semibold text-ink">{t('inquiryInbox.unhandled')}</h2>
          <Link href={adminPath(locale, 'inquiries')} className="text-sm text-brand hover:underline">
            {t('inquiries')}
          </Link>
        </header>
        {inquiries.length === 0 ? (
          <p className="p-5 text-sm text-ink-muted">{t('inquiryInbox.noInquiries')}</p>
        ) : (
          <ul className="divide-y divide-line">
            {inquiries.map((inquiry) => (
              <li key={inquiry.id} className="flex flex-wrap items-center gap-3 p-4">
                <span className="text-sm font-medium text-ink">{inquiry.name}</span>
                <a href={`mailto:${inquiry.email}`} className="text-sm text-brand hover:underline">
                  {inquiry.email}
                </a>
                {inquiry.listingReference ? (
                  <Badge tone="neutral">#{inquiry.listingReference}</Badge>
                ) : null}
                <span className="ml-auto text-xs text-ink-subtle">
                  {formatDate(locale, inquiry.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
