import 'server-only';

import { asc, eq } from 'drizzle-orm';
import type { Locale } from '@/i18n/routing';
import { db } from '@/server/db/client';
import { features } from '@/server/db/schema';

export type FeatureOption = {
  readonly key: string;
  readonly name: string;
  readonly category: string;
  readonly icon: string | null;
};

export async function listFilterableFeatures(locale: Locale): Promise<readonly FeatureOption[]> {
  const rows = await db
    .select({
      key: features.key,
      name: locale === 'bg' ? features.nameBg : features.nameEn,
      category: features.category,
      icon: features.icon,
    })
    .from(features)
    .where(eq(features.isFilterable, true))
    .orderBy(asc(features.category), asc(features.sortOrder));

  return rows;
}

export async function listAllFeatures(locale: Locale): Promise<readonly FeatureOption[]> {
  return db
    .select({
      key: features.key,
      name: locale === 'bg' ? features.nameBg : features.nameEn,
      category: features.category,
      icon: features.icon,
    })
    .from(features)
    .orderBy(asc(features.category), asc(features.sortOrder));
}
