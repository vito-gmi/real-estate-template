"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { siteConfig } from "@/config/site";
import type { Locale } from "@/i18n/routing";
import { propertyKinds, type DealType, type PropertyKind } from "@/lib/domain/enums";
import { searchPath, withQuery } from "@/lib/routes";

export type CityOption = { readonly slug: string; readonly name: string };

const ANY = "__any__";

/**
 * The primary entry point into the catalogue.
 *
 * It builds a canonical URL and navigates, rather than holding search state in
 * React. Every search is therefore a real, shareable, cacheable, indexable page
 * — which is the whole reason the site can be both fast and findable.
 */
export function HeroSearch({ cities }: { cities: readonly CityOption[] }) {
  const t = useTranslations("search");
  const tEnum = useTranslations("enums");
  const locale = useLocale() as Locale;
  const router = useRouter();

  const [kind, setKind] = useState<string>(ANY);
  const [city, setCity] = useState<string>(ANY);
  const [priceMax, setPriceMax] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const deal: DealType = form.get("deal") === "rent" ? "rent" : "sale";
    const typedPrice = String(form.get("priceMax") ?? priceMax);

    const path = searchPath(locale, {
      deal,
      kind: kind === ANY ? undefined : (kind as PropertyKind),
      citySlug: city === ANY ? undefined : city,
    });

    const query = new URLSearchParams();
    const parsedMax = Number(typedPrice.replace(/\s/g, ""));
    if (Number.isFinite(parsedMax) && parsedMax > 0)
      query.set("priceMax", String(parsedMax));

    router.push(withQuery(path, query));
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-card border border-line bg-surface/95 p-4 shadow-pop backdrop-blur-sm sm:p-5"
      role="search"
      aria-label={t("title")}
    >
      {siteConfig.features.rentals ? (
        <div className="mb-4 inline-flex items-center gap-1 rounded-control bg-surface-muted p-1 text-ink-muted">
          {(["sale", "rent"] as const).map((deal) => (
            <label key={deal} className="relative cursor-pointer touch-manipulation">
              <input
                type="radio"
                name="deal"
                value={deal}
                defaultChecked={deal === "sale"}
                className="peer native-hit"
              />
              <span className="relative z-0 inline-flex items-center justify-center rounded-[0.45rem] px-4 py-2 text-sm font-medium transition-colors peer-checked:bg-surface peer-checked:text-ink peer-checked:shadow-xs">
                {tEnum(`dealType.${deal}`)}
              </span>
            </label>
          ))}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_auto]">
        <div className="space-y-1.5">
          <Label htmlFor="hero-city">{t("location")}</Label>
          <Select value={city} onValueChange={setCity}>
            <SelectTrigger id="hero-city">
              <SelectValue placeholder={t("anyLocation")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{t("anyLocation")}</SelectItem>
              {cities.map((option) => (
                <SelectItem key={option.slug} value={option.slug}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="hero-kind">{t("propertyKind")}</Label>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger id="hero-kind">
              <SelectValue placeholder={t("anyKind")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{t("anyKind")}</SelectItem>
              {propertyKinds.map((option) => (
                <SelectItem key={option} value={option}>
                  {tEnum(`propertyKindPlural.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="hero-price">{t("priceTo")}</Label>
          <Input
            id="hero-price"
            name="priceMax"
            inputMode="numeric"
            placeholder="250 000"
            value={priceMax}
            onChange={(event) => setPriceMax(event.target.value)}
          />
        </div>

        <div className="flex items-end">
          <Button type="submit" size="lg" full className="lg:w-auto">
            <Search />
            {t("title")}
          </Button>
        </div>
      </div>
    </form>
  );
}
