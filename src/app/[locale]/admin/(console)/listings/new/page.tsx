import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { emptyListingForm } from '@/features/admin/default-listing';
import { ListingForm } from '@/features/admin/components/listing-form';
import type { Locale } from '@/i18n/routing';
import { adminPath } from '@/lib/routes';
import { requireStaff } from '@/server/auth/session';
import { listFilterableFeatures } from '@/server/repositories/features';
import { getLocationTree } from '@/server/repositories/locations';

export default async function NewListingPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  await requireStaff(locale, { minimumRole: 'editor' });

  const [locations, features, t] = await Promise.all([
    getLocationTree(locale),
    listFilterableFeatures(locale),
    getTranslations('admin'),
  ]);

  const firstDistrict = locations.find((node) => node.level === 'district');
  // A listing must belong to a place; without a taxonomy there is nothing to
  // create against, and an empty select would be a confusing dead end.
  if (!firstDistrict) notFound();

  return (
    <>
      <h1 className="sr-only">{t('createListing')}</h1>
      <ListingForm
        defaultValues={emptyListingForm(firstDistrict.id)}
        locations={locations}
        features={features}
        adminBasePath={adminPath(locale, 'listings')}
      />
    </>
  );
}
