import Link from 'next/link';
import { Camera, ChevronRight, Phone } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { submissionStatusFilter } from '@/features/submissions/schema';
import { submissionTone } from '@/features/submissions/status-tone';
import type { Locale } from '@/i18n/routing';
import { reviewableSubmissionStatuses, type SubmissionStatus } from '@/lib/domain/enums';
import { formatDate, formatPrice } from '@/lib/format';
import { adminPath } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { requireStaff } from '@/server/auth/session';
import { listSubmissions } from '@/server/repositories/submissions';

/** The review queue: newest first, pending by default. */
export default async function AdminSubmissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await params;
  await requireStaff(locale);

  const { status } = await searchParams;
  const parsed = submissionStatusFilter.safeParse(status);
  const active: SubmissionStatus = parsed.success ? parsed.data : 'pending';

  const [t, tEnum, rows] = await Promise.all([
    getTranslations('admin.submissions'),
    getTranslations('enums'),
    listSubmissions({ locale, statuses: [active], limit: 200 }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{t('title')}</h1>
        <p className="mt-1 text-sm text-ink-muted">{t('subtitle')}</p>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label={t('filterLabel')}>
        {reviewableSubmissionStatuses.map((value) => (
          <Link
            key={value}
            href={value === 'pending' ? adminPath(locale, 'submissions') : `?status=${value}`}
            aria-current={active === value ? 'page' : undefined}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm transition-colors',
              active === value
                ? 'border-brand bg-brand text-ink-inverse'
                : 'border-line-strong bg-surface text-ink-muted hover:border-ink-subtle',
            )}
          >
            {tEnum(`submissionStatus.${value}`)}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="rounded-card border border-dashed border-line-strong bg-surface p-10 text-center text-ink-muted">
          {t('empty')}
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {rows.map((row) => {
            const place = row.locationName
              ? [row.locationName, row.parentName].filter(Boolean).join(', ')
              : row.locationText;
            return (
              <li key={row.id}>
                <Link
                  href={adminPath(locale, `submissions/${row.id}`)}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 transition-colors hover:bg-surface-muted"
                >
                  <span className="font-mono text-xs text-ink-subtle">#{row.reference}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink">
                        {row.propertyKind ? tEnum(`propertyKind.${row.propertyKind}`) : '—'}
                        {place ? `, ${place}` : ''}
                      </span>
                      {row.dealType ? <Badge tone="brand">{tEnum(`dealType.${row.dealType}`)}</Badge> : null}
                      <Badge tone={submissionTone[row.status]}>{tEnum(`submissionStatus.${row.status}`)}</Badge>
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
                      <span>
                        {row.firstName} {row.lastName}
                      </span>
                      {row.phone ? (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="size-3.5" aria-hidden="true" />
                          {row.phone}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1">
                        <Camera className="size-3.5" aria-hidden="true" />
                        {t('photoCount', { count: row.photoCount })}
                      </span>
                      {row.price ? <span>{formatPrice(locale, row.price, row.currency)}</span> : null}
                    </span>
                  </span>
                  {row.submittedAt ? (
                    <time dateTime={row.submittedAt.toISOString()} className="text-xs text-ink-subtle">
                      {formatDate(locale, row.submittedAt)}
                    </time>
                  ) : null}
                  <ChevronRight className="size-4 text-ink-subtle" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
