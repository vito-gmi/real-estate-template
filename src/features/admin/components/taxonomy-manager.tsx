'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  createFeature,
  createLocation,
  deleteFeature,
  deleteLocation,
  updateFeature,
  updateLocation,
} from '../taxonomy-actions';
import type { LocationLevel } from '@/lib/domain/enums';
import { locationLevels } from '@/lib/domain/enums';

type LocationRow = {
  id: string;
  parentId: string | null;
  level: LocationLevel;
  nameBg: string;
  nameEn: string;
  slugBg: string;
  slugEn: string;
  lat: number | null;
  lng: number | null;
  sortOrder: number;
  isActive: boolean;
};

type FeatureRow = {
  id: string;
  key: string;
  category: string;
  nameBg: string;
  nameEn: string;
  icon: string | null;
  sortOrder: number;
  isFilterable: boolean;
};

export function LocationsManager({
  locations,
  canDelete,
}: {
  locations: readonly LocationRow[];
  canDelete: boolean;
}) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [editing, setEditing] = useState<string | 'new' | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink">{t('taxonomy.locations')}</h2>
        <Button size="sm" onClick={() => setEditing('new')}>
          {t('taxonomy.addLocation')}
        </Button>
      </div>

      {editing === 'new' ? (
        <LocationForm
          parents={locations}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      ) : null}

      <ul className="divide-y divide-line rounded-card border border-line bg-surface">
        {locations.map((location) => (
          <li key={location.id} className="p-4">
            {editing === location.id ? (
              <LocationForm
                initial={location}
                parents={locations.filter((item) => item.id !== location.id)}
                onCancel={() => setEditing(null)}
                onSaved={() => {
                  setEditing(null);
                  router.refresh();
                }}
              />
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">
                    {location.nameEn}{' '}
                    <span className="font-normal text-ink-muted">/ {location.nameBg}</span>
                  </p>
                  <p className="text-xs text-ink-subtle">
                    {location.level} · {location.slugEn}
                    {location.isActive ? '' : ` · ${t('taxonomy.inactive')}`}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setEditing(location.id)}>
                  {t('edit')}
                </Button>
                {canDelete ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (!window.confirm(t('confirmDelete'))) return;
                      await deleteLocation({ id: location.id });
                      router.refresh();
                    }}
                  >
                    {t('delete')}
                  </Button>
                ) : null}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LocationForm({
  initial,
  parents,
  onCancel,
  onSaved,
}: {
  initial?: LocationRow;
  parents: readonly LocationRow[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations('admin');
  const [pending, setPending] = useState(false);

  async function submit(form: FormData) {
    setPending(true);
    const payload = {
      parentId: String(form.get('parentId') || '') || null,
      level: String(form.get('level')) as LocationLevel,
      nameBg: String(form.get('nameBg') ?? ''),
      nameEn: String(form.get('nameEn') ?? ''),
      slugBg: String(form.get('slugBg') || '') || undefined,
      slugEn: String(form.get('slugEn') || '') || undefined,
      sortOrder: Number(form.get('sortOrder') || 0),
      isActive: form.get('isActive') === 'on',
    };
    if (initial) {
      await updateLocation({ id: initial.id, ...payload });
    } else {
      await createLocation(payload);
    }
    setPending(false);
    onSaved();
  }

  return (
    <form action={submit} className="grid gap-3 sm:grid-cols-2">
      <Field label={t('taxonomy.nameBg')} htmlFor="nameBg" required>
        <Input id="nameBg" name="nameBg" defaultValue={initial?.nameBg} required />
      </Field>
      <Field label={t('taxonomy.nameEn')} htmlFor="nameEn" required>
        <Input id="nameEn" name="nameEn" defaultValue={initial?.nameEn} required />
      </Field>
      <Field label={t('taxonomy.level')} htmlFor="level">
        <select
          id="level"
          name="level"
          defaultValue={initial?.level ?? 'district'}
          className="h-11 w-full rounded-control border border-line-strong bg-surface px-3 text-sm"
        >
          {locationLevels.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('taxonomy.parent')} htmlFor="parentId">
        <select
          id="parentId"
          name="parentId"
          defaultValue={initial?.parentId ?? ''}
          className="h-11 w-full rounded-control border border-line-strong bg-surface px-3 text-sm"
        >
          <option value="">{t('taxonomy.noParent')}</option>
          {parents.map((parent) => (
            <option key={parent.id} value={parent.id}>
              {parent.nameEn} ({parent.level})
            </option>
          ))}
        </select>
      </Field>
      <label className="flex items-center gap-2 text-sm text-ink sm:col-span-2">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={initial?.isActive ?? true}
          className="size-4 rounded border-line-strong"
        />
        {t('taxonomy.active')}
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>
          {t('save')}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          {t('cancel')}
        </Button>
      </div>
    </form>
  );
}

export function FeaturesManager({
  features,
  canDelete,
}: {
  features: readonly FeatureRow[];
  canDelete: boolean;
}) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [editing, setEditing] = useState<string | 'new' | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink">{t('taxonomy.features')}</h2>
        <Button size="sm" onClick={() => setEditing('new')}>
          {t('taxonomy.addFeature')}
        </Button>
      </div>

      {editing === 'new' ? (
        <FeatureForm
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      ) : null}

      <ul className="divide-y divide-line rounded-card border border-line bg-surface">
        {features.map((feature) => (
          <li key={feature.id} className="p-4">
            {editing === feature.id ? (
              <FeatureForm
                initial={feature}
                onCancel={() => setEditing(null)}
                onSaved={() => {
                  setEditing(null);
                  router.refresh();
                }}
              />
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">
                    {feature.nameEn}{' '}
                    <span className="font-normal text-ink-muted">/ {feature.nameBg}</span>
                  </p>
                  <p className="text-xs text-ink-subtle">
                    {feature.key} · {feature.category}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setEditing(feature.id)}>
                  {t('edit')}
                </Button>
                {canDelete ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (!window.confirm(t('confirmDelete'))) return;
                      await deleteFeature({ id: feature.id });
                      router.refresh();
                    }}
                  >
                    {t('delete')}
                  </Button>
                ) : null}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FeatureForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial?: FeatureRow;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations('admin');
  const [pending, setPending] = useState(false);

  async function submit(form: FormData) {
    setPending(true);
    const payload = {
      key: String(form.get('key') ?? ''),
      category: String(form.get('category') || 'general'),
      nameBg: String(form.get('nameBg') ?? ''),
      nameEn: String(form.get('nameEn') ?? ''),
      icon: String(form.get('icon') || '') || undefined,
      sortOrder: Number(form.get('sortOrder') || 0),
      isFilterable: form.get('isFilterable') === 'on',
    };
    if (initial) await updateFeature({ id: initial.id, ...payload });
    else await createFeature(payload);
    setPending(false);
    onSaved();
  }

  return (
    <form action={submit} className="grid gap-3 sm:grid-cols-2">
      <Field label={t('taxonomy.key')} htmlFor="key" required>
        <Input id="key" name="key" defaultValue={initial?.key} required />
      </Field>
      <Field label={t('taxonomy.category')} htmlFor="category">
        <Input id="category" name="category" defaultValue={initial?.category ?? 'general'} />
      </Field>
      <Field label={t('taxonomy.nameBg')} htmlFor="nameBg" required>
        <Input id="nameBg" name="nameBg" defaultValue={initial?.nameBg} required />
      </Field>
      <Field label={t('taxonomy.nameEn')} htmlFor="nameEn" required>
        <Input id="nameEn" name="nameEn" defaultValue={initial?.nameEn} required />
      </Field>
      <label className="flex items-center gap-2 text-sm text-ink sm:col-span-2">
        <input
          type="checkbox"
          name="isFilterable"
          defaultChecked={initial?.isFilterable ?? true}
          className="size-4 rounded border-line-strong"
        />
        {t('taxonomy.filterable')}
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>
          {t('save')}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          {t('cancel')}
        </Button>
      </div>
    </form>
  );
}
