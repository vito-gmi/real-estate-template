'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/auth-client';

/**
 * Two-factor enrolment.
 *
 * Reached by the redirect in `requireStaff`, so an account without a second
 * factor cannot reach any other admin page. The QR code is rendered locally from
 * the returned `otpauth://` URI — the secret is never sent to a third-party
 * chart service, which is a surprisingly common way to leak one.
 */
export function TwoFactorSetup({ redirectTo }: { redirectTo: string }) {
  const t = useTranslations('admin');
  const tErrors = useTranslations('errors');
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secretUri, setSecretUri] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function startEnrolment(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const { data, error: enrolError } = await authClient.twoFactor.enable({ password });

    if (enrolError || !data || !('totpURI' in data) || !data.totpURI) {
      setError(t('invalidCredentials'));
      setPending(false);
      return;
    }

    setSecretUri(data.totpURI);
    setBackupCodes(data.backupCodes ?? []);
    setQrDataUrl(
      await QRCode.toDataURL(data.totpURI, { margin: 1, width: 220, errorCorrectionLevel: 'M' }),
    );
    setPending(false);
  }

  async function confirmCode(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const { error: verifyError } = await authClient.twoFactor.verifyTotp({ code });

    if (verifyError) {
      setError(t('invalidCredentials'));
      setPending(false);
      return;
    }

    router.replace(redirectTo);
    router.refresh();
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-brand-soft text-brand">
          <ShieldCheck className="size-6" />
        </div>
        <h1 className="text-xl font-semibold text-ink">{t('twoFactorSetupTitle')}</h1>
        <p className="mt-1 text-sm text-ink-muted">{t('twoFactorRequired')}</p>
      </div>

      {error ? (
        <p role="alert" className="mb-4 rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {!secretUri ? (
        <form onSubmit={startEnrolment} className="space-y-4">
          <Field label={t('password')} htmlFor="confirm-password" required>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </Field>
          <Button type="submit" full disabled={pending}>
            {t('twoFactorSetupTitle')}
          </Button>
        </form>
      ) : (
        <div className="space-y-6">
          <p className="text-sm text-ink-muted">{t('twoFactorSetupText')}</p>

          {qrDataUrl ? (
            <div className="flex justify-center">
              <img
                src={qrDataUrl}
                alt=""
                width={220}
                height={220}
                className="rounded-card border border-line bg-white p-2"
              />
            </div>
          ) : null}

          <details className="rounded-control border border-line bg-surface-muted p-3">
            <summary className="cursor-pointer text-xs font-medium text-ink-muted">
              {t('twoFactorCode')}
            </summary>
            <code className="mt-2 block break-all font-mono text-xs text-ink-muted">{secretUri}</code>
          </details>

          {backupCodes.length > 0 ? (
            <div className="rounded-card border border-warning/40 bg-warning-soft p-4">
              <h2 className="text-sm font-semibold text-ink">{t('backupCodes')}</h2>
              <p className="mt-1 text-xs text-ink-muted">{t('backupCodesText')}</p>
              <ul className="mt-3 grid grid-cols-2 gap-1.5 font-mono text-xs text-ink">
                {backupCodes.map((backupCode) => (
                  <li key={backupCode}>{backupCode}</li>
                ))}
              </ul>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-3"
                onClick={() => void navigator.clipboard.writeText(backupCodes.join('\n'))}
              >
                <Copy />
                {t('backupCodes')}
              </Button>
            </div>
          ) : null}

          <form onSubmit={confirmCode} className="space-y-4">
            <Field label={t('twoFactorCode')} htmlFor="totp" required hint={t('twoFactorHint')}>
              <Input
                id="totp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className="text-center text-lg tracking-[0.4em]"
                required
              />
            </Field>
            <Button type="submit" full disabled={pending}>
              {pending ? tErrors('tryAgain') : t('signIn')}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
