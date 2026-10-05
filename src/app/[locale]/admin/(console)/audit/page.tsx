import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { requireStaff } from '@/server/auth/session';
import { listAuditEntries } from '@/server/repositories/audit';
import { formatDate } from '@/lib/format';
import { adminPath } from '@/lib/routes';
import Link from 'next/link';

const PAGE_SIZE = 50;

export default async function AdminAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await params;
  await requireStaff(locale);
  const { page: rawPage } = await searchParams;
  const page = Math.max(1, Number(rawPage ?? 1) || 1);

  const [t, result] = await Promise.all([
    getTranslations('admin'),
    listAuditEntries(PAGE_SIZE, (page - 1) * PAGE_SIZE),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">{t('audit.title')}</h1>

      {result.rows.length === 0 ? (
        <p className="rounded-card border border-dashed border-line-strong bg-surface p-10 text-center text-ink-muted">
          {t('audit.empty')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full min-w-3xl text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-subtle">
              <tr>
                <th scope="col" className="p-3 font-medium">
                  {t('audit.when')}
                </th>
                <th scope="col" className="p-3 font-medium">
                  {t('audit.actor')}
                </th>
                <th scope="col" className="p-3 font-medium">
                  {t('audit.action')}
                </th>
                <th scope="col" className="p-3 font-medium">
                  {t('audit.entity')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {result.rows.map((entry) => (
                <tr key={entry.id}>
                  <td className="p-3 whitespace-nowrap text-xs text-ink-subtle">
                    {formatDate(locale, entry.createdAt)}
                  </td>
                  <td className="p-3 text-ink">{entry.actorEmail}</td>
                  <td className="p-3 font-mono text-xs text-ink">{entry.action}</td>
                  <td className="p-3 text-ink-muted">
                    {entry.entityType}
                    {entry.entityId ? (
                      <>
                        {' '}
                        {entry.entityType === 'listing' ? (
                          <Link
                            href={adminPath(locale, `listings/${entry.entityId}`)}
                            className="text-brand hover:underline"
                          >
                            {entry.entityId.slice(0, 8)}
                          </Link>
                        ) : (
                          <span className="font-mono text-xs">{entry.entityId.slice(0, 8)}</span>
                        )}
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? (
        <nav className="flex justify-between text-sm text-ink-muted">
          {page > 1 ? (
            <Link href={`?page=${page - 1}`} className="text-brand hover:underline">
              ←
            </Link>
          ) : (
            <span />
          )}
          <span>
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={`?page=${page + 1}`} className="text-brand hover:underline">
              →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
