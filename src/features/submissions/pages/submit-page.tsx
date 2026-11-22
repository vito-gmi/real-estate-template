import { Camera, ClipboardCheck, PhoneCall } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { siteConfig } from '@/config/site';
import { getLocationTree, listFilterableFeatures } from '@/features/listings/queries';
import { guardSegmentLocale, PageHeader } from '@/features/pages/simple-page';
import type { Locale } from '@/i18n/routing';
import { MAX_SUBMISSION_PHOTOS } from '@/lib/domain/media';
import { staticPath } from '@/lib/routes';
import { deferIfBuildingWithoutDatabase } from '@/server/prerender';
import { getPublicSubmissionAvailability } from '../availability';
import { SubmissionForm } from '../components/submission-form';

/**
 * "List your property" — owners send a property for the agency to review.
 *
 * The page itself is static and cached like the rest of the public site; the
 * form is a client component and every write goes through server actions.
 * When submissions are switched off in Settings (or no private bucket is
 * configured) the page stays up and points visitors to the phone instead.
 */
export async function SubmitPropertyPage({
  params,
  segmentLocale,
}: {
  params: Promise<{ locale: Locale }>;
  segmentLocale: Locale;
}) {
  const locale = await guardSegmentLocale('submit', segmentLocale, params);
  await deferIfBuildingWithoutDatabase();
  const [t, availability] = await Promise.all([
    getTranslations('submit'),
    getPublicSubmissionAvailability(),
  ]);

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <ol className="grid gap-4 md:grid-cols-3">
          <Step icon={ClipboardCheck} title={t('how.step1Title')} text={t('how.step1Text')} index={1} />
          <Step icon={Camera} title={t('how.step2Title')} text={t('how.step2Text')} index={2} />
          <Step icon={PhoneCall} title={t('how.step3Title')} text={t('how.step3Text')} index={3} />
        </ol>

        <div className="mt-10">
          {availability.open ? (
            <OpenForm locale={locale} availability={availability} />
          ) : (
            <div className="mx-auto max-w-2xl rounded-card border border-line bg-surface p-8 text-center">
              <h2 className="text-lg font-semibold text-ink">{t('closedTitle')}</h2>
              <p className="mt-2 text-ink-muted">{t('closedText')}</p>
              <a
                href={siteConfig.contact.phoneHref}
                className="mt-5 inline-flex items-center gap-2 rounded-control bg-brand px-4 py-3 font-medium text-ink-inverse hover:bg-brand-hover"
              >
                <PhoneCall className="size-4" aria-hidden="true" />
                {siteConfig.contact.phone}
              </a>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

async function OpenForm({
  locale,
  availability,
}: {
  locale: Locale;
  availability: Awaited<ReturnType<typeof getPublicSubmissionAvailability>>;
}) {
  const [tree, features] = await Promise.all([getLocationTree(locale), listFilterableFeatures(locale)]);

  return (
    <SubmissionForm
      cities={tree
        .filter((node) => node.level === 'city')
        .map((node) => ({ id: node.id, name: node.name }))}
      districts={tree
        .filter((node) => node.level === 'district' && node.parentId)
        .map((node) => ({ id: node.id, name: node.name, cityId: node.parentId! }))}
      features={features.map((feature) => ({ key: feature.key, name: feature.name }))}
      minPhotos={availability.settings.minPhotos}
      maxPhotos={MAX_SUBMISSION_PHOTOS}
      turnstileSiteKey={availability.turnstileSiteKey}
      privacyHref={staticPath('privacy', locale)}
    />
  );
}

function Step({
  icon: Icon,
  title,
  text,
  index,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
  index: number;
}) {
  return (
    <li className="flex gap-4 rounded-card border border-line bg-surface p-5">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div>
        <h2 className="font-semibold text-ink">
          <span className="sr-only">{index}. </span>
          {title}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">{text}</p>
      </div>
    </li>
  );
}
