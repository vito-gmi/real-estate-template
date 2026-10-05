import { getTranslations } from 'next-intl/server';
import { FeaturesManager, LocationsManager } from '@/features/admin/components/taxonomy-manager';
import type { Locale } from '@/i18n/routing';
import { requireStaff } from '@/server/auth/session';
import { listFeaturesAdmin, listLocationsAdmin } from '@/server/repositories/admin-taxonomy';

export default async function AdminTaxonomyPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const user = await requireStaff(locale, { minimumRole: 'editor' });

  const [t, locations, features] = await Promise.all([
    getTranslations('admin'),
    listLocationsAdmin(),
    listFeaturesAdmin(),
  ]);

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">{t('taxonomy.title')}</h1>
      <LocationsManager locations={locations} canDelete={user.role === 'admin'} />
      <FeaturesManager features={features} canDelete={user.role === 'admin'} />
    </div>
  );
}
