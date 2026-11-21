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

/**
 * An image logo. Files live in `public/` and are referenced from the site root,
 * e.g. `public/brand/logo.svg` → `'/brand/logo.svg'` (the CSP only allows images
 * from this site and the media host, so do not point at a third-party URL).
 */
export type BrandLogo = {
  readonly src: string;
  /** Used instead of `src` while the `.dark` theme class is active. */
  readonly srcDark?: string;
  /**
   * The file's intrinsic size in pixels. Only the ratio matters — the logo is
   * scaled to the slot's height — but declaring it stops the header jumping
   * while the image loads.
   */
  readonly width: number;
  readonly height: number;
  /** Also print `name` next to the image, for a symbol-only logo. */
  readonly showName?: boolean;
};

export const siteConfig = {
  /** Brand name shown in the header, page titles and JSON-LD. */
  name: 'Estate',
  /** Longer legal/organisation name used in structured data. */
  legalName: 'Estate Real Estate Ltd.',
  /**
   * Image logo for the header, footer, mobile menu, admin console and
   * structured data. `null` keeps the text wordmark built from `name`.
   * Example: `{ src: '/brand/logo.svg', width: 180, height: 40 }`
   */
  logo: null as BrandLogo | null,
  /**
   * Square image for the browser tab icon: a PNG, JPEG or SVG path in
   * `public/`, e.g. `'/brand/icon.png'`. `null` draws the first letter of
   * `name` on a dark tile.
   */
  favicon: null as string | null,
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
