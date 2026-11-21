import { Phone } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { siteConfig } from "@/config/site";
import { FavoritesLink } from "@/features/favorites/favorites-link";
import type { Locale } from "@/i18n/routing";
import { homePath, searchPath, staticPath } from "@/lib/routes";
import { BrandLogo } from "./brand-logo";
import { LocaleSwitcher } from "./locale-switcher";
import { MobileNav, type NavItem } from "./mobile-nav";

export async function SiteHeader({ locale }: { locale: Locale }) {
  const t = await getTranslations("nav");

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
          <a
            href={siteConfig.contact.phoneHref}
            className="hidden items-center gap-2 rounded-control px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink lg:inline-flex"
          >
            <Phone className="size-4" />
            {siteConfig.contact.phone}
          </a>
          <FavoritesLink href={staticPath("favorites", locale)} />
          <LocaleSwitcher />
          <MobileNav items={items} />
        </div>
      </div>
    </header>
  );
}
