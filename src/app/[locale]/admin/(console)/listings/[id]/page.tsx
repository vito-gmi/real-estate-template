import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink, KeyRound, Mail, Phone } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { ListingForm } from '@/features/admin/components/listing-form';
import { ListingStatusActions } from '@/features/admin/components/listing-status-actions';
import { MediaManager } from '@/features/admin/components/media-manager';
import { PreviewLinkButton } from '@/features/admin/components/preview-link-button';
import { listingToForm } from '@/features/admin/default-listing';
import type { Locale } from '@/i18n/routing';
import { formatDate } from '@/lib/format';
import { adminPath, listingPath } from '@/lib/routes';
import { requireStaff } from '@/server/auth/session';
import { getAdminListing } from '@/server/repositories/admin-listings';
import { listAuditForEntity } from '@/server/repositories/audit';
import { listFilterableFeatures } from '@/server/repositories/features';
import { getLocationTree } from '@/server/repositories/locations';
import { getSubmissionByListingId } from '@/server/repositories/submissions';

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  const user = await requireStaff(locale, { minimumRole: 'editor' });

  const detail = await getAdminListing(id);
  if (!detail) notFound();

  const [locations, features, history, t, tEnum, source] = await Promise.all([
    getLocationTree(locale),
    listFilterableFeatures(locale),
    listAuditForEntity('listing', id, 12),
    getTranslations('admin'),
    getTranslations('enums'),
    getSubmissionByListingId(id),
  ]);

  const slug = detail.translations[locale]?.slug;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-sm text-ink-subtle">#{detail.listing.reference}</span>
        <Badge tone={detail.listing.status === 'active' ? 'success' : 'neutral'}>
          {tEnum(`status.${detail.listing.status}`)}
        </Badge>
        {slug && detail.listing.status !== 'draft' ? (
          <Link
            href={listingPath(locale, slug)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-brand hover:underline"
          >
            <ExternalLink className="size-4" />
            {t('preview')}
          </Link>
        ) : null}
        <PreviewLinkButton listingId={id} locale={locale} />
        <div className="ml-auto">
          <ListingStatusActions
            listingId={id}
            status={detail.listing.status}
            dealType={detail.listing.dealType}
            canDelete={user.role === 'admin'}
            listingsPath={adminPath(locale, 'listings')}
          />
        </div>
      </div>

      {source ? (
        // Where this listing came from, and how to reach the owner.
        <aside className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-card border border-line bg-brand-soft px-5 py-3 text-sm">
          <Link
            href={adminPath(locale, `submissions/${source.id}`)}
            className="inline-flex items-center gap-1.5 font-medium text-brand hover:underline"
          >
            <KeyRound className="size-4" />
            {t('submissions.fromSubmission', { reference: source.reference })}
          </Link>
          <span className="text-ink">
            {source.firstName} {source.lastName}
          </span>
          {source.phone ? (
            <a href={`tel:${source.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1.5 text-ink-muted hover:text-brand">
              <Phone className="size-4" />
              {source.phone}
            </a>
          ) : null}
          {source.email ? (
            <a href={`mailto:${source.email}`} className="inline-flex items-center gap-1.5 text-ink-muted hover:text-brand">
              <Mail className="size-4" />
              {source.email}
            </a>
          ) : null}
        </aside>
      ) : null}

      <ListingForm
        listingId={id}
        defaultValues={listingToForm(detail)}
        locations={locations}
        features={features}
        adminBasePath={adminPath(locale, 'listings')}
      />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-ink">{t('sections.media')}</h2>
        <MediaManager
          listingId={id}
          initialPhotos={detail.photos
            .filter((photo) => photo.kind === 'photo')
            .map((photo) => ({
              id: photo.id,
              width: photo.width,
              height: photo.height,
              blurDataUrl: photo.blurDataUrl,
              variants: photo.variants,
            }))}
        />
      </section>

      {history.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">{t('audit.title')}</h2>
          <ul className="divide-y divide-line rounded-card border border-line bg-surface text-sm">
            {history.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center gap-3 p-3">
                <span className="font-medium text-ink">{entry.action}</span>
                <span className="text-ink-muted">{entry.actorEmail}</span>
                <span className="ml-auto text-xs text-ink-subtle">
                  {formatDate(locale, entry.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
