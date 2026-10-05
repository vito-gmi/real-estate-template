import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { InquiryRowActions } from '@/features/admin/components/inquiry-row-actions';
import type { Locale } from '@/i18n/routing';
import { inquiryStatuses, type InquiryStatus } from '@/lib/domain/enums';
import { formatDate } from '@/lib/format';
import { adminPath } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { requireStaff } from '@/server/auth/session';
import { listInquiries } from '@/server/repositories/inquiries';

const TONE: Record<InquiryStatus, 'brand' | 'warning' | 'success' | 'danger'> = {
  new: 'brand',
  in_progress: 'warning',
  closed: 'success',
  spam: 'danger',
};

export default async function AdminInquiriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await params;
  await requireStaff(locale);

  const { status } = await searchParams;
  const active = inquiryStatuses.includes(status as InquiryStatus)
    ? (status as InquiryStatus)
    : undefined;

  const [t, tEnum, inquiries] = await Promise.all([
    getTranslations('admin'),
    getTranslations('enums'),
    listInquiries({ statuses: active ? [active] : undefined, limit: 100 }),
  ]);

  const filters: { label: string; value?: InquiryStatus }[] = [
    { label: t('inquiryInbox.all') },
    ...inquiryStatuses.map((value) => ({ label: tEnum(`inquiryStatus.${value}`), value })),
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">{t('inquiryInbox.title')}</h1>

      <nav className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <Link
            key={filter.value ?? 'all'}
            href={filter.value ? `?status=${filter.value}` : adminPath(locale, 'inquiries')}
            aria-current={active === filter.value ? 'page' : undefined}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm transition-colors',
              active === filter.value
                ? 'border-brand bg-brand text-ink-inverse'
                : 'border-line-strong bg-surface text-ink-muted hover:border-ink-subtle',
            )}
          >
            {filter.label}
          </Link>
        ))}
      </nav>

      {inquiries.length === 0 ? (
        <p className="rounded-card border border-dashed border-line-strong bg-surface p-10 text-center text-ink-muted">
          {t('inquiryInbox.noInquiries')}
        </p>
      ) : (
        <ul className="space-y-3">
          {inquiries.map((inquiry) => (
            <li key={inquiry.id} className="rounded-card border border-line bg-surface p-5">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink">{inquiry.name}</span>
                    <Badge tone={TONE[inquiry.status]}>
                      {tEnum(`inquiryStatus.${inquiry.status}`)}
                    </Badge>
                    <Badge tone="neutral">{tEnum(`inquiryKind.${inquiry.kind}`)}</Badge>
                  </div>

                  <div className="mt-1 flex flex-wrap gap-x-4 text-sm text-ink-muted">
                    <a href={`mailto:${inquiry.email}`} className="hover:text-brand">
                      {inquiry.email}
                    </a>
                    {inquiry.phone ? (
                      <a href={`tel:${inquiry.phone}`} className="hover:text-brand">
                        {inquiry.phone}
                      </a>
                    ) : null}
                  </div>

                  {inquiry.message ? (
                    <p className="mt-3 whitespace-pre-wrap text-sm text-ink">{inquiry.message}</p>
                  ) : null}

                  {inquiry.listingId ? (
                    <p className="mt-3 text-sm">
                      <span className="text-ink-subtle">{t('inquiryInbox.relatedListing')}: </span>
                      <Link
                        href={adminPath(locale, `listings/${inquiry.listingId}`)}
                        className="text-brand hover:underline"
                      >
                        #{inquiry.listingReference} {inquiry.listingTitle}
                      </Link>
                    </p>
                  ) : null}
                </div>

                <time
                  dateTime={inquiry.createdAt.toISOString()}
                  className="text-xs text-ink-subtle"
                >
                  {formatDate(locale, inquiry.createdAt)}
                </time>
              </div>

              <div className="mt-4 border-t border-line pt-3">
                <InquiryRowActions id={inquiry.id} status={inquiry.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
