"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { Locale } from "@/i18n/routing";
import { listingStatuses, type ListingStatus } from "@/lib/domain/enums";
import { formatDate } from "@/lib/format";
import { adminPath, listingPath } from "@/lib/routes";
import type { AdminListingRow } from "@/server/repositories/admin-listings";
import { AdminPrice } from "./admin-price";
import {
  bulkChangeListingStatus,
  bulkDeleteListings,
} from "../listing-actions";

const STATUS_TONE: Record<
  ListingStatus,
  "success" | "warning" | "neutral" | "danger" | "brand"
> = {
  active: "success",
  reserved: "warning",
  draft: "neutral",
  sold: "brand",
  rented: "brand",
  archived: "danger",
};

export function ListingsTable({
  rows,
  locale,
  canDelete,
}: {
  rows: readonly AdminListingRow[];
  locale: Locale;
  canDelete: boolean;
}) {
  const t = useTranslations("admin");
  const tEnum = useTranslations("enums");
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);

  const allIds = rows.map((row) => row.id);
  const allSelected =
    allIds.length > 0 && allIds.every((id) => selected.has(id));

  function toggle(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);

      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(allIds) : new Set());
  }

  async function applyStatus(status: ListingStatus) {
    if (selected.size === 0) return;

    setPending(true);
    await bulkChangeListingStatus({ ids: [...selected], status });
    setSelected(new Set());
    setPending(false);
    router.refresh();
  }

  async function remove() {
    if (selected.size === 0) return;

    if (!window.confirm(t("confirmDelete"))) return;

    setPending(true);
    await bulkDeleteListings({ ids: [...selected] });
    setSelected(new Set());
    setPending(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-surface p-3 text-sm">
          <span className="font-medium text-ink">
            {t("bulk.selected", { count: selected.size })}
          </span>
          {listingStatuses.map((status) => (
            <Button
              key={status}
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => void applyStatus(status)}
            >
              {tEnum(`status.${status}`)}
            </Button>
          ))}
          {canDelete ? (
            <Button
              type="button"
              size="sm"
              variant="danger"
              disabled={pending}
              onClick={() => void remove()}
            >
              {t("bulk.delete")}
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full min-w-3xl text-sm">
          <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-subtle">
            <tr>
              <th scope="col" className="p-3">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(value) => toggleAll(value === true)}
                  aria-label={t("bulk.selectAll")}
                />
              </th>
              <th scope="col" className="p-3 font-medium">
                #
              </th>
              <th scope="col" className="p-3 font-medium">
                {t("fields.titleBg")}
              </th>
              <th scope="col" className="p-3 font-medium">
                {t("fields.price")}
              </th>
              <th scope="col" className="p-3 font-medium">
                {t("media.title")}
              </th>
              <th scope="col" className="p-3 font-medium">
                {tEnum("status.draft")}
              </th>
              <th scope="col" className="p-3 font-medium">
                {t("audit.when")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-ink-muted">
                  {t("noListings")}
                </td>
              </tr>
            ) : null}

            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-surface-muted">
                <td className="p-3">
                  <Checkbox
                    checked={selected.has(row.id)}
                    onCheckedChange={(value) => toggle(row.id, value === true)}
                    aria-label={row.title}
                  />
                </td>
                <td className="p-3 font-mono text-xs text-ink-subtle">
                  {row.reference}
                </td>
                <td className="p-3">
                  <Link
                    href={adminPath(locale, `listings/${row.id}`)}
                    className="font-medium text-ink hover:text-brand"
                  >
                    {row.title}
                  </Link>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-subtle">
                    <span>{tEnum(`propertyKind.${row.propertyKind}`)}</span>
                    {row.cityName ? <span>· {row.cityName}</span> : null}
                    {row.status === "active" ? (
                      <Link
                        href={listingPath(locale, row.slug)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand hover:underline"
                      >
                        {t("preview")}
                      </Link>
                    ) : null}
                  </div>
                </td>
                <td className="p-3 whitespace-nowrap text-ink">
                  <AdminPrice
                    locale={locale}
                    price={row.price}
                    currency={row.currency}
                    showPrice={row.showPrice}
                    hiddenLabel={t("price.hidden")}
                  />
                </td>
                <td className="p-3 text-ink-muted">{row.photoCount}</td>
                <td className="p-3">
                  <Badge tone={STATUS_TONE[row.status]}>
                    {tEnum(`status.${row.status}`)}
                  </Badge>
                </td>
                <td className="p-3 whitespace-nowrap text-xs text-ink-subtle">
                  {formatDate(locale, row.updatedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
