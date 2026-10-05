import { clientEnv } from '@/env';

/**
 * The single place a fork edits to rebrand the site.
 *
 * Nothing agency-specific may be hardcoded in components — if a component needs
 * a phone number, an office address or a currency, it reads it from here.
 */

export type SocialLink = {
  readonly label: string;
  readonly href: string;
};

export type Office = {
  readonly id: string;
  readonly city: { readonly bg: string; readonly en: string };
  readonly address: { readonly bg: string; readonly en: string };
  readonly phone: string;
  readonly email: string;
  readonly lat: number;
  readonly lng: number;
};

export const siteConfig = {
  /** Brand name shown in the header, page titles and JSON-LD. */
  name: 'Estate',
  /** Longer legal/organisation name used in structured data. */
  legalName: 'Estate Real Estate Ltd.',
  domain: new URL(clientEnv.NEXT_PUBLIC_SITE_URL).host,
  url: clientEnv.NEXT_PUBLIC_SITE_URL,

  contact: {
    phone: '+359 2 000 0000',
    phoneHref: 'tel:+35920000000',
    email: 'office@example.bg',
    workingHours: { bg: 'Пон–Пет: 9:00–18:00', en: 'Mon–Fri: 9:00–18:00' },
  },

  offices: [
    {
      id: 'sofia-center',
      city: { bg: 'София', en: 'Sofia' },
      address: { bg: 'ул. „Раковски“ 100, ет. 2', en: '100 Rakovski St., floor 2' },
      phone: '+359 2 000 0000',
      email: 'sofia@example.bg',
      lat: 42.6934,
      lng: 23.3253,
    },
  ] satisfies readonly Office[],

  social: [
    { label: 'Facebook', href: 'https://facebook.com' },
    { label: 'Instagram', href: 'https://instagram.com' },
    { label: 'LinkedIn', href: 'https://linkedin.com' },
  ] satisfies readonly SocialLink[],

  /** Currency listings are quoted and sorted in. BGN is converted at the fixed peg. */
  currency: {
    primary: 'EUR',
    /** Irrevocable BGN↔EUR conversion rate. */
    bgnPerEur: 1.95583,
  },

  /** Turn whole surfaces on or off without deleting code. */
  features: {
    rentals: true,
    mortgageCalculator: true,
    mapOnDetailPage: true,
    compare: true,
    rssFeeds: true,
    inquiryForm: true,
  },

  /** Defaults for the mortgage calculator widget. */
  mortgage: {
    defaultDownPaymentPercent: 20,
    defaultInterestRate: 4.5,
    defaultTermYears: 25,
    maxTermYears: 35,
  },

  pagination: {
    pageSize: 24,
    /** Result counts stop being exact past this point, keeping latency flat. */
    countCap: 10_000,
  },

  seo: {
    twitterHandle: '@estate',
    /** Facet routes deeper than this are marked noindex to protect crawl budget. */
    indexableFilterDepth: 3,
  },
} as const;

export type SiteConfig = typeof siteConfig;
