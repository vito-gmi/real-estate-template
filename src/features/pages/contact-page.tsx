import { ArrowRight, Clock, KeyRound, Mail, MapPin, Phone } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { siteConfig } from '@/config/site';
import { InquiryForm } from '@/features/inquiries/components/inquiry-form';
import { getPublicSubmissionAvailability } from '@/features/submissions/availability';
import type { Locale } from '@/i18n/routing';
import { staticPath } from '@/lib/routes';
import { JsonLd, organizationJsonLd } from '@/lib/seo/json-ld';
import { guardSegmentLocale, PageHeader } from './simple-page';

export async function ContactPage({
  params,
  segmentLocale,
}: {
  params: Promise<{ locale: Locale }>;
  segmentLocale: Locale;
}) {
  const locale = await guardSegmentLocale('contact', segmentLocale, params);
  const [t, submissions] = await Promise.all([
    getTranslations('contact'),
    getPublicSubmissionAvailability(),
  ]);

  return (
    <>
      <JsonLd data={organizationJsonLd(locale)} />
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div>
          <h2 className="text-lg font-semibold text-ink">{t('offices')}</h2>
          <ul className="mt-6 space-y-8">
            {siteConfig.offices.map((office) => (
              <li key={office.id} className="rounded-card border border-line bg-surface p-5">
                <h3 className="font-semibold text-ink">{office.city[locale]}</h3>
                <dl className="mt-3 space-y-2 text-sm text-ink-muted">
                  <Row icon={MapPin} label={t('address')} value={office.address[locale]} />
                  <Row
                    icon={Phone}
                    label={t('phone')}
                    value={office.phone}
                    href={`tel:${office.phone.replace(/\s/g, '')}`}
                  />
                  <Row
                    icon={Mail}
                    label={t('email')}
                    value={office.email}
                    href={`mailto:${office.email}`}
                  />
                  <Row
                    icon={Clock}
                    label={t('workingHours')}
                    value={siteConfig.contact.workingHours[locale]}
                  />
                </dl>
              </li>
            ))}
          </ul>

          {submissions.open ? (
            <a
              href={staticPath('submit', locale)}
              className="mt-8 flex items-center gap-4 rounded-card border border-line bg-brand-soft p-5 transition-colors hover:border-brand"
            >
              <KeyRound className="size-6 shrink-0 text-brand" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink">{t('ownerTitle')}</span>
                <span className="mt-0.5 block text-sm text-ink-muted">{t('ownerText')}</span>
              </span>
              <ArrowRight className="size-5 shrink-0 text-brand" aria-hidden="true" />
            </a>
          ) : null}
        </div>

        <div className="rounded-card border border-line bg-surface p-6">
          <h2 className="text-lg font-semibold text-ink">{t('formTitle')}</h2>
          <div className="mt-5">
            <InquiryForm compact />
          </div>
        </div>
      </div>
    </>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-ink-subtle" aria-hidden="true" />
      <dt className="sr-only">{label}</dt>
      <dd>
        {href ? (
          <a href={href} className="hover:text-brand">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
