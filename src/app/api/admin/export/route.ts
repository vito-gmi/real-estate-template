import { NextResponse } from 'next/server';
import { recordsToCsv, recordsToJson, type ExportRecord } from '@/features/admin/import-export';
import { currentStaffOrNull } from '@/server/auth/session';
import { listListingsForExport } from '@/server/repositories/admin-listings';

/**
 * Catalog export.
 *
 * A route handler rather than a server action because the response is a file
 * download, not a mutation result. Auth is re-checked here — the admin layout
 * never wraps `/api`.
 */
export async function GET(request: Request) {
  const user = await currentStaffOrNull('editor');
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const format = new URL(request.url).searchParams.get('format') === 'csv' ? 'csv' : 'json';
  const rows = await listListingsForExport();
  const records: ExportRecord[] = rows.map((row) => ({
    dealType: row.dealType,
    propertyKind: row.propertyKind,
    status: row.status,
    price: row.price,
    currency: row.currency,
    area: row.area ?? undefined,
    landArea: row.landArea ?? undefined,
    rooms: row.rooms ?? undefined,
    bedrooms: row.bedrooms ?? undefined,
    bathrooms: row.bathrooms ?? undefined,
    floor: row.floor ?? undefined,
    floorsTotal: row.floorsTotal ?? undefined,
    yearBuilt: row.yearBuilt ?? undefined,
    constructionType: row.constructionType ?? undefined,
    heating: row.heating ?? undefined,
    furnishing: row.furnishing ?? undefined,
    condition: row.condition ?? undefined,
    energyLabel: row.energyLabel ?? undefined,
    maintenanceFee: row.maintenanceFee ?? undefined,
    depositMonths: row.depositMonths ?? undefined,
    availableFrom: row.availableFrom ?? undefined,
    locationId: row.locationId,
    address: row.address ?? undefined,
    hideExactAddress: row.hideExactAddress,
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    videoUrl: row.videoUrl ?? undefined,
    isFeatured: row.isFeatured,
    isExclusive: row.isExclusive,
    titleBg: row.titleBg,
    titleEn: row.titleEn,
    descriptionBg: row.descriptionBg,
    descriptionEn: row.descriptionEn,
    slugBg: row.slugBg,
    slugEn: row.slugEn,
    featureKeys: row.featureKeys,
    id: row.id,
    reference: row.reference,
  }));

  const body = format === 'csv' ? recordsToCsv(records) : recordsToJson(records);
  const filename = `listings-${new Date().toISOString().slice(0, 10)}.${format}`;

  return new NextResponse(body, {
    headers: {
      'Content-Type': format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
