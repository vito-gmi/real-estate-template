import { defineRouting } from 'next-intl/routing';

export const locales = ['bg', 'en'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'bg';

export const routing = defineRouting({
  locales,
  defaultLocale,
  // Always prefix so every page has one canonical URL per language, which keeps
  // hreflang unambiguous and avoids duplicate-content penalties.
  localePrefix: 'always',
  localeDetection: true,
});

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/** BCP-47 tags used in `hreflang`, `og:locale` and `Intl` formatters. */
export const localeTags: Record<Locale, string> = {
  bg: 'bg-BG',
  en: 'en-GB',
};
