import { CheckCircle2, CircleAlert } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { siteConfig } from '@/config/site';
import { serverEnv } from '@/env';
import { SubmissionSettingsForm } from '@/features/settings/components/submission-settings-form';
import type { Locale } from '@/i18n/routing';
import { staticPath } from '@/lib/routes';
import { isPrivateStorageConfigured } from '@/server/adapters/storage';
import { requireStaff } from '@/server/auth/session';
import { getSubmissionSettings } from '@/server/repositories/settings';
import { isTurnstileEnabled } from '@/server/turnstile';

/**
 * Runtime switches staff can flip without a redeploy, plus a read-only view of
 * the environment those switches depend on, so "why is the form closed?" can
 * be answered here rather than in the server log.
 */
export default async function AdminSettingsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  await requireStaff(locale, { minimumRole: 'admin' });

  const [t, settings] = await Promise.all([getTranslations('admin.settingsPage'), getSubmissionSettings()]);

  const checks = [
    {
      ok: isPrivateStorageConfigured(),
      label: t('checks.storage'),
      hint: t('checks.storageHint'),
      required: true,
    },
    { ok: isTurnstileEnabled(), label: t('checks.turnstile'), hint: t('checks.turnstileHint') },
    { ok: Boolean(serverEnv.CRON_SECRET), label: t('checks.cleanup'), hint: t('checks.cleanupHint') },
    {
      ok: serverEnv.MAIL_DRIVER !== 'console',
      label: t('checks.mail', { inbox: serverEnv.MAIL_TO ?? siteConfig.contact.email }),
      hint: t('checks.mailHint'),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{t('title')}</h1>
        <p className="mt-1 text-sm text-ink-muted">{t('subtitle')}</p>
      </div>

      <section className="rounded-card border border-line bg-surface p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-ink">{t('submissionsTitle')}</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {t('submissionsText')}{' '}
          <a href={staticPath('submit', locale)} target="_blank" rel="noreferrer" className="text-brand hover:underline">
            {t('openForm')}
          </a>
        </p>
        <div className="mt-6">
          <SubmissionSettingsForm initial={settings} storageReady={isPrivateStorageConfigured()} />
        </div>
      </section>

      <section className="rounded-card border border-line bg-surface p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-ink">{t('checksTitle')}</h2>
        <p className="mt-1 text-sm text-ink-muted">{t('checksText')}</p>
        <ul className="mt-4 divide-y divide-line">
          {checks.map((check) => (
            <li key={check.label} className="flex items-start gap-3 py-3">
              {check.ok ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-label={t('checks.ok')} />
              ) : (
                <CircleAlert
                  className={`mt-0.5 size-5 shrink-0 ${check.required ? 'text-danger' : 'text-warning'}`}
                  aria-label={t('checks.missing')}
                />
              )}
              <div>
                <p className="text-sm font-medium text-ink">{check.label}</p>
                {!check.ok ? <p className="mt-0.5 text-sm text-ink-muted">{check.hint}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
