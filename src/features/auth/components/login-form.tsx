'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, LogIn, ShieldCheck } from 'lucide-react';
import { useAction } from 'next-safe-action/hooks';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { signIn, verifyTwoFactor } from '../actions';

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

const codeSchema = z.object({ code: z.string().trim().min(6) });

type Step = 'credentials' | 'two-factor';

/**
 * Two-step sign-in.
 *
 * Both steps report the same generic failure, so the form cannot be used to
 * discover which email addresses have accounts. On success the browser is sent
 * to the destination with a full navigation rather than a client transition, so
 * the freshly issued session cookie is present for the server render.
 */
export function LoginForm({ next }: { next: string }) {
  const t = useTranslations('admin');
  const tErrors = useTranslations('errors');
  const router = useRouter();

  const [step, setStep] = useState<Step>('credentials');
  const [error, setError] = useState<string | null>(null);

  const credentialsForm = useForm<z.infer<typeof credentialsSchema>>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { email: '', password: '' },
  });

  const codeForm = useForm<z.infer<typeof codeSchema>>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: '' },
  });

  const translate = (key: string) =>
    key.startsWith('errors.') ? tErrors(key.slice(7)) : t(key.replace(/^admin\./, ''));

  const signInAction = useAction(signIn, {
    onSuccess: ({ data }) => {
      if (!data) return;
      if (!data.ok) {
        setError(translate(data.error.messageKey));
        return;
      }
      setError(null);
      if (data.data.needsTwoFactor) {
        setStep('two-factor');
      } else {
        router.replace(next);
        router.refresh();
      }
    },
    onError: () => setError(tErrors('unexpected')),
  });

  const verifyAction = useAction(verifyTwoFactor, {
    onSuccess: ({ data }) => {
      if (!data) return;
      if (!data.ok) {
        setError(translate(data.error.messageKey));
        return;
      }
      router.replace(next);
      router.refresh();
    },
    onError: () => setError(tErrors('unexpected')),
  });

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-brand-soft text-brand">
          {step === 'credentials' ? <KeyRound className="size-6" /> : <ShieldCheck className="size-6" />}
        </div>
        <h1 className="text-xl font-semibold text-ink">
          {step === 'credentials' ? t('signInTitle') : t('twoFactorTitle')}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {step === 'credentials' ? t('signInSubtitle') : t('twoFactorHint')}
        </p>
      </div>

      {error ? (
        <p role="alert" className="mb-4 rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {step === 'credentials' ? (
        <form
          onSubmit={credentialsForm.handleSubmit((values) => signInAction.execute(values))}
          className="space-y-4"
          noValidate
        >
          <Field label={t('email')} htmlFor="email" required>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              autoFocus
              {...credentialsForm.register('email')}
            />
          </Field>

          <Field label={t('password')} htmlFor="password" required>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...credentialsForm.register('password')}
            />
          </Field>

          <Button type="submit" full disabled={signInAction.isPending}>
            <LogIn />
            {t('signIn')}
          </Button>
        </form>
      ) : (
        <form
          onSubmit={codeForm.handleSubmit((values) => verifyAction.execute({ ...values, trustDevice: false }))}
          className="space-y-4"
          noValidate
        >
          <Field label={t('twoFactorCode')} htmlFor="code" required hint={t('backupCodesText')}>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={40}
              className="text-center text-lg tracking-[0.4em]"
              {...codeForm.register('code')}
            />
          </Field>

          <Button type="submit" full disabled={verifyAction.isPending}>
            <ShieldCheck />
            {t('signIn')}
          </Button>
        </form>
      )}
    </div>
  );
}
