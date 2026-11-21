import Link from 'next/link';
import { Mail, MapPin, Phone } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { siteConfig } from '@/config/site';
import { propertyKinds } from '@/lib/domain/enums';
import type { Locale } from '@/i18n/routing';
import { searchPath, staticPath } from '@/lib/routes';
import { BrandLogo } from './brand-logo';

/** Kinds worth a footer link — the long tail lives behind the filters. */
const FOOTER_KINDS = propertyKinds.slice(0, 5);

export async function SiteFooter({ locale }: { locale: Locale }) {
  const [t, tNav, tEnum] = await Promise.all([
    getTranslations('footer'),
    getTranslations('nav'),
    getTranslations('enums'),
  ]);

  return (
    <footer className="mt-20 border-t border-line bg-surface-muted">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div className="lg:col-span-1">
          <p className="flex items-center gap-2 text-lg font-semibold text-ink">
            <BrandLogo imageClassName="h-10" />
          </p>
          <p className="mt-2 max-w-xs text-sm text-ink-muted">{t('tagline')}</p>
          <ul className="mt-5 space-y-2 text-sm text-ink-muted">
            <li>
              <a href={siteConfig.contact.phoneHref} className="inline-flex items-center gap-2 hover:text-brand">
                <Phone className="size-4" aria-hidden="true" />
                {siteConfig.contact.phone}
              </a>
            </li>
            <li>
              <a href={`mailto:${siteConfig.contact.email}`} className="inline-flex items-center gap-2 hover:text-brand">
                <Mail className="size-4" aria-hidden="true" />
                {siteConfig.contact.email}
              </a>
            </li>
            {siteConfig.offices.map((office) => (
              <li key={office.id} className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  {office.city[locale]}, {office.address[locale]}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <FooterColumn title={t('forClients')}>
          <FooterLink href={searchPath(locale, { deal: 'sale' })}>{tNav('buy')}</FooterLink>
          {siteConfig.features.rentals ? (
            <FooterLink href={searchPath(locale, { deal: 'rent' })}>{tNav('rent')}</FooterLink>
          ) : null}
          <FooterLink href={staticPath('favorites', locale)}>{tNav('favorites')}</FooterLink>
          {siteConfig.features.compare ? (
            <FooterLink href={staticPath('compare', locale)}>{tNav('compare')}</FooterLink>
          ) : null}
        </FooterColumn>

        <FooterColumn title={t('company')}>
          <FooterLink href={staticPath('about', locale)}>{tNav('about')}</FooterLink>
          <FooterLink href={staticPath('contact', locale)}>{tNav('contact')}</FooterLink>
          {FOOTER_KINDS.map((kind) => (
            <FooterLink key={kind} href={searchPath(locale, { deal: 'sale', kind })}>
              {tEnum(`propertyKindPlural.${kind}`)}
            </FooterLink>
          ))}
        </FooterColumn>

        <FooterColumn title={t('legal')}>
          <FooterLink href={staticPath('privacy', locale)}>{t('privacy')}</FooterLink>
          <FooterLink href={staticPath('terms', locale)}>{t('terms')}</FooterLink>
          <li className="pt-2">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              {t('followUs')}
            </p>
            <div className="flex gap-3 text-sm">
              {siteConfig.social.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  rel="noopener noreferrer me"
                  target="_blank"
                  className="text-ink-muted hover:text-brand"
                >
                  {social.label}
                </a>
              ))}
            </div>
          </li>
        </FooterColumn>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-ink-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            © {new Date().getFullYear()} {siteConfig.legalName}. {t('rights')}
          </p>
          <p>{t('buildWith')}</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <ul className="mt-4 space-y-2 text-sm">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-ink-muted transition-colors hover:text-brand">
        {children}
      </Link>
    </li>
  );
}
