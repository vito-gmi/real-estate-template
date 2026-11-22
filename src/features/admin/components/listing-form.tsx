'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Eye, EyeOff, Loader2, Plus, Save } from 'lucide-react';
import { useAction } from 'next-safe-action/hooks';
import { useLocale, useTranslations } from 'next-intl';
import { Controller, useForm, useWatch, type Control, type FieldPath } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, Label } from '@/components/ui/label';
import { Input, Textarea } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Locale } from '@/i18n/routing';
import { formatPrice } from '@/lib/format';
import type { FeatureOption } from '@/server/repositories/features';
import type { LocationNode } from '@/server/repositories/locations';
import {
  conditions,
  constructionTypes,
  currencies,
  dealTypes,
  furnishingTypes,
  heatingTypes,
  listingStatuses,
  propertyKinds,
} from '@/lib/domain/enums';
import { createListing, updateListing } from '../listing-actions';
import { listingFormSchema, type ListingFormInput } from '../listing-schema';
import { MapPicker } from './map-picker';

export type ListingFormProps = {
  readonly listingId?: string;
  readonly defaultValues: ListingFormInput;
  readonly locations: readonly LocationNode[];
  readonly features: readonly FeatureOption[];
  readonly adminBasePath: string;
};

/**
 * The listing editor.
 *
 * Grouped into tabs because a property has roughly fifty fields and a single
 * scrolling column makes it impossible to see what still needs filling in.
 * Validation is the shared Zod schema, so what the form accepts and what the
 * server accepts cannot diverge.
 */
export function ListingForm({
  listingId,
  defaultValues,
  locations,
  features,
  adminBasePath,
}: ListingFormProps) {
  const t = useTranslations('admin');
  const tEnum = useTranslations('enums');
  const tErrors = useTranslations('errors');
  // Field labels are shared with the public detail page: "Year built" should
  // read the same to an agent and to a visitor.
  const tField = useTranslations('listing');
  const tSearch = useTranslations('search');
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<ListingFormInput>({
    resolver: zodResolver(listingFormSchema),
    defaultValues,
    mode: 'onBlur',
  });

  const isEditing = Boolean(listingId);
  const onSaved = {
    onSuccess: ({ data }: { data?: { ok: true; data: { id: string } } | { ok: false; error: { messageKey: string } } }) => {
      if (!data) return;
      if (!data.ok) {
        setServerError(data.error.messageKey);
        return;
      }
      setServerError(null);
      setSaved(true);
      if (!isEditing) {
        router.replace(`${adminBasePath}/${data.data.id}`);
      }
      router.refresh();
      setTimeout(() => setSaved(false), 2500);
    },
    onError: () => setServerError('errors.unexpected'),
  };
  const create = useAction(createListing, onSaved);
  const update = useAction(updateListing, onSaved);
  const action = isEditing ? update : create;

  const districts = locations.filter((node) => node.level === 'district');
  const cities = locations.filter((node) => node.level === 'city');
  const cityNameById = new Map(cities.map((city) => [city.id, city.name]));

  const errors = form.formState.errors;
  const errorFor = (name: FieldPath<ListingFormInput>) => {
    const message = (errors as Record<string, { message?: string } | undefined>)[name]?.message;
    if (typeof message !== 'string') return undefined;
    if (!message.startsWith('admin.')) return message;
    const key = message.slice(6);
    return t.has(key) ? t(key) : message;
  };

  function submit(values: ListingFormInput) {
    setSaved(false);
    if (isEditing && listingId) {
      action.execute({ ...values, id: listingId } as never);
    } else {
      action.execute(values as never);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(submit)} className="space-y-6" noValidate>
      <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-3 border-b border-line bg-surface-muted/95 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6">
        <h1 className="text-lg font-semibold text-ink">
          {isEditing ? t('editListing') : t('newListing')}
        </h1>

        <div className="ml-auto flex items-center gap-2">
          {saved ? (
            <span className="flex items-center gap-1.5 text-sm text-success">
              <Check className="size-4" />
              {t('saved')}
            </span>
          ) : null}
          <Button type="submit" disabled={action.isPending}>
            {action.isPending ? <Loader2 className="animate-spin" /> : <Save />}
            {t('save')}
          </Button>
        </div>
      </div>

      {serverError ? (
        <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
          {tErrors(serverError.replace(/^errors\./, ''))}
        </p>
      ) : null}

      <Tabs defaultValue="basics">
        <TabsList className="flex-wrap">
          <TabsTrigger value="basics">{t('sections.basics')}</TabsTrigger>
          <TabsTrigger value="specs">{t('sections.specs')}</TabsTrigger>
          <TabsTrigger value="location">{t('sections.location')}</TabsTrigger>
          <TabsTrigger value="content">{t('sections.content')}</TabsTrigger>
          <TabsTrigger value="features">{t('sections.features')}</TabsTrigger>
        </TabsList>

        <TabsContent value="basics" className="mt-6">
          <Panel>
            <div className="grid gap-4 sm:grid-cols-3">
              <SelectField
                control={form.control}
                name="dealType"
                label={tSearch('dealType')}
                options={dealTypes.map((value) => ({ value, label: tEnum(`dealType.${value}`) }))}
              />
              <SelectField
                control={form.control}
                name="propertyKind"
                label={tSearch('propertyKind')}
                options={propertyKinds.map((value) => ({
                  value,
                  label: tEnum(`propertyKind.${value}`),
                }))}
              />
              <SelectField
                control={form.control}
                name="status"
                label={t('fields.status')}
                options={listingStatuses.map((value) => ({ value, label: tEnum(`status.${value}`) }))}
              />
            </div>

            <PriceFields form={form} error={errorFor('price')} />

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={tField('video')} htmlFor="videoUrl" className="sm:col-span-2">
                <Input id="videoUrl" type="url" placeholder="https://" {...form.register('videoUrl')} />
              </Field>
            </div>

            <div className="flex flex-wrap gap-6">
              <SwitchField control={form.control} name="isFeatured" label={t('fields.isFeatured')} />
              <SwitchField control={form.control} name="isExclusive" label={t('fields.isExclusive')} />
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="specs" className="mt-6">
          <Panel>
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
              <NumberField form={form} name="area" label={`${tField('totalArea')} (m²)`} />
              <NumberField form={form} name="landArea" label={`${tField('landArea')} (m²)`} />
              <NumberField form={form} name="rooms" label={tField('rooms')} />
              <NumberField form={form} name="bedrooms" label={tField('bedrooms')} />
              <NumberField form={form} name="bathrooms" label={tField('bathrooms')} />
              <NumberField form={form} name="floor" label={tField('floor')} error={errorFor('floor')} />
              <NumberField form={form} name="floorsTotal" label={tSearch('floorMax')} />
              <NumberField form={form} name="yearBuilt" label={tField('yearBuilt')} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SelectField
                control={form.control}
                name="constructionType"
                label={tField('construction')}
                options={constructionTypes.map((value) => ({
                  value,
                  label: tEnum(`construction.${value}`),
                }))}
                allowEmpty
              />
              <SelectField
                control={form.control}
                name="heating"
                label={tField('heating')}
                options={heatingTypes.map((value) => ({ value, label: tEnum(`heating.${value}`) }))}
                allowEmpty
              />
              <SelectField
                control={form.control}
                name="furnishing"
                label={tField('furnishing')}
                options={furnishingTypes.map((value) => ({
                  value,
                  label: tEnum(`furnishing.${value}`),
                }))}
                allowEmpty
              />
              <SelectField
                control={form.control}
                name="condition"
                label={tField('condition')}
                options={conditions.map((value) => ({ value, label: tEnum(`condition.${value}`) }))}
                allowEmpty
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={tField('energyLabel')} htmlFor="energyLabel">
                <Input id="energyLabel" maxLength={4} {...form.register('energyLabel')} />
              </Field>
              <NumberField form={form} name="maintenanceFee" label={tField('maintenanceFee')} />
              <NumberField form={form} name="depositMonths" label={tField('deposit')} />
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="location" className="mt-6">
          <Panel>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                control={form.control}
                name="locationId"
                label={tField('location')}
                error={errorFor('locationId')}
                options={districts.map((district) => ({
                  value: district.id,
                  label: `${cityNameById.get(district.parentId ?? '') ?? ''} — ${district.name}`,
                }))}
              />
              <Field label={t('fields.address')} htmlFor="address">
                <Input id="address" {...form.register('address')} />
              </Field>
            </div>

            <SwitchField
              control={form.control}
              name="hideExactAddress"
              label={t('fields.hideExactAddress')}
            />

            <Controller
              control={form.control}
              name="lat"
              render={({ field: latField }) => (
                <Controller
                  control={form.control}
                  name="lng"
                  render={({ field: lngField }) => (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Lat" htmlFor="lat">
                          <Input
                            id="lat"
                            inputMode="decimal"
                            name={latField.name}
                            ref={latField.ref}
                            value={latField.value ?? ''}
                            onBlur={latField.onBlur}
                            onChange={(event) => {
                              latField.onChange(toNumber(event.target.value));
                            }}
                          />
                        </Field>
                        <Field label="Lng" htmlFor="lng">
                          <Input
                            id="lng"
                            inputMode="decimal"
                            name={lngField.name}
                            ref={lngField.ref}
                            value={lngField.value ?? ''}
                            onBlur={lngField.onBlur}
                            onChange={(event) => {
                              lngField.onChange(toNumber(event.target.value));
                            }}
                          />
                        </Field>
                      </div>
                      <MapPicker
                        lat={toNumber(latField.value)}
                        lng={toNumber(lngField.value)}
                        onChange={(position) => {
                          latField.onChange(position.lat);
                          lngField.onChange(position.lng);
                        }}
                      />
                    </>
                  )}
                />
              )}
            />
          </Panel>
        </TabsContent>

        <TabsContent value="content" className="mt-6">
          <Panel>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-4">
                <Field
                  label={t('fields.titleBg')}
                  htmlFor="titleBg"
                  required
                  error={errorFor('titleBg')}
                >
                  <Input id="titleBg" {...form.register('titleBg')} />
                </Field>
                <Field label={t('fields.descriptionBg')} htmlFor="descriptionBg">
                  <Textarea id="descriptionBg" rows={10} {...form.register('descriptionBg')} />
                </Field>
                <Field
                  label={t('fields.slug')}
                  htmlFor="slugBg"
                  hint="bg"
                >
                  <Input id="slugBg" {...form.register('slugBg')} />
                </Field>
                <Field label={t('fields.metaDescription')} htmlFor="metaDescriptionBg">
                  <Textarea id="metaDescriptionBg" rows={3} {...form.register('metaDescriptionBg')} />
                </Field>
              </div>

              <div className="space-y-4">
                <Field
                  label={t('fields.titleEn')}
                  htmlFor="titleEn"
                  required
                  error={errorFor('titleEn')}
                >
                  <Input id="titleEn" {...form.register('titleEn')} />
                </Field>
                <Field label={t('fields.descriptionEn')} htmlFor="descriptionEn">
                  <Textarea id="descriptionEn" rows={10} {...form.register('descriptionEn')} />
                </Field>
                <Field label={t('fields.slug')} htmlFor="slugEn" hint="en">
                  <Input id="slugEn" {...form.register('slugEn')} />
                </Field>
                <Field label={t('fields.metaDescription')} htmlFor="metaDescriptionEn">
                  <Textarea id="metaDescriptionEn" rows={3} {...form.register('metaDescriptionEn')} />
                </Field>
              </div>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="features" className="mt-6">
          <Panel>
            <Controller
              control={form.control}
              name="featureKeys"
              render={({ field }) => {
                const selected = new Set(field.value ?? []);
                return (
                  <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {features.map((feature) => (
                      <li key={feature.key} className="flex items-center gap-2.5">
                        <Checkbox
                          id={`feature-${feature.key}`}
                          checked={selected.has(feature.key)}
                          onCheckedChange={(checked) => {
                            const next = new Set(selected);
                            if (checked) next.add(feature.key);
                            else next.delete(feature.key);
                            field.onChange([...next]);
                          }}
                        />
                        <Label
                          htmlFor={`feature-${feature.key}`}
                          className="cursor-pointer font-normal text-ink-muted"
                        >
                          {feature.name}
                        </Label>
                      </li>
                    ))}
                  </ul>
                );
              }}
            />
          </Panel>
        </TabsContent>
      </Tabs>
    </form>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6 rounded-card border border-line bg-surface p-5">{children}</div>
  );
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/**
 * Price, shown or hidden.
 *
 * A listing starts as "price on request". "Set price" reveals the inputs;
 * "Hide price" collapses them but keeps the amount in the form, so it is saved
 * and comes back when the price is shown again. The input is unmounted rather
 * than `disabled`, because React Hook Form submits disabled fields as
 * `undefined`, which would erase the stored price.
 */
function PriceFields({
  form,
  error,
}: {
  form: ReturnType<typeof useForm<ListingFormInput>>;
  error?: string;
}) {
  const t = useTranslations('admin');
  const tListing = useTranslations('listing');
  const locale = useLocale() as Locale;
  const [showPrice, price, currency] = useWatch({
    control: form.control,
    name: ['showPrice', 'price', 'currency'],
  });
  // Focus the input only when an agent just asked for it, not on page load.
  const [justShown, setJustShown] = useState(false);

  const stored = toNumber(typeof price === 'string' ? price.replace(/\s/g, '') : price);
  const hasStoredPrice = stored !== undefined && stored > 0;

  function setShown(next: boolean) {
    form.setValue('showPrice', next, { shouldDirty: true });
    if (!next) form.clearErrors('price');
    setJustShown(next);
  }

  if (!showPrice) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-dashed border-line-strong px-4 py-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-ink">{t('fields.price')}</p>
          <p className="text-sm text-ink-muted">
            {hasStoredPrice ? (
              <>
                <span className="text-ink">{formatPrice(locale, stored, currency ?? 'EUR')}</span>
                {' · '}
                {t('price.hiddenStored')}
              </>
            ) : (
              t('price.hiddenEmpty', { label: tListing('priceOnRequest') })
            )}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setShown(true)}>
          {hasStoredPrice ? <Eye /> : <Plus />}
          {hasStoredPrice ? t('price.show') : t('price.set')}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid items-start gap-4 sm:grid-cols-3">
      <Field label={t('fields.price')} htmlFor="price" required error={error}>
        <Input
          id="price"
          inputMode="decimal"
          autoFocus={justShown}
          {...form.register('price')}
        />
      </Field>
      <SelectField
        control={form.control}
        name="currency"
        label={t('fields.currency')}
        options={currencies.map((value) => ({ value, label: value }))}
      />
      <div className="sm:pt-7">
        <Button type="button" variant="ghost" size="md" onClick={() => setShown(false)}>
          <EyeOff />
          {t('price.hide')}
        </Button>
      </div>
    </div>
  );
}

function NumberField({
  form,
  name,
  label,
  error,
}: {
  form: ReturnType<typeof useForm<ListingFormInput>>;
  name: FieldPath<ListingFormInput>;
  label: string;
  error?: string;
}) {
  return (
    <Field label={label} htmlFor={name} error={error}>
      <Input id={name} inputMode="decimal" {...form.register(name)} />
    </Field>
  );
}

function SelectField({
  control,
  name,
  label,
  options,
  allowEmpty = false,
  error,
}: {
  control: Control<ListingFormInput>;
  name: FieldPath<ListingFormInput>;
  label: string;
  options: readonly { value: string; label: string }[];
  allowEmpty?: boolean;
  error?: string;
}) {
  const EMPTY = '__none__';
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Field label={label} htmlFor={name} error={error}>
          <Select
            value={(field.value as string | undefined) ?? (allowEmpty ? EMPTY : undefined)}
            onValueChange={(value) => field.onChange(value === EMPTY ? undefined : value)}
          >
            <SelectTrigger id={name}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allowEmpty ? <SelectItem value={EMPTY}>—</SelectItem> : null}
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
    />
  );
}

function SwitchField({
  control,
  name,
  label,
}: {
  control: Control<ListingFormInput>;
  name: FieldPath<ListingFormInput>;
  label: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="flex items-center gap-3">
          <Switch
            id={name}
            checked={Boolean(field.value)}
            onCheckedChange={(checked) => field.onChange(checked)}
          />
          <Label htmlFor={name} className="cursor-pointer font-normal">
            {label}
          </Label>
        </div>
      )}
    />
  );
}
