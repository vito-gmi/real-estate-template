'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, CircleAlert, Loader2, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Field, Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { updateSubmissionSettings } from '../actions';
import type { SubmissionSettings } from '../schema';

export function SubmissionSettingsForm({
  initial,
  storageReady,
}: {
  initial: SubmissionSettings;
  storageReady: boolean;
}) {
  const t = useTranslations('admin.settingsPage');
  const tRoot = useTranslations();
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof SubmissionSettings>(key: K, value: SubmissionSettings[K]) => {
    setSaved(false);
    setValues((current) => ({ ...current, [key]: value }));
  };

  async function save() {
    setPending(true);
    setError(null);
    const result = await updateSubmissionSettings(values).catch(() => null);
    setPending(false);
    if (result?.data?.ok) {
      setSaved(true);
      router.refresh();
    } else {
      const key = result?.data && !result.data.ok ? result.data.error.messageKey : 'errors.unexpected';
      setError(tRoot.has(key) ? tRoot(key) : tRoot('errors.unexpected'));
    }
  }

  return (
    <div className="space-y-6">
      <Toggle
        id="submissions-enabled"
        label={t('enabled')}
        hint={t('enabledHint')}
        checked={values.enabled}
        onChange={(checked) => set('enabled', checked)}
      />
      {values.enabled && !storageReady ? (
        <p className="flex items-start gap-2 rounded-control bg-warning-soft px-3 py-2 text-sm text-warning">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {t('storageMissing')}
        </p>
      ) : null}

      <Field label={t('minPhotos')} htmlFor="submissions-min-photos" hint={t('minPhotosHint')} className="max-w-xs">
        <Select
          value={String(values.minPhotos)}
          onValueChange={(value) => set('minPhotos', Number(value))}
        >
          <SelectTrigger id="submissions-min-photos">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 11 }, (_, count) => (
              <SelectItem key={count} value={String(count)}>
                {count === 0 ? t('photosOptional') : t('photoCount', { count })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Toggle
        id="submissions-notify-approve"
        label={t('notifyOnApprove')}
        hint={t('notifyOnApproveHint')}
        checked={values.notifyOnApprove}
        onChange={(checked) => set('notifyOnApprove', checked)}
      />
      <Toggle
        id="submissions-notify-reject"
        label={t('notifyOnReject')}
        hint={t('notifyOnRejectHint')}
        checked={values.notifyOnReject}
        onChange={(checked) => set('notifyOnReject', checked)}
      />

      {error ? (
        <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button onClick={() => void save()} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />}
          {t('save')}
        </Button>
        {saved ? (
          <span role="status" className="flex items-center gap-1.5 text-sm text-success">
            <Check className="size-4" />
            {t('saved')}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Toggle({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <Switch id={id} checked={checked} onCheckedChange={onChange} aria-describedby={`${id}-hint`} />
      <div>
        <Label htmlFor={id} className="cursor-pointer">
          {label}
        </Label>
        <p id={`${id}-hint`} className="mt-0.5 text-sm text-ink-muted">
          {hint}
        </p>
      </div>
    </div>
  );
}
