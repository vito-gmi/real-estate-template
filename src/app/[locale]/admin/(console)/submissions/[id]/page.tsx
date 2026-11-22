import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink, Mail, Phone } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { SubmissionReview } from '@/features/submissions/components/submission-review';
import { submissionTone } from '@/features/submissions/status-tone';
import type { Locale } from '@/i18n/routing';
import { formatDate, formatNumber, formatPrice } from '@/lib/format';
import { adminPath } from '@/lib/routes';
import { hasRole, requireStaff } from '@/server/auth/session';
import { listAuditForEntity } from '@/server/repositories/audit';
import { listAllFeatures } from '@/server/repositories/features';
import { getLocationTree } from '@/server/repositories/locations';
import { getSubmissionSettings } from '@/server/repositories/settings';
import {
  getListingSummary,
  getSubmission,
  getSubmissionPlace,
  listSubmissionPhotos,
} from '@/server/repositories/submissions';

export default async function SubmissionReviewPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  const user = await requireStaff(locale);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const submission = await getSubmission(id);
  if (!submission || submission.status === 'incomplete') notFound();

  const [t, tEnum, tField, photos, place, tree, features, settings, history, listing] =
    await Promise.all([
      getTranslations('admin.submissions'),
      getTranslations('enums'),
      getTranslations('listing'),
      listSubmissionPhotos(id),
      submission.locationId ? getSubmissionPlace(submission.locationId) : null,
      getLocationTree(locale),
      listAllFeatures(locale),
      getSubmissionSettings(),
      listAuditForEntity('submission', id, 20),
      submission.listingId ? getListingSummary(submission.listingId, locale) : null,
    ]);

  // Listings are filed under a district; cities without districts are offered too.
  const cities = tree.filter((node) => node.level === 'city');
  const districts = tree.filter((node) => node.level === 'district');
  const locationOptions = cities.flatMap((city) => {
    const children = districts.filter((district) => district.parentId === city.id);
    return children.length > 0
      ? children.map((district) => ({ value: district.id, label: `${city.name} — ${district.name}` }))
      : [{ value: city.id, label: city.name }];
  });
  const defaultLocationId =
    submission.locationId && locationOptions.some((option) => option.value === submission.locationId)
      ? submission.locationId
      : null;

  const placeName = place
    ? locale === 'bg'
      ? [place.nameBg, place.parentNameBg].filter(Boolean).join(', ')
      : [place.nameEn, place.parentNameEn].filter(Boolean).join(', ')
    : null;
  const featureNames = new Map(features.map((feature) => [feature.key, feature.name]));

  const specs: { label: string; value: string | null }[] = [
    { label: t('fields.deal'), value: submission.dealType ? tEnum(`dealType.${submission.dealType}`) : null },
    {
      label: t('fields.kind'),
      value: submission.propertyKind ? tEnum(`propertyKind.${submission.propertyKind}`) : null,
    },
    { label: t('fields.location'), value: placeName },
    { label: t('fields.locationText'), value: submission.locationText },
    { label: t('fields.address'), value: submission.address },
    {
      label: t('fields.askingPrice'),
      value: submission.price ? formatPrice(locale, submission.price, submission.currency) : null,
    },
    { label: tField('totalArea'), value: submission.area ? `${formatNumber(locale, submission.area)} m²` : null },
    {
      label: tField('landArea'),
      value: submission.landArea ? `${formatNumber(locale, submission.landArea)} m²` : null,
    },
    { label: tField('rooms'), value: submission.rooms?.toString() ?? null },
    { label: tField('bedrooms'), value: submission.bedrooms?.toString() ?? null },
    { label: tField('bathrooms'), value: submission.bathrooms?.toString() ?? null },
    {
      label: tField('floor'),
      value:
        submission.floor !== null
          ? submission.floorsTotal
            ? tField('floorOf', { floor: submission.floor, total: submission.floorsTotal })
            : submission.floor.toString()
          : submission.floorsTotal
            ? `— / ${submission.floorsTotal}`
            : null,
    },
    { label: tField('yearBuilt'), value: submission.yearBuilt?.toString() ?? null },
    {
      label: tField('construction'),
      value: submission.constructionType ? tEnum(`construction.${submission.constructionType}`) : null,
    },
    { label: tField('heating'), value: submission.heating ? tEnum(`heating.${submission.heating}`) : null },
    {
      label: tField('furnishing'),
      value: submission.furnishing ? tEnum(`furnishing.${submission.furnishing}`) : null,
    },
    {
      label: tField('condition'),
      value: submission.condition ? tEnum(`condition.${submission.condition}`) : null,
    },
    {
      label: tField('maintenanceFee'),
      value: submission.maintenanceFee
        ? formatPrice(locale, submission.maintenanceFee, submission.currency)
        : null,
    },
    { label: tField('deposit'), value: submission.depositMonths?.toString() ?? null },
    { label: tField('availableFrom'), value: submission.availableFrom },
  ];

  return (
    <div className="space-y-6">
      <Link
        href={adminPath(locale, 'submissions')}
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        {t('backToQueue')}
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {t('detailTitle', { reference: submission.reference })}
        </h1>
        <Badge tone={submissionTone[submission.status]}>
          {tEnum(`submissionStatus.${submission.status}`)}
        </Badge>
        {submission.submittedAt ? (
          <span className="text-sm text-ink-subtle">{formatDate(locale, submission.submittedAt)}</span>
        ) : null}
      </div>

      <SubmissionReview
        submission={{
          id: submission.id,
          reference: submission.reference,
          status: submission.status,
          internalNote: submission.internalNote ?? '',
          rejectionReason: submission.rejectionReason,
          locationText: submission.locationText,
        }}
        photos={photos.map((photo) => ({
          id: photo.id,
          width: photo.width,
          height: photo.height,
          imported: Boolean(photo.importedMediaId),
          purged: Boolean(photo.purgedAt),
        }))}
        locationOptions={locationOptions}
        defaultLocationId={defaultLocationId}
        notifyDefaults={{ approve: settings.notifyOnApprove, reject: settings.notifyOnReject }}
        canDelete={hasRole(user, 'admin')}
        canReview={hasRole(user, 'editor')}
        listing={
          submission.listingId && listing
            ? {
                href: adminPath(locale, `listings/${submission.listingId}`),
                label: `#${listing.reference} ${listing.title ?? ''}`.trim(),
              }
            : null
        }
        listingBasePath={adminPath(locale, 'listings')}
        queuePath={adminPath(locale, 'submissions')}
        taxonomyPath={adminPath(locale, 'taxonomy')}
        details={
          <>
            <section className="rounded-card border border-line bg-surface p-5">
              <h2 className="font-semibold text-ink">{t('sections.property')}</h2>
              <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                {specs
                  .filter((spec) => spec.value)
                  .map((spec) => (
                    <div key={spec.label} className="flex justify-between gap-4 border-b border-line pb-2">
                      <dt className="text-ink-muted">{spec.label}</dt>
                      <dd className="text-right font-medium text-ink">{spec.value}</dd>
                    </div>
                  ))}
              </dl>
              {submission.featureKeys.length > 0 ? (
                <div className="mt-4">
                  <h3 className="text-sm text-ink-muted">{tField('features')}</h3>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {submission.featureKeys.map((key) => (
                      <li key={key}>
                        <Badge tone="neutral">{featureNames.get(key) ?? key}</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>

            <section className="rounded-card border border-line bg-surface p-5">
              <h2 className="font-semibold text-ink">{t('sections.description')}</h2>
              <p className="mt-1 text-xs text-ink-subtle">
                {t('writtenIn', { language: submission.locale.toUpperCase() })}
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                {submission.description}
              </p>
              {submission.externalMediaUrl ? (
                <a
                  href={submission.externalMediaUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-4 inline-flex items-center gap-1.5 break-all text-sm text-brand hover:underline"
                >
                  <ExternalLink className="size-4 shrink-0" />
                  {t('externalMedia')}: {submission.externalMediaUrl}
                </a>
              ) : null}
            </section>
          </>
        }
        contact={
          <section className="rounded-card border border-line bg-surface p-5">
            <h2 className="font-semibold text-ink">{t('sections.contact')}</h2>
            <p className="mt-3 text-lg font-medium text-ink">
              {submission.firstName} {submission.lastName}
            </p>
            {submission.submitterRole ? (
              <p className="text-sm text-ink-muted">{t(`role.${submission.submitterRole}`)}</p>
            ) : null}
            <ul className="mt-4 space-y-2 text-sm">
              {submission.phone ? (
                <li>
                  <a
                    href={`tel:${submission.phone.replace(/\s/g, '')}`}
                    className="inline-flex items-center gap-2 text-brand hover:underline"
                  >
                    <Phone className="size-4" />
                    {submission.phone}
                  </a>
                </li>
              ) : null}
              {submission.email ? (
                <li>
                  <a
                    href={`mailto:${submission.email}?subject=${encodeURIComponent(t('mailSubject', { reference: submission.reference }))}`}
                    className="inline-flex items-center gap-2 break-all text-brand hover:underline"
                  >
                    <Mail className="size-4 shrink-0" />
                    {submission.email}
                  </a>
                </li>
              ) : null}
            </ul>
            {submission.contactTime ? (
              <p className="mt-3 text-sm text-ink-muted">
                {t('contactTime')}: <span className="text-ink">{submission.contactTime}</span>
              </p>
            ) : null}
          </section>
        }
        history={
          history.length > 0 ? (
            <section className="rounded-card border border-line bg-surface p-5">
              <h2 className="font-semibold text-ink">{t('sections.history')}</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {history.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap gap-x-2">
                    <span className="font-medium text-ink">{entry.action}</span>
                    <span className="text-ink-muted">{entry.actorEmail}</span>
                    <span className="ml-auto text-xs text-ink-subtle">{formatDate(locale, entry.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null
        }
      />
    </div>
  );
}
