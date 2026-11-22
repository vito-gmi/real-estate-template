import { EyeOff } from 'lucide-react';
import type { Locale } from '@/i18n/routing';
import type { Currency } from '@/lib/domain/enums';
import { formatPrice } from '@/lib/format';

/**
 * A listing's price as staff see it: the stored amount even when visitors see
 * "price on request", marked so nobody mistakes it for the public price.
 * Hook-free so the server-rendered dashboard and the client table can share it.
 */
export function AdminPrice({
  locale,
  price,
  currency,
  showPrice,
  hiddenLabel,
}: {
  locale: Locale;
  price: number | null;
  currency: Currency;
  showPrice: boolean;
  hiddenLabel: string;
}) {
  if (showPrice && price !== null) return <>{formatPrice(locale, price, currency)}</>;

  return (
    <span className="inline-flex items-center gap-1.5 text-ink-subtle" title={hiddenLabel}>
      <EyeOff className="size-3.5 shrink-0" aria-hidden="true" />
      {price !== null ? formatPrice(locale, price, currency) : '—'}
      <span className="sr-only">({hiddenLabel})</span>
    </span>
  );
}
