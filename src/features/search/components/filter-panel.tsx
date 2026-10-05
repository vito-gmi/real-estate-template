'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, SlidersHorizontal, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Locale } from '@/i18n/routing';
import {
  conditions,
  constructionTypes,
  furnishingTypes,
  heatingTypes,
  propertyKinds,
  type PropertyKind,
} from '@/lib/domain/enums';
import { cn } from '@/lib/utils';
import { countActiveFilters } from '../params';
import type { SearchFilters } from '../types';
import { buildSearchUrl, type SearchScope } from '../url';

export type FeatureChoice = { readonly key: string; readonly name: string; readonly category: string };

type PanelProps = {
  readonly scope: SearchScope;
  readonly filters: SearchFilters;
  readonly features: readonly FeatureChoice[];
};

/** Text and number inputs settle before navigating, so typing stays smooth. */
const DEBOUNCE_MS = 450;

/**
 * Filter panel.
 *
 * The URL is the state. Every control writes through to it, which means a
 * filtered view is always shareable, bookmarkable, restorable with the back
 * button, and cacheable on the CDN — none of which is true of filter state kept
 * in React. The local copy exists only so typing feels immediate.
 */
/** Always-visible rail on wide screens. */
export function FilterRail({ scope, filters, features }: PanelProps) {
  const t = useTranslations('search');

  return (
    <aside aria-label={t('filters')}>
      <div className="sticky top-24 max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-card border border-line bg-surface p-5">
        <FilterControls scope={scope} filters={filters} features={features} />
      </div>
    </aside>
  );
}

/** The same controls behind a trigger on narrow screens. */
export function FilterSheet({ scope, filters, features }: PanelProps) {
  const t = useTranslations('search');
  const tCommon = useTranslations('common');
  const activeCount = countActiveFilters(filters);
  const sheetId = `filters-${useId().replaceAll(':', '')}`;

  return (
    <div className="lg:hidden">
      <Button type="button" variant="outline" popoverTarget={sheetId}>
        <SlidersHorizontal />
        {t('filters')}
        {activeCount > 0 ? <Badge tone="brand">{activeCount}</Badge> : null}
      </Button>
      <div id={sheetId} popover="auto" className="mobile-nav-popover p-0">
        <div className="flex items-center justify-between border-b border-line p-5 pr-14">
          <p className="text-base font-semibold text-ink">{t('filters')}</p>
          <button
            type="button"
            className="absolute right-4 top-4 grid size-11 place-items-center rounded-full text-ink-muted touch-manipulation hover:bg-surface-muted"
            popoverTarget={sheetId}
            popoverTargetAction="hide"
            aria-label={tCommon('close')}
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <FilterControls scope={scope} filters={filters} features={features} />
        </div>
      </div>
    </div>
  );
}

function FilterControls({ scope, filters, features }: PanelProps) {
  const t = useTranslations('search');
  const tEnum = useTranslations('enums');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Draft mirrors the URL. Server-provided filters win whenever they change, so
  // the panel stays correct after a back-navigation or a chip removal.
  const [draft, setDraft] = useState(filters);
  useEffect(() => setDraft(filters), [filters]);

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const navigate = useCallback(
    (next: SearchFilters) => {
      startTransition(() => router.push(buildSearchUrl(locale, scope, next), { scroll: false }));
    },
    [locale, router, scope],
  );

  const commit = useCallback(
    (patch: Partial<SearchFilters>, debounce = false) => {
      const next = { ...draft, ...patch } as SearchFilters;
      setDraft(next);
      clearTimeout(timer.current);
      if (debounce) {
        timer.current = setTimeout(() => navigate(next), DEBOUNCE_MS);
      } else {
        navigate(next);
      }
    },
    [draft, navigate],
  );

  const toggleIn = useCallback(
    <T extends string>(list: readonly T[], value: T): T[] =>
      list.includes(value) ? list.filter((item) => item !== value) : [...list, value],
    [],
  );

  const featureGroups = useMemo(() => {
    const groups = new Map<string, FeatureChoice[]>();
    for (const feature of features) {
      const bucket = groups.get(feature.category) ?? [];
      bucket.push(feature);
      groups.set(feature.category, bucket);
    }
    return [...groups.values()].flat();
  }, [features]);

  const numberField = (
    id: string,
    label: string,
    value: number | undefined,
    key: keyof SearchFilters,
    placeholder?: string,
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-ink-muted">
        {label}
      </Label>
      <Input
        id={id}
        inputMode="numeric"
        placeholder={placeholder}
        value={value ?? ''}
        onChange={(event) => {
          const parsed = Number(event.target.value.replace(/\s/g, ''));
          commit(
            { [key]: event.target.value === '' || !Number.isFinite(parsed) ? undefined : parsed } as Partial<SearchFilters>,
            true,
          );
        }}
      />
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">{t('filters')}</p>
        <div className="flex items-center gap-2">
          {pending ? <Loader2 className="size-4 animate-spin text-ink-subtle" aria-hidden="true" /> : null}
          {countActiveFilters(draft) > 0 ? (
            <button
              type="button"
              onClick={() =>
                navigate({
                  dealType: draft.dealType,
                  location: draft.location,
                  kinds: [],
                  conditions: [],
                  constructionTypes: [],
                  heating: [],
                  furnishing: [],
                  featureKeys: [],
                  featuredOnly: false,
                  sort: draft.sort,
                })
              }
              className="text-xs font-medium text-brand hover:underline"
            >
              {t('activeFilters')}: {countActiveFilters(draft)} ✕
            </button>
          ) : null}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filter-q" className="text-xs text-ink-muted">
          {t('keyword')}
        </Label>
        <Input
          id="filter-q"
          type="search"
          placeholder={t('keywordPlaceholder')}
          value={draft.keyword ?? ''}
          onChange={(event) => commit({ keyword: event.target.value || undefined }, true)}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-xs font-medium text-ink-muted">{t('price')}</legend>
        <div className="grid grid-cols-2 gap-2">
          {numberField('filter-price-min', t('priceFrom'), draft.priceMin, 'priceMin', '0')}
          {numberField('filter-price-max', t('priceTo'), draft.priceMax, 'priceMax', '500 000')}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-xs font-medium text-ink-muted">{t('area')}</legend>
        <div className="grid grid-cols-2 gap-2">
          {numberField('filter-area-min', t('areaFrom'), draft.areaMin, 'areaMin', '40')}
          {numberField('filter-area-max', t('areaTo'), draft.areaMax, 'areaMax', '200')}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-xs font-medium text-ink-muted">{t('roomsMin')}</legend>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((count) => {
            const active = draft.roomsMin === count;
            return (
              <button
                key={count}
                type="button"
                aria-pressed={active}
                onClick={() => commit({ roomsMin: active ? undefined : count })}
                className={cn(
                  'h-9 min-w-11 rounded-control border px-3 text-sm font-medium transition-colors',
                  active
                    ? 'border-brand bg-brand text-ink-inverse'
                    : 'border-line-strong bg-surface text-ink-muted hover:border-ink-subtle',
                )}
              >
                {count}
                {count === 5 ? '+' : ''}
              </button>
            );
          })}
        </div>
      </fieldset>

      <Accordion type="multiple" defaultValue={['kinds']}>
        <AccordionItem value="kinds">
          <AccordionTrigger>{t('propertyKind')}</AccordionTrigger>
          <AccordionContent>
            <CheckboxList
              options={propertyKinds.map((kind) => ({
                value: kind,
                label: tEnum(`propertyKindPlural.${kind}`),
              }))}
              selected={draft.kinds}
              onToggle={(value) => commit({ kinds: toggleIn(draft.kinds, value as PropertyKind) })}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="condition">
          <AccordionTrigger>{t('condition')}</AccordionTrigger>
          <AccordionContent>
            <CheckboxList
              options={conditions.map((value) => ({ value, label: tEnum(`condition.${value}`) }))}
              selected={draft.conditions}
              onToggle={(value) =>
                commit({ conditions: toggleIn(draft.conditions, value as (typeof conditions)[number]) })
              }
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="construction">
          <AccordionTrigger>{t('construction')}</AccordionTrigger>
          <AccordionContent>
            <CheckboxList
              options={constructionTypes.map((value) => ({
                value,
                label: tEnum(`construction.${value}`),
              }))}
              selected={draft.constructionTypes}
              onToggle={(value) =>
                commit({
                  constructionTypes: toggleIn(
                    draft.constructionTypes,
                    value as (typeof constructionTypes)[number],
                  ),
                })
              }
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="heating">
          <AccordionTrigger>{t('heating')}</AccordionTrigger>
          <AccordionContent>
            <CheckboxList
              options={heatingTypes.map((value) => ({ value, label: tEnum(`heating.${value}`) }))}
              selected={draft.heating}
              onToggle={(value) =>
                commit({ heating: toggleIn(draft.heating, value as (typeof heatingTypes)[number]) })
              }
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="furnishing">
          <AccordionTrigger>{t('furnishing')}</AccordionTrigger>
          <AccordionContent>
            <CheckboxList
              options={furnishingTypes.map((value) => ({ value, label: tEnum(`furnishing.${value}`) }))}
              selected={draft.furnishing}
              onToggle={(value) =>
                commit({
                  furnishing: toggleIn(draft.furnishing, value as (typeof furnishingTypes)[number]),
                })
              }
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="features">
          <AccordionTrigger>{t('features')}</AccordionTrigger>
          <AccordionContent>
            <CheckboxList
              options={featureGroups.map((feature) => ({ value: feature.key, label: feature.name }))}
              selected={draft.featureKeys}
              onToggle={(value) => commit({ featureKeys: toggleIn(draft.featureKeys, value) })}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function CheckboxList({
  options,
  selected,
  onToggle,
}: {
  options: readonly { value: string; label: string }[];
  selected: readonly string[];
  onToggle: (value: string) => void;
}) {
  return (
    <ul className="space-y-2.5">
      {options.map((option) => {
        const id = `filter-${option.value}`;
        return (
          <li key={option.value} className="flex items-center gap-2.5">
            <Checkbox
              id={id}
              checked={selected.includes(option.value)}
              onCheckedChange={() => onToggle(option.value)}
            />
            <Label htmlFor={id} className="cursor-pointer text-sm font-normal text-ink-muted">
              {option.label}
            </Label>
          </li>
        );
      })}
    </ul>
  );
}

/** Removable summary of what is currently narrowing the results. */
export function ActiveFilterChips({
  scope,
  filters,
  labels,
}: {
  scope: SearchScope;
  filters: SearchFilters;
  labels: Readonly<Record<string, string>>;
}) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const t = useTranslations('search');

  const chips: { key: string; label: string; next: SearchFilters }[] = [];

  const push = (key: string, label: string, next: Partial<SearchFilters>) =>
    chips.push({ key, label, next: { ...filters, ...next } as SearchFilters });

  for (const kind of filters.kinds) push(`kind:${kind}`, labels[kind] ?? kind, {
    kinds: filters.kinds.filter((item) => item !== kind),
  });
  if (filters.priceMin) push('priceMin', `${t('priceFrom')} ${filters.priceMin}`, { priceMin: undefined });
  if (filters.priceMax) push('priceMax', `${t('priceTo')} ${filters.priceMax}`, { priceMax: undefined });
  if (filters.areaMin) push('areaMin', `${t('areaFrom')} ${filters.areaMin}`, { areaMin: undefined });
  if (filters.areaMax) push('areaMax', `${t('areaTo')} ${filters.areaMax}`, { areaMax: undefined });
  if (filters.roomsMin) push('roomsMin', `${filters.roomsMin}+ ${t('rooms')}`, { roomsMin: undefined });
  if (filters.keyword) push('q', `“${filters.keyword}”`, { keyword: undefined });
  for (const key of filters.featureKeys) {
    push(`feature:${key}`, labels[key] ?? key, {
      featureKeys: filters.featureKeys.filter((item) => item !== key),
    });
  }

  if (chips.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <li key={chip.key}>
          <button
            type="button"
            onClick={() => router.push(buildSearchUrl(locale, scope, chip.next), { scroll: false })}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-medium text-brand transition-colors hover:bg-brand hover:text-ink-inverse"
          >
            {chip.label}
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}
