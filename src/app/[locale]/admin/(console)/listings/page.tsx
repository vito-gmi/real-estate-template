import Link from "next/link";
import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImportExportBar } from "@/features/admin/components/import-export-bar";
import { ListingsTable } from "@/features/admin/components/listings-table";
import type { Locale } from "@/i18n/routing";
import { listingStatuses, type ListingStatus } from "@/lib/domain/enums";
import { adminPath } from "@/lib/routes";
import { requireStaff } from "@/server/auth/session";
import { listAdminListings } from "@/server/repositories/admin-listings";

const PAGE_SIZE = 30;

export default async function AdminListingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { locale } = await params;
  const user = await requireStaff(locale, { minimumRole: "editor" });
  const query = await searchParams;

  const status = listingStatuses.includes(query.status as ListingStatus)
    ? (query.status as ListingStatus)
    : undefined;
  const page = Math.max(1, Number(query.page ?? 1) || 1);

  const [t, tEnum, result] = await Promise.all([
    getTranslations("admin"),
    getTranslations("enums"),
    listAdminListings(locale, {
      search: query.q,
      statuses: status ? [status] : undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {t("listings")}
        </h1>
        <Button asChild>
          <Link href={adminPath(locale, "listings/new")}>
            <Plus />
            {t("newListing")}
          </Link>
        </Button>
      </div>

      <ImportExportBar />

      {/* A plain GET form: bookmarkable, works without JavaScript, and the
          browser restores the values on back-navigation for free. */}
      <form className="flex flex-wrap gap-3 rounded-card border border-line bg-surface p-4">
        <Input
          name="q"
          type="search"
          defaultValue={query.q ?? ""}
          placeholder={t("searchListings")}
          className="max-w-xs"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="h-11 rounded-control border border-line-strong bg-surface px-3 text-sm text-ink"
        >
          <option value="">{t("allStatuses")}</option>
          {listingStatuses.map((value) => (
            <option key={value} value={value}>
              {tEnum(`status.${value}`)}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline">
          {t("searchListings")}
        </Button>
      </form>

      <ListingsTable
        rows={result.rows}
        locale={locale}
        canDelete={user.role === "admin"}
      />

      {totalPages > 1 ? (
        <nav
          aria-label="Pagination"
          className="flex items-center justify-between text-sm"
        >
          {page > 1 ? (
            <Link
              href={`?${new URLSearchParams({ ...query, page: String(page - 1) } as Record<string, string>)}`}
              className="text-brand hover:underline"
            >
              ←
            </Link>
          ) : (
            <span />
          )}
          <span className="text-ink-muted">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={`?${new URLSearchParams({ ...query, page: String(page + 1) } as Record<string, string>)}`}
              className="text-brand hover:underline"
            >
              →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
