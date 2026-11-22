'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Loader2, Send } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Controller,
  useForm,
  useWatch,
  type Control,
  type FieldPath,
  type Resolver,
} from 'react-hook-form';
import { Turnstile, type TurnstileHandle } from '@/components/turnstile';
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
import type { Locale } from '@/i18n/routing';
import {
  conditions,
  constructionTypes,
  currencies,
  dealTypes,
  furnishingTypes,
  hasIndoorArea,
  heatingTypes,
  propertyKinds,
  submitterRoles,
  type DealType,
  type PropertyKind,
} from '@/lib/domain/enums';
import { cn } from '@/lib/utils';
import { startSubmission, submitSubmission } from '../actions';
import { submissionSchema, type SubmissionInput, type SubmissionValues } from '../schema';
import { PhotoUploader, type PhotoState } from './photo-uploader';

/**
 * The public "list your property" form.
 *
 * One page in four numbered sections rather than a multi-step wizard: nothing
 * is lost on a refresh between steps, a visitor can see everything that will
 * be asked up front, and photos upload in the background while the rest is
 * typed. Fields follow the property type the way the admin editor does (no
 * floors for a plot of land, rental terms only for rentals), and hidden fields
 * are dropped before validation so they can never block a submit.
 */

export type SubmissionFormProps = {
  readonly cities: readonly { id: string; name: string }[];
  readonly districts: readonly { id: string; name: string; cityId: string }[];
  readonly features: readonly { key: string; name: string }[];
  readonly minPhotos: number;
  readonly maxPhotos: number;
  readonly turnstileSiteKey: string | null;
  readonly privacyHref: string;
};

/** Kinds that usually come with a plot whose size matters. */
const PLOT_KINDS: readonly PropertyKind[] = ['house', 'land', 'agricultural', 'hotel', 'industrial'];

const INDOOR_FIELDS = [
  'area',
  'rooms',
  'bedrooms',
  'bathrooms',
  'floor',
  'floorsTotal',
  'yearBuilt',
  'constructionType',
  'heating',
  'furnishing',
] as const;
const RENT_FIELDS = ['maintenanceFee', 'depositMonths', 'availableFrom'] as const;

function visibility(kind: PropertyKind | undefined, deal: DealType | undefined) {
  const current = kind ?? 'apartment';
  const indoor = hasIndoorArea(current);
  return {
    indoor,
    plot: PLOT_KINDS.includes(current),
    // A house is the building; which floor it is "on" means nothing.
    floor: indoor && current !== 'house',
    rent: deal === 'rent',
  };
}

/** Drops values of fields the visitor cannot currently see. */
function pruneHidden(values: SubmissionInput, placeMissing: boolean): SubmissionInput {
  const show = visibility(values.propertyKind, values.dealType);
  const next: Record<string, unknown> = { ...values };
  if (!show.indoor) for (const name of INDOOR_FIELDS) next[name] = undefined;
  if (!show.floor) next.floor = undefined;
  if (!show.plot) next.landArea = undefined;
  if (!show.rent) for (const name of RENT_FIELDS) next[name] = undefined;
  if (placeMissing) {
    next.cityId = undefined;
    next.districtId = undefined;
  } else {
    next.locationText = undefined;
  }
  return next as SubmissionInput;
}

export function SubmissionForm({
  cities,
  districts,
  features,
  minPhotos,
  maxPhotos,
  turnstileSiteKey,
  privacyHref,
}: SubmissionFormProps) {
  const t = useTranslations('submit');
  const tRoot = useTranslations();
  const tEnum = useTranslations('enums');
  const tField = useTranslations('listing');
  const locale = useLocale() as Locale;

  const [placeMissing, setPlaceMissing] = useState(false);
  const [photos, setPhotos] = useState<PhotoState>({ photoIds: [], busy: false });
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [reference, setReference] = useState<number | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [captchaFailed, setCaptchaFailed] = useState(false);
  const turnstile = useRef<TurnstileHandle>(null);
  const successRef = useRef<HTMLDivElement>(null);

  const resolver = useMemo<Resolver<SubmissionInput, unknown, SubmissionValues>>(() => {
    const base = zodResolver(submissionSchema);
    return (values, context, options) => base(pruneHidden(values, placeMissing), context, options);
  }, [placeMissing]);

  const form = useForm<SubmissionInput, unknown, SubmissionValues>({
    resolver,
    mode: 'onBlur',
    defaultValues: {
      dealType: 'sale',
      propertyKind: 'apartment',
      currency: 'EUR',
      submitterRole: 'owner',
      featureKeys: [],
      locale,
      description: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      website: '',
    },
  });

  // `?deal=rent` from the "Rent out" buttons preselects the deal.
  useEffect(() => {
    const deal = new URLSearchParams(window.location.search).get('deal');
    if (deal === 'rent' || deal === 'sale') form.setValue('dealType', deal);
  }, [form]);

  // --- Submission handle: created on the first photo, reused afterwards. ---
  const token = useRef<string | null>(null);
  const starting = useRef<Promise<string | null> | null>(null);
  const ensureToken = useCallback((): Promise<string | null> => {
    if (token.current) return Promise.resolve(token.current);
    if (!starting.current) {
      starting.current = startSubmission({ locale })
        .then((result) => {
          if (result?.data?.ok) {
            token.current = result.data.data.token;
            return token.current;
          }
          setServerError(result?.data && !result.data.ok ? result.data.error.messageKey : 'errors.unexpected');
          starting.current = null;
          return null;
        })
        .catch(() => {
          starting.current = null;
          return null;
        });
    }
    return starting.current;
  }, [locale]);

  const onPhotosChange = useCallback((state: PhotoState) => {
    setPhotos(state);
    setPhotoError(null);
  }, []);

  const translate = useCallback(
    (key: string | undefined, values?: Record<string, string | number>) => {
      if (!key) return undefined;
      return tRoot.has(key) ? tRoot(key, values) : key;
    },
    [tRoot],
  );

  const [kind, deal, cityId] = useWatch({
    control: form.control,
    name: ['propertyKind', 'dealType', 'cityId'],
  });
  const show = visibility(kind, deal);
  const cityDistricts = districts.filter((district) => district.cityId === cityId);

  async function onValid(values: SubmissionValues) {
    setServerError(null);
    if (photos.busy) {
      setPhotoError(t('photos.waitForUploads'));
      document.getElementById('section-photos')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    if (photos.photoIds.length < minPhotos) {
      setPhotoError(t('errors.notEnoughPhotos', { min: minPhotos }));
      document.getElementById('section-photos')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    setPending(true);
    try {
      const result = await submitSubmission({
        ...values,
        token: token.current ?? undefined,
        photoIds: photos.photoIds,
        turnstileToken: turnstileToken ?? undefined,
      });
      if (result?.data?.ok) {
        setReference(result.data.data.reference);
        return;
      }
      const error = result?.data && !result.data.ok ? result.data.error : null;
      setServerError(error?.messageKey ?? 'errors.unexpected');
      // Tokens are single-use; the server may have spent this one.
      turnstile.current?.reset();
    } catch {
      setServerError('errors.unexpected');
      turnstile.current?.reset();
    } finally {
      setPending(false);
    }
  }

  function onInvalid() {
    // Take the visitor to the first problem rather than leaving them to hunt.
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    });
  }

  useEffect(() => {
    if (reference !== null) successRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [reference]);

  if (reference !== null) {
    return (
      <div
        ref={successRef}
        role="status"
        className="mx-auto max-w-2xl rounded-card border border-success/40 bg-success-soft p-8 text-center"
      >
        <CheckCircle2 className="mx-auto size-10 text-success" aria-hidden="true" />
        <h2 className="mt-4 text-xl font-semibold text-ink">{t('successTitle')}</h2>
        <p className="mt-2 text-ink-muted">{t('successText', { reference })}</p>
        <p className="mt-1 text-sm text-ink-muted">{t('successEmail')}</p>
      </div>
    );
  }

  const errors = form.formState.errors;
  const errorOf = (name: FieldPath<SubmissionInput>) =>
    translate((errors as Record<string, { message?: string } | undefined>)[name]?.message);
  const notEnoughPhotos = photoError !== null;
  const submitBlocked = pending || (turnstileSiteKey !== null && !turnstileToken);

  return (
    <form
      onSubmit={form.handleSubmit(onValid, onInvalid)}
      noValidate
      aria-label={t('title')}
      className="mx-auto max-w-3xl space-y-6"
    >
      {/* Honeypot: hidden from people, irresistible to naive bots. */}
      <div aria-hidden="true" className="absolute left-[-9999px] top-auto size-px overflow-hidden">
        <label htmlFor="submission-website">Website</label>
        <input id="submission-website" tabIndex={-1} autoComplete="off" {...form.register('website')} />
      </div>

      <Section id="section-property" index={1} title={t('sections.property')}>
        <fieldset>
          <legend className="text-sm font-medium text-ink">{t('fields.dealType')}</legend>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {dealTypes.map((value) => (
              <label
                key={value}
                className="flex cursor-pointer items-center justify-center gap-2 rounded-control border border-line-strong bg-surface px-4 py-3 text-sm font-medium text-ink-muted transition-colors hover:border-ink-subtle has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:checked]:text-brand has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-ring/40"
              >
                <input type="radio" value={value} className="sr-only" {...form.register('dealType')} />
                {t(`fields.deal.${value}`)}
              </label>
            ))}
          </div>
        </fieldset>

        <SelectField
          control={form.control}
          name="propertyKind"
          label={t('fields.propertyKind')}
          required
          options={propertyKinds.map((value) => ({ value, label: tEnum(`propertyKind.${value}`) }))}
        />

        {placeMissing ? (
          <Field
            label={t('fields.locationText')}
            htmlFor="locationText"
            required
            hint={t('fields.locationTextHint')}
            error={errorOf('locationText') ?? errorOf('cityId')}
          >
            <Input
              id="locationText"
              autoComplete="address-level2"
              aria-invalid={Boolean(errors.cityId || errors.locationText)}
              {...form.register('locationText')}
            />
          </Field>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              control={form.control}
              name="cityId"
              label={t('fields.city')}
              required
              placeholder={t('fields.choose')}
              error={errorOf('cityId')}
              options={cities.map((city) => ({ value: city.id, label: city.name }))}
              onChange={() => form.setValue('districtId', undefined)}
            />
            {cityDistricts.length > 0 ? (
              <SelectField
                control={form.control}
                name="districtId"
                label={t('fields.district')}
                allowEmpty
                placeholder={t('fields.notSure')}
                options={cityDistricts.map((district) => ({ value: district.id, label: district.name }))}
              />
            ) : null}
          </div>
        )}
        <div className="flex items-center gap-2.5">
          <Checkbox
            id="placeMissing"
            checked={placeMissing}
            onCheckedChange={(checked) => {
              setPlaceMissing(checked === true);
              form.clearErrors(['cityId', 'locationText']);
            }}
          />
          <Label htmlFor="placeMissing" className="cursor-pointer text-sm font-normal text-ink-muted">
            {t('fields.placeMissing')}
          </Label>
        </div>

        <Field label={t('fields.address')} htmlFor="address" hint={t('fields.addressHint')}>
          <Input id="address" autoComplete="street-address" {...form.register('address')} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label={deal === 'rent' ? t('fields.rentPrice') : t('fields.price')}
            htmlFor="price"
            hint={t('fields.priceHint')}
            error={errorOf('price')}
            className="sm:col-span-2"
          >
            <Input id="price" inputMode="decimal" aria-invalid={Boolean(errors.price)} {...form.register('price')} />
          </Field>
          <SelectField
            control={form.control}
            name="currency"
            label={t('fields.currency')}
            options={currencies.map((value) => ({ value, label: value }))}
          />
        </div>
      </Section>

      <Section id="section-details" index={2} title={t('sections.details')} description={t('sections.detailsHint')}>
        <div className="grid gap-4 sm:grid-cols-3">
          {show.indoor ? (
            <NumberField form={form} name="area" label={`${tField('totalArea')} (m²)`} error={errorOf('area')} />
          ) : null}
          {show.plot ? (
            <NumberField form={form} name="landArea" label={`${tField('landArea')} (m²)`} error={errorOf('landArea')} />
          ) : null}
          {show.indoor ? (
            <>
              <NumberField form={form} name="rooms" label={tField('rooms')} integer error={errorOf('rooms')} />
              <NumberField form={form} name="bedrooms" label={tField('bedrooms')} integer error={errorOf('bedrooms')} />
              <NumberField form={form} name="bathrooms" label={tField('bathrooms')} integer error={errorOf('bathrooms')} />
            </>
          ) : null}
          {show.floor ? (
            <NumberField form={form} name="floor" label={tField('floor')} integer error={errorOf('floor')} />
          ) : null}
          {show.indoor ? (
            <>
              <NumberField
                form={form}
                name="floorsTotal"
                label={t('fields.floorsTotal')}
                integer
                error={errorOf('floorsTotal')}
              />
              <NumberField form={form} name="yearBuilt" label={tField('yearBuilt')} integer error={errorOf('yearBuilt')} />
            </>
          ) : null}
        </div>

        {show.indoor ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              control={form.control}
              name="constructionType"
              label={tField('construction')}
              allowEmpty
              options={constructionTypes.map((value) => ({ value, label: tEnum(`construction.${value}`) }))}
            />
            <SelectField
              control={form.control}
              name="heating"
              label={tField('heating')}
              allowEmpty
              options={heatingTypes.map((value) => ({ value, label: tEnum(`heating.${value}`) }))}
            />
            <SelectField
              control={form.control}
              name="furnishing"
              label={tField('furnishing')}
              allowEmpty
              options={furnishingTypes.map((value) => ({ value, label: tEnum(`furnishing.${value}`) }))}
            />
            <SelectField
              control={form.control}
              name="condition"
              label={tField('condition')}
              allowEmpty
              options={conditions.map((value) => ({ value, label: tEnum(`condition.${value}`) }))}
            />
          </div>
        ) : (
          <SelectField
            control={form.control}
            name="condition"
            label={tField('condition')}
            allowEmpty
            options={conditions.map((value) => ({ value, label: tEnum(`condition.${value}`) }))}
          />
        )}

        {show.rent ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField
              form={form}
              name="maintenanceFee"
              label={`${tField('maintenanceFee')} (${tField('monthly')})`}
              error={errorOf('maintenanceFee')}
            />
            <NumberField
              form={form}
              name="depositMonths"
              label={t('fields.depositMonths')}
              integer
              error={errorOf('depositMonths')}
            />
            <Field label={tField('availableFrom')} htmlFor="availableFrom" error={errorOf('availableFrom')}>
              <Input id="availableFrom" type="date" {...form.register('availableFrom')} />
            </Field>
          </div>
        ) : null}

        {features.length > 0 ? (
          <fieldset>
            <legend className="text-sm font-medium text-ink">{tField('features')}</legend>
            <Controller
              control={form.control}
              name="featureKeys"
              render={({ field }) => {
                const selected = new Set(field.value ?? []);
                return (
                  <ul className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
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
          </fieldset>
        ) : null}
      </Section>

      <Section
        id="section-photos"
        index={3}
        title={t('sections.photos')}
        description={minPhotos > 0 ? t('photos.required', { min: minPhotos }) : t('photos.optional')}
      >
        <PhotoUploader
          ensureToken={ensureToken}
          maxPhotos={maxPhotos}
          onChange={onPhotosChange}
          invalid={notEnoughPhotos}
          describedBy={notEnoughPhotos ? 'photos-error' : undefined}
        />
        {photoError ? (
          <p id="photos-error" role="alert" className="text-sm font-medium text-danger">
            {photoError}
          </p>
        ) : null}

        <Field
          label={t('fields.description')}
          htmlFor="description"
          required
          hint={t('fields.descriptionHint')}
          error={errorOf('description')}
        >
          <Textarea
            id="description"
            rows={7}
            maxLength={4000}
            placeholder={t('fields.descriptionPlaceholder')}
            aria-invalid={Boolean(errors.description)}
            {...form.register('description')}
          />
        </Field>

        <Field
          label={t('fields.externalMediaUrl')}
          htmlFor="externalMediaUrl"
          hint={t('fields.externalMediaHint')}
          error={errorOf('externalMediaUrl')}
        >
          <Input
            id="externalMediaUrl"
            type="url"
            inputMode="url"
            placeholder="https://"
            aria-invalid={Boolean(errors.externalMediaUrl)}
            {...form.register('externalMediaUrl')}
          />
        </Field>
      </Section>

      <Section id="section-contact" index={4} title={t('sections.contact')} description={t('sections.contactHint')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('fields.firstName')} htmlFor="firstName" required error={errorOf('firstName')}>
            <Input
              id="firstName"
              autoComplete="given-name"
              aria-invalid={Boolean(errors.firstName)}
              {...form.register('firstName')}
            />
          </Field>
          <Field label={t('fields.lastName')} htmlFor="lastName" required error={errorOf('lastName')}>
            <Input
              id="lastName"
              autoComplete="family-name"
              aria-invalid={Boolean(errors.lastName)}
              {...form.register('lastName')}
            />
          </Field>
          <Field label={t('fields.email')} htmlFor="email" required error={errorOf('email')}>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              {...form.register('email')}
            />
          </Field>
          <Field label={t('fields.phone')} htmlFor="phone" required error={errorOf('phone')}>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              aria-invalid={Boolean(errors.phone)}
              {...form.register('phone')}
            />
          </Field>
          <SelectField
            control={form.control}
            name="submitterRole"
            label={t('fields.submitterRole')}
            options={submitterRoles.map((value) => ({ value, label: t(`fields.role.${value}`) }))}
          />
          <Field label={t('fields.contactTime')} htmlFor="contactTime">
            <Input
              id="contactTime"
              placeholder={t('fields.contactTimePlaceholder')}
              {...form.register('contactTime')}
            />
          </Field>
        </div>

        <div>
          <div className="flex items-start gap-2.5">
            <Controller
              control={form.control}
              name="consent"
              render={({ field }) => (
                <Checkbox
                  id="consent"
                  checked={field.value === true}
                  onCheckedChange={(checked) => field.onChange(checked === true ? true : undefined)}
                  aria-invalid={Boolean(errors.consent)}
                />
              )}
            />
            <Label htmlFor="consent" className="text-sm font-normal leading-relaxed text-ink-muted">
              {t.rich('fields.consent', {
                link: (chunks) => (
                  <a href={privacyHref} target="_blank" rel="noreferrer" className="text-brand underline">
                    {chunks}
                  </a>
                ),
              })}
            </Label>
          </div>
          {errors.consent ? (
            <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
              {t('errors.consent')}
            </p>
          ) : null}
        </div>

        {turnstileSiteKey ? (
          <Turnstile
            siteKey={turnstileSiteKey}
            action="submit-property"
            language={locale}
            onToken={(value) => {
              setTurnstileToken(value);
              if (value) setCaptchaFailed(false);
            }}
            onError={() => setCaptchaFailed(true)}
            handleRef={turnstile}
          />
        ) : null}
        {captchaFailed ? (
          <p role="alert" className="rounded-control bg-warning-soft px-3 py-2 text-sm text-warning">
            {t('errors.captchaUnavailable')}
          </p>
        ) : null}

        {serverError ? (
          <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
            {translate(serverError, { min: minPhotos }) ?? tRoot('errors.unexpected')}
          </p>
        ) : null}

        <Button type="submit" size="lg" full disabled={submitBlocked}>
          {pending ? <Loader2 className="animate-spin" /> : <Send />}
          {pending ? t('submitting') : t('submit')}
        </Button>
        {photos.busy ? (
          <p className="text-center text-xs text-ink-subtle" aria-live="polite">
            {t('photos.stillUploading')}
          </p>
        ) : null}
      </Section>
    </form>
  );
}

function Section({
  id,
  index,
  title,
  description,
  children,
}: {
  id: string;
  index: number;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-28 rounded-card border border-line bg-surface p-5 sm:p-6"
    >
      <header className="mb-5 flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold text-ink-inverse"
        >
          {index}
        </span>
        <div>
          <h2 id={`${id}-title`} className="text-lg font-semibold text-ink">
            {title}
          </h2>
          {description ? <p className="mt-0.5 text-sm text-ink-muted">{description}</p> : null}
        </div>
      </header>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function NumberField({
  form,
  name,
  label,
  integer = false,
  error,
}: {
  form: ReturnType<typeof useForm<SubmissionInput, unknown, SubmissionValues>>;
  name: FieldPath<SubmissionInput>;
  label: string;
  integer?: boolean;
  error?: string;
}) {
  return (
    <Field label={label} htmlFor={name} error={error}>
      <Input
        id={name}
        inputMode={integer ? 'numeric' : 'decimal'}
        aria-invalid={Boolean(error)}
        {...form.register(name)}
      />
    </Field>
  );
}

const EMPTY = '__none__';

function SelectField({
  control,
  name,
  label,
  options,
  required = false,
  allowEmpty = false,
  placeholder,
  error,
  onChange,
}: {
  control: Control<SubmissionInput, unknown, SubmissionValues>;
  name: FieldPath<SubmissionInput>;
  label: string;
  options: readonly { value: string; label: string }[];
  required?: boolean;
  allowEmpty?: boolean;
  placeholder?: string;
  error?: string;
  onChange?: (value: string | undefined) => void;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Field label={label} htmlFor={name} required={required} error={error}>
          <Select
            value={(field.value as string | undefined) ?? (allowEmpty ? EMPTY : '')}
            onValueChange={(value) => {
              const next = value === EMPTY ? undefined : value;
              field.onChange(next);
              onChange?.(next);
            }}
          >
            <SelectTrigger id={name} aria-invalid={Boolean(error)} className={cn(error && 'border-danger')}>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {allowEmpty ? <SelectItem value={EMPTY}>{placeholder ?? '—'}</SelectItem> : null}
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
