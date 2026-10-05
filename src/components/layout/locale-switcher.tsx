"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Check, ChevronDown, Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { localeTags, locales, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

const LABELS: Record<Locale, string> = { bg: "Български", en: "English" };

/**
 * Language switcher.
 *
 * Path segments and listing slugs are translated, so `/bg/imot/dvustaen-...`
 * has no mechanical relationship to its English counterpart. Rather than
 * duplicating that mapping on the client, this reads the `hreflang` links the
 * page already emits for search engines — one source of truth, and it is
 * automatically correct for any route that declares its alternates.
 *
 * Native `<details>` is used on purpose: iOS Safari often drops `click` on a
 * `position: sticky` header, so a React toggle looks dead on a real iPhone
 * while still working in Chrome's device toolbar. Opening the list is then a
 * browser feature, not a JS event.
 */
export function LocaleSwitcher() {
  const t = useTranslations("common");
  const active = useLocale() as Locale;
  const pathname = usePathname();
  const rootRef = useRef<HTMLDetailsElement>(null);
  const [alternates, setAlternates] = useState<Partial<Record<Locale, string>>>(
    {},
  );

  useEffect(() => {
    const found: Partial<Record<Locale, string>> = {};
    for (const locale of locales) {
      const link = document.querySelector<HTMLLinkElement>(
        `link[rel="alternate"][hreflang="${localeTags[locale]}"]`,
      );
      // hreflang URLs are absolute on the canonical site URL; keep only the path
      // so the switch stays on whatever host is serving the page.
      if (link?.href) {
        const url = new URL(link.href);
        found[locale] = `${url.pathname}${url.search}${url.hash}`;
      }
    }
    setAlternates(found);
  }, [pathname]);

  useEffect(() => {
    rootRef.current?.removeAttribute("open");
  }, [pathname]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!root.open) return;
      const target = event.target;
      if (target instanceof Node && root.contains(target)) return;
      root.open = false;
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <details ref={rootRef} className="group relative">
      <summary
        aria-label={t("language")}
        className="disclosure-summary h-11 cursor-pointer px-2.5 text-sm font-medium uppercase text-ink-muted touch-manipulation hover:bg-surface-muted hover:text-ink"
      >
        <span className="inline-flex h-11 items-center gap-1.5">
          <Globe className="size-4" aria-hidden="true" />
          {active}
          <ChevronDown
            className="size-3.5 transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </span>
      </summary>
      <div className="absolute right-0 z-50 mt-1 min-w-44 overflow-hidden rounded-control border border-line bg-surface p-1 text-ink shadow-pop">
        {locales.map((locale) => {
          const isActive = locale === active;
          return (
            <a
              key={locale}
              href={alternates[locale] ?? `/${locale}`}
              hrefLang={localeTags[locale]}
              lang={localeTags[locale]}
              aria-current={isActive ? "true" : undefined}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-[0.4rem] px-2.5 py-2 text-sm transition-colors hover:bg-surface-muted",
                isActive ? "font-medium text-ink" : "text-ink-muted",
              )}
            >
              <Check
                className={cn("size-4", isActive ? "opacity-100" : "opacity-0")}
                aria-hidden="true"
              />
              {LABELS[locale]}
            </a>
          );
        })}
      </div>
    </details>
  );
}
