'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Locale } from '@/i18n/routing';
import { sortOptions, type SortOption } from '@/lib/domain/enums';
import type { SearchFilters } from '../types';
import { buildSearchUrl, type SearchScope } from '../url';

const LABEL_KEYS: Record<SortOption, string> = {
  newest: 'sortNewest',
  price_asc: 'sortPriceAsc',
  price_desc: 'sortPriceDesc',
  area_desc: 'sortAreaDesc',
  price_per_sqm_asc: 'sortPricePerSqmAsc',
};

export function SortSelect({ scope, filters }: { scope: SearchScope; filters: SearchFilters }) {
  const t = useTranslations('search');
  const locale = useLocale() as Locale;
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="sort" className="hidden shrink-0 text-sm text-ink-muted sm:block">
        {t('sort')}
      </Label>
      <Select
        value={filters.sort}
        onValueChange={(value) =>
          // Changing the order invalidates any cursor, so it is dropped here.
          router.push(buildSearchUrl(locale, scope, { ...filters, sort: value as SortOption }), {
            scroll: false,
          })
        }
      >
        <SelectTrigger id="sort" className="h-10 w-52">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map((option) => (
            <SelectItem key={option} value={option}>
              {t(LABEL_KEYS[option])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
