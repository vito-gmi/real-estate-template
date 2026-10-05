'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { siteConfig } from '@/config/site';
import type { Locale } from '@/i18n/routing';
import type { Currency } from '@/lib/domain/enums';
import { formatPrice } from '@/lib/format';
import { clamp } from '@/lib/utils';

/**
 * Monthly-payment estimator.
 *
 * Entirely client-side arithmetic — no request, no cost, and it keeps working
 * on a cached page. Buyers reliably reach for this before they reach for the
 * contact form, which makes it one of the cheapest conversion levers available.
 */
export function MortgageCalculator({ price, currency }: { price: number; currency: Currency }) {
  const t = useTranslations('mortgage');
  const locale = useLocale() as Locale;

  const [downPaymentPercent, setDownPaymentPercent] = useState<number>(
    siteConfig.mortgage.defaultDownPaymentPercent,
  );
  const [rate, setRate] = useState<number>(siteConfig.mortgage.defaultInterestRate);
  const [years, setYears] = useState<number>(siteConfig.mortgage.defaultTermYears);

  const result = useMemo(() => {
    const principal = price * (1 - clamp(downPaymentPercent, 0, 95) / 100);
    const months = clamp(years, 1, siteConfig.mortgage.maxTermYears) * 12;
    const monthlyRate = clamp(rate, 0, 30) / 100 / 12;

    // Standard annuity formula, with the zero-interest case handled separately
    // because it would otherwise divide by zero.
    const monthly =
      monthlyRate === 0
        ? principal / months
        : (principal * monthlyRate) / (1 - (1 + monthlyRate) ** -months);

    const totalPaid = monthly * months;

    return {
      principal,
      monthly: Number.isFinite(monthly) ? monthly : 0,
      totalPaid: Number.isFinite(totalPaid) ? totalPaid : 0,
      totalInterest: Number.isFinite(totalPaid) ? totalPaid - principal : 0,
    };
  }, [price, downPaymentPercent, rate, years]);

  return (
    <section className="rounded-card border border-line bg-surface p-5">
      <h2 className="text-base font-semibold text-ink">{t('title')}</h2>
      <p className="mt-1 text-xs text-ink-muted">{t('subtitle')}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <NumberField
          id="mortgage-down"
          label={`${t('downPayment')} (%)`}
          value={downPaymentPercent}
          min={0}
          max={95}
          step={1}
          onChange={setDownPaymentPercent}
        />
        <NumberField
          id="mortgage-rate"
          label={`${t('interestRate')} (%)`}
          value={rate}
          min={0}
          max={30}
          step={0.1}
          onChange={setRate}
        />
        <NumberField
          id="mortgage-years"
          label={t('termYears')}
          value={years}
          min={1}
          max={siteConfig.mortgage.maxTermYears}
          step={1}
          onChange={setYears}
        />
      </div>

      <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
        <Row label={t('loanAmount')} value={formatPrice(locale, result.principal, currency)} />
        <Row
          label={t('monthlyPayment')}
          value={formatPrice(locale, result.monthly, currency)}
          emphasised
        />
        <Row label={t('totalInterest')} value={formatPrice(locale, result.totalInterest, currency)} />
        <Row label={t('totalPaid')} value={formatPrice(locale, result.totalPaid, currency)} />
      </dl>

      <p className="mt-4 text-xs leading-relaxed text-ink-subtle">{t('disclaimer')}</p>
    </section>
  );
}

function NumberField({
  id,
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-ink-muted">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          if (Number.isFinite(parsed)) onChange(parsed);
        }}
      />
    </div>
  );
}

function Row({
  label,
  value,
  emphasised = false,
}: {
  label: string;
  value: string;
  emphasised?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={emphasised ? 'text-lg font-semibold text-ink' : 'font-medium text-ink'}>
        {value}
      </dd>
    </div>
  );
}
