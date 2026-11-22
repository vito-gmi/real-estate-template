'use client';

import { useId } from 'react';
import { usePathname } from 'next/navigation';
import { KeyRound, Menu, Phone, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { siteConfig } from '@/config/site';
import { BrandLogo } from './brand-logo';

export type NavItem = { readonly href: string; readonly label: string };

/**
 * Phone menu.
 *
 * iOS Safari often drops React `click` inside the sticky header, so this opens
 * with the native Popover API — the same class of browser feature that made
 * the language switcher work on a real iPhone. The panel is promoted to the
 * top layer, so it is not trapped by the header's `transform`.
 */
export function MobileNav({
  items,
  cta,
}: {
  items: readonly NavItem[];
  /** Highlighted owner action ("List your property"), when enabled. */
  cta?: NavItem;
}) {
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const pathname = usePathname();
  const menuId = `mobile-nav-${useId().replaceAll(':', '')}`;

  return (
    <div className="md:hidden">
      <button
        type="button"
        className="grid size-11 place-items-center rounded-control text-ink-muted touch-manipulation hover:bg-surface-muted hover:text-ink"
        popoverTarget={menuId}
        aria-haspopup="dialog"
        aria-label={t('openMenu')}
      >
        <Menu className="size-5" />
      </button>
      <div id={menuId} popover="auto" className="mobile-nav-popover">
        <div className="flex items-start justify-between gap-3 pr-12">
          <p className="flex items-center gap-2 text-lg font-semibold text-ink">
            <BrandLogo imageClassName="h-8" />
          </p>
          <button
            type="button"
            className="absolute right-4 top-4 grid size-11 place-items-center rounded-full text-ink-muted touch-manipulation hover:bg-surface-muted hover:text-ink"
            popoverTarget={menuId}
            popoverTargetAction="hide"
            aria-label={tCommon('close')}
          >
            <X className="size-5" />
          </button>
        </div>
        <nav className="mt-6 flex flex-col gap-1">
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? 'page' : undefined}
              className="rounded-control px-3 py-3 text-base font-medium text-ink transition-colors hover:bg-surface-muted aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand"
            >
              {item.label}
            </a>
          ))}
        </nav>
        {cta ? (
          <a
            href={cta.href}
            className="mt-6 flex items-center justify-center gap-2 rounded-control border border-brand px-4 py-3 font-medium text-brand"
          >
            <KeyRound className="size-4" aria-hidden="true" />
            {cta.label}
          </a>
        ) : null}
        <a
          href={siteConfig.contact.phoneHref}
          className={`${cta ? 'mt-3' : 'mt-6'} inline-flex items-center gap-2 rounded-control bg-brand px-4 py-3 font-medium text-ink-inverse`}
        >
          <Phone className="size-4" />
          {siteConfig.contact.phone}
        </a>
      </div>
    </div>
  );
}
