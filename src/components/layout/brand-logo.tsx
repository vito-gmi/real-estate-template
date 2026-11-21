import { siteConfig } from '@/config/site';
import { cn } from '@/lib/utils';

/**
 * The brand, wherever it is shown: header, footer, mobile menu, admin console.
 *
 * With `siteConfig.logo` set it renders the image (and, for a symbol-only
 * logo, the name beside it). Without one it renders the template's text
 * wordmark, so an unbranded fork looks exactly as before.
 *
 * It returns a fragment, not a wrapper: the caller's element decides layout,
 * spacing and typography, and the caller's link or heading gets its
 * accessible name from the image `alt` (or the visible name). No hooks, so it
 * works in server and client components alike.
 */
export function BrandLogo({
  withMark = false,
  imageClassName,
}: {
  /** Fallback only: show the initial-letter badge before the name. */
  withMark?: boolean;
  /** Sets the logo height for this slot, e.g. `h-8`. Width follows the ratio. */
  imageClassName?: string;
}) {
  const logo = siteConfig.logo;

  if (!logo) {
    return (
      <>
        {withMark ? (
          <span
            aria-hidden="true"
            className="grid size-8 place-items-center rounded-lg bg-brand text-sm font-bold text-ink-inverse"
          >
            {siteConfig.name.slice(0, 1)}
          </span>
        ) : null}
        {siteConfig.name}
      </>
    );
  }

  // When the name is printed next to it, the image is decorative.
  const alt = logo.showName ? '' : siteConfig.name;
  const imageClass = cn('h-8 w-auto max-w-none shrink-0', imageClassName);

  return (
    <>
      <img
        src={logo.src}
        width={logo.width}
        height={logo.height}
        alt={alt}
        decoding="async"
        className={cn(imageClass, logo.srcDark && 'dark:hidden')}
      />
      {logo.srcDark ? (
        <img
          src={logo.srcDark}
          width={logo.width}
          height={logo.height}
          alt={alt}
          decoding="async"
          className={cn(imageClass, 'hidden dark:block')}
        />
      ) : null}
      {logo.showName ? <span>{siteConfig.name}</span> : null}
    </>
  );
}
