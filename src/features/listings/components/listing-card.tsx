import { useTranslations } from "next-intl";
import {
  BedDouble,
  Building2,
  ImageOff,
  LandPlot,
  Layers,
  Ruler,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveImage } from "@/components/media/responsive-image";
import { FavoriteButton } from "@/features/favorites/favorite-button";
import type { Locale } from "@/i18n/routing";
import { hasIndoorArea } from "@/lib/domain/enums";
import {
  formatArea,
  formatNumber,
  formatPrice,
  formatPricePerSqm,
} from "@/lib/format";
import { listingPath } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { ListingCardDto } from "../dto";

/** Matches the grid: 1 column on phones, 2 on tablets, 3 on desktop. */
const CARD_SIZES = "(min-width: 1280px) 400px, (min-width: 768px) 45vw, 100vw";

/**
 * Deliberately synchronous and free of server-only imports, so the same
 * component renders inside the server-rendered results grid and inside the
 * client-rendered favourites list. One card implementation, two environments.
 */
export function ListingCard({
  locale,
  listing,
  priority = false,
}: {
  locale: Locale;
  listing: ListingCardDto;
  priority?: boolean;
}) {
  const t = useTranslations("listing");
  const tEnum = useTranslations("enums");

  const href = listingPath(locale, listing.slug);
  const place = [listing.city?.name, listing.district?.name]
    .filter(Boolean)
    .join(", ");
  const showArea = hasIndoorArea(listing.kind)
    ? listing.area
    : listing.landArea;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card transition-shadow duration-200 hover:shadow-card-hover">
      <div className="relative">
        <div className="relative aspect-[4/3] overflow-hidden bg-surface-sunken">
          {listing.cover ? (
            <ResponsiveImage
              variants={listing.cover.variants}
              width={listing.cover.width}
              height={listing.cover.height}
              blurDataUrl={listing.cover.blurDataUrl}
              alt=""
              sizes={CARD_SIZES}
              priority={priority}
              className="size-full"
              imageClassName="transition-transform duration-500 ease-out-soft group-hover:scale-[1.03]"
            />
          ) : (
            <div className="grid size-full place-items-center text-ink-subtle">
              <ImageOff className="size-8" aria-hidden="true" />
              <span className="sr-only">{t("noPhoto")}</span>
            </div>
          )}

          {/* Leave a gutter for the heart — iOS otherwise hit-tests this link
              even when the heart paints on top. */}
          <a
            href={href}
            tabIndex={-1}
            aria-hidden="true"
            className="absolute inset-0 right-16 z-0"
          />

          <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-wrap gap-1.5 pr-14">
            <Badge tone="solid">
              {tEnum(`dealTypeShort.${listing.dealType}`)}
            </Badge>
            {listing.isFeatured ? <Badge tone="accent">Top</Badge> : null}
            {listing.status === "reserved" ? (
              <Badge tone="warning">{tEnum("status.reserved")}</Badge>
            ) : null}
          </div>
        </div>

        <div className="absolute right-3 top-3 z-30">
          <FavoriteButton listingId={listing.id} />
        </div>
      </div>

      <div className="relative flex flex-1 flex-col gap-3 p-4">
        <a
          href={href}
          tabIndex={-1}
          aria-hidden="true"
          className="absolute inset-0 z-0"
        />
        <div className="pointer-events-none relative z-10 flex flex-1 flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xl font-semibold tracking-tight text-ink">
              {formatPrice(
                locale,
                listing.price.amount,
                listing.price.currency,
              )}
              {listing.dealType === "rent" ? (
                <span className="ml-1 text-sm font-normal text-ink-muted">
                  /{t("monthly")}
                </span>
              ) : null}
            </p>
            {listing.price.perSqmEur && listing.dealType === "sale" ? (
              <p className="shrink-0 text-xs text-ink-subtle">
                {formatPricePerSqm(locale, listing.price.perSqmEur)}
              </p>
            ) : null}
          </div>

          <h3 className="pointer-events-auto text-base font-medium leading-snug text-ink">
            <a href={href}>{listing.title}</a>
          </h3>

          {place ? <p className="text-sm text-ink-muted">{place}</p> : null}

          <dl className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-3 text-sm text-ink-muted">
            {showArea ? (
              <Spec
                icon={hasIndoorArea(listing.kind) ? Ruler : LandPlot}
                label={
                  hasIndoorArea(listing.kind) ? t("totalArea") : t("landArea")
                }
                value={formatArea(locale, showArea)}
              />
            ) : null}
            {listing.rooms ? (
              <Spec
                icon={BedDouble}
                label={t("rooms")}
                value={formatNumber(locale, listing.rooms)}
              />
            ) : null}
            {listing.floor !== null ? (
              <Spec
                icon={listing.floorsTotal ? Layers : Building2}
                label={t("floor")}
                value={
                  listing.floorsTotal
                    ? t("floorOf", {
                        floor: listing.floor,
                        total: listing.floorsTotal,
                      })
                    : String(listing.floor)
                }
              />
            ) : null}
            <div className="ml-auto text-xs text-ink-subtle">
              <dt className="inline">{t("reference")} </dt>
              <dd className="inline">{listing.reference}</dd>
            </div>
          </dl>
        </div>
      </div>
    </article>
  );
}

function Spec({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  // HTML allows <div> wrappers inside <dl> only when they contain dt/dd.
  // Keep the icon inside <dt> so axe does not flag non-dt/dd children.
  return (
    <div className="flex items-center gap-1.5">
      <dt className="flex items-center gap-1.5">
        <Icon className="size-4 text-ink-subtle" aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </dt>
      <dd>{value}</dd>
    </div>
  );
}

export function ListingCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-card border border-line bg-surface",
        className,
      )}
    >
      <Skeleton className="aspect-[4/3] rounded-none" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}
