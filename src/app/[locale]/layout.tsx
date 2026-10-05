import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import "@/app/globals.css";
import { siteConfig } from "@/config/site";
import { localeTags, routing, type Locale } from "@/i18n/routing";
import { WebVitals } from "@/components/web-vitals";
import { SentryInit } from "@/components/sentry-init";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * Invalid first segments (`/sitemap.xml`, `/foo`) are rejected below via
 * `hasLocale`. `sitemap.xml` is also a sibling route at `app/sitemap.xml`, and
 * the proxy matcher excludes it. Do not set `dynamicParams = false` here: it
 * 404s *nested* unknown params too — draft listing slugs, newly published
 * offers — before those pages can run.
 */
export const dynamicParams = true;

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#101720" },
  ],
  width: "device-width",
  initialScale: 1,
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    metadataBase: new URL(siteConfig.url),
    title: {
      default: siteConfig.name,
      template: `%s · ${siteConfig.name}`,
    },
    applicationName: siteConfig.name,
    formatDetection: { telephone: true, address: false, email: false },
    openGraph: {
      siteName: siteConfig.name,
      locale:
        localeTags[
          (hasLocale(routing.locales, locale)
            ? locale
            : routing.defaultLocale) as Locale
        ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      site: siteConfig.seo.twitterHandle,
    },
    robots: { index: true, follow: true },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Opts the whole subtree into static rendering; without it every page that
  // reads a translation would fall back to dynamic rendering.
  setRequestLocale(locale);

  return (
    <html
      lang={localeTags[locale]}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body
        className="min-h-dvh bg-canvas text-ink antialiased"
        suppressHydrationWarning
      >
        <WebVitals />
        <SentryInit />
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
