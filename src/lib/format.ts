import { siteConfig } from '@/config/site';
import { localeTags, type Locale } from '@/i18n/routing';
import type { Currency } from './domain/enums';

/**
 * Formatters are memoised because constructing `Intl.NumberFormat` is roughly
 * two orders of magnitude more expensive than using one, and listing grids call
 * these once per card per field.
 */
const numberFormatters = new Map<string, Intl.NumberFormat>();

function formatter(key: string, build: () => Intl.NumberFormat): Intl.NumberFormat {
  let cached = numberFormatters.get(key);
  if (!cached) {
    cached = build();
    numberFormatters.set(key, cached);
  }
  return cached;
}

export function formatPrice(
  locale: Locale,
  amount: number,
  currency: Currency = siteConfig.currency.primary as Currency,
): string {
  return formatter(`price:${locale}:${currency}`, () =>
    new Intl.NumberFormat(localeTags[locale], {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }),
  ).format(amount);
}

export function formatNumber(locale: Locale, value: number, fractionDigits = 0): string {
  return formatter(`number:${locale}:${fractionDigits}`, () =>
    new Intl.NumberFormat(localeTags[locale], {
      maximumFractionDigits: fractionDigits,
      minimumFractionDigits: 0,
    }),
  ).format(value);
}

export function formatArea(locale: Locale, squareMetres: number): string {
  return `${formatNumber(locale, squareMetres)} m²`;
}

export function formatPricePerSqm(locale: Locale, value: number, currency: Currency = 'EUR'): string {
  return `${formatPrice(locale, value, currency)}/m²`;
}

export function formatDate(locale: Locale, date: Date): string {
  return new Intl.DateTimeFormat(localeTags[locale], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatRelativeDays(locale: Locale, date: Date, now = new Date()): string {
  const days = Math.round((date.getTime() - now.getTime()) / 86_400_000);
  return new Intl.RelativeTimeFormat(localeTags[locale], { numeric: 'auto' }).format(days, 'day');
}

/** Converts any supported currency to EUR using the fixed BGN peg. */
export function toEur(amount: number, currency: Currency): number {
  return currency === 'EUR' ? amount : amount / siteConfig.currency.bgnPerEur;
}
