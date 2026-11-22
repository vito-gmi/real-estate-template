import { KeyRound, Phone } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { siteConfig } from "@/config/site";
import { FavoritesLink } from "@/features/favorites/favorites-link";
import { getPublicSubmissionAvailability } from "@/features/submissions/availability";
import type { Locale } from "@/i18n/routing";
import { homePath, searchPath, staticPath } from "@/lib/routes";
import { BrandLogo } from "./brand-logo";
import { LocaleSwitcher } from "./locale-switcher";
import { MobileNav, type NavItem } from "./mobile-nav";

export async function SiteHeader({ locale }: { locale: Locale }) {
  const [t, submissions] = await Promise.all([
    getTranslations("nav"),
    getPublicSubmissionAvailability(),
  ]);
  // The owner-facing call to action, shown only while submissions are open.
  const cta = submissions.open
    ? { href: staticPath("submit", locale), label: t("listProperty") }
    : undefined;

  const items: NavItem[] = [
    { href: searchPath(locale, { deal: "sale" }), label: t("buy") },
    ...(siteConfig.features.rentals
      ? [{ href: searchPath(locale, { deal: "rent" }), label: t("rent") }]
      : []),
    { href: staticPath("about", locale), label: t("about") },
    { href: staticPath("contact", locale), label: t("contact") },
  ];

  return (
    <header className="sticky top-0 z-40 isolate border-b border-line bg-surface [transform:translateZ(0)]">
      <div className="mx-auto flex h-16 max-w-7xl touch-manipulation items-center gap-2 px-4 sm:px-6 lg:px-8">
        <a
          href={homePath(locale)}
          className="mr-2 flex items-center gap-2 text-lg font-semibold tracking-tight text-ink"
        >
          <BrandLogo withMark imageClassName="h-8" />
        </a>

        <nav aria-label="Main" className="hidden md:flex md:items-center md:gap-1">
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-control px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          {cta ? (
            <a
              href={cta.href}
              className="mr-1 hidden items-center gap-2 rounded-control border border-brand px-3 py-2 text-sm font-medium text-brand transition-colors hover:bg-brand-soft lg:inline-flex"
            >
              <KeyRound className="size-4" aria-hidden="true" />
              {cta.label}
            </a>
          ) : null}
          <a
            href={siteConfig.contact.phoneHref}
            className="hidden items-center gap-2 rounded-control px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink xl:inline-flex"
          >
            <Phone className="size-4" />
            {siteConfig.contact.phone}
          </a>
          <FavoritesLink href={staticPath("favorites", locale)} />
          <LocaleSwitcher />
          <MobileNav items={items} cta={cta} />
        </div>
      </div>
    </header>
  );
}
