import { legalDocuments } from '@/content/legal';
import type { Locale } from '@/i18n/routing';
import { formatDate } from '@/lib/format';
import { guardSegmentLocale, PageHeader } from './simple-page';

export async function LegalPage({
  params,
  segmentLocale,
  document: documentKey,
}: {
  params: Promise<{ locale: Locale }>;
  segmentLocale: Locale;
  document: 'privacy' | 'terms';
}) {
  const locale = await guardSegmentLocale(documentKey, segmentLocale, params);
  const doc = legalDocuments[documentKey][locale];

  return (
    <>
      <PageHeader title={doc.title} />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-sm text-ink-subtle">
          {formatDate(locale, new Date(doc.updated))}
        </p>
        <div className="mt-8 space-y-10">
          {doc.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-lg font-semibold text-ink">{section.heading}</h2>
              <div className="mt-3 space-y-3 leading-relaxed text-ink-muted">
                {section.paragraphs.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
