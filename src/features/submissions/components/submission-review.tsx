'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  Check,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Maximize2,
  Save,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SubmissionStatus } from '@/lib/domain/enums';
import { cn } from '@/lib/utils';
import {
  approveSubmission,
  deleteSubmission,
  importSubmissionPhoto,
  markSubmissionSpam,
  rejectSubmission,
  saveSubmissionNote,
} from '../admin-actions';

/**
 * The reviewer's side of a submission: choose photos, then approve (creates a
 * draft listing and copies the chosen photos), reject or mark as spam.
 *
 * Photo copying is driven from here one photo per request, with progress, so
 * thirty photos never hit a serverless timeout and a closed tab can be resumed
 * with "Copy remaining photos".
 */

type ReviewPhoto = {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly imported: boolean;
  readonly purged: boolean;
};

type Props = {
  readonly submission: {
    readonly id: string;
    readonly reference: number;
    readonly status: SubmissionStatus;
    readonly internalNote: string;
    readonly rejectionReason: string | null;
    readonly locationText: string | null;
  };
  readonly photos: readonly ReviewPhoto[];
  readonly locationOptions: readonly { value: string; label: string }[];
  readonly defaultLocationId: string | null;
  readonly notifyDefaults: { readonly approve: boolean; readonly reject: boolean };
  readonly canDelete: boolean;
  readonly canReview: boolean;
  readonly listing: { readonly href: string; readonly label: string } | null;
  readonly listingBasePath: string;
  readonly queuePath: string;
  readonly taxonomyPath: string;
  readonly details: React.ReactNode;
  readonly contact: React.ReactNode;
  readonly history: React.ReactNode;
};

const photoUrl = (id: string, full = false) =>
  `/api/admin/submission-photos/${id}${full ? '?size=full' : ''}`;

export function SubmissionReview(props: Props) {
  const { submission, photos } = props;
  const t = useTranslations('admin.submissions');
  const tRoot = useTranslations();
  const router = useRouter();

  const available = photos.filter((photo) => !photo.purged);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(available.filter((photo) => !photo.imported).map((photo) => photo.id)),
  );
  const [viewing, setViewing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; failed: number } | null>(null);

  const isOpen = submission.status === 'pending' || submission.status === 'rejected';
  const remaining = available.filter((photo) => !photo.imported && selected.has(photo.id));
  const message = (key: string | undefined) =>
    key && tRoot.has(key) ? tRoot(key) : tRoot('errors.unexpected');

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Approve (or resume), then copy the chosen photos one by one. */
  async function approveAndImport(locationId: string | undefined, notify: boolean) {
    setBusy(true);
    setError(null);
    const ordered = available.filter((photo) => selected.has(photo.id)).map((photo) => photo.id);

    const approved = await approveSubmission({
      id: submission.id,
      locationId,
      photoIds: ordered,
      notify,
    }).catch(() => null);

    if (!approved?.data?.ok) {
      setBusy(false);
      setError(message(approved?.data && !approved.data.ok ? approved.data.error.messageKey : undefined));
      return;
    }

    const { listingId, photoIds } = approved.data.data;
    let failed = 0;
    setProgress({ done: 0, total: photoIds.length, failed: 0 });
    for (const [index, photoId] of photoIds.entries()) {
      const result = await importSubmissionPhoto({ submissionId: submission.id, photoId }).catch(() => null);
      if (!result?.data?.ok) failed += 1;
      setProgress({ done: index + 1, total: photoIds.length, failed });
    }

    if (failed > 0) {
      // Stay here so the reviewer can see what failed and retry.
      setBusy(false);
      setError(t('importFailed', { count: failed }));
      router.refresh();
      return;
    }
    router.push(`${props.listingBasePath}/${listingId}`);
  }

  async function run(action: () => Promise<{ data?: { ok: boolean } } | undefined | null>, then?: () => void) {
    setBusy(true);
    setError(null);
    const result = await action().catch(() => null);
    setBusy(false);
    if (result?.data?.ok) {
      if (then) then();
      else router.refresh();
    } else {
      const failure = result?.data as { ok: false; error?: { messageKey: string } } | undefined;
      setError(message(failure?.error?.messageKey));
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <section className="rounded-card border border-line bg-surface p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold text-ink">{t('sections.photos', { count: photos.length })}</h2>
            {isOpen && available.length > 0 ? (
              <p className="text-xs text-ink-subtle">{t('photosHint')}</p>
            ) : null}
          </div>

          {photos.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">{t('noPhotos')}</p>
          ) : available.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">{t('photosPurged')}</p>
          ) : (
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {available.map((photo, index) => {
                const checked = selected.has(photo.id);
                return (
                  <li
                    key={photo.id}
                    className={cn(
                      'relative overflow-hidden rounded-card border bg-surface-sunken',
                      checked || photo.imported ? 'border-brand' : 'border-line opacity-60',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setViewing(index)}
                      className="group block w-full"
                      aria-label={t('viewPhoto', { index: index + 1 })}
                    >
                      <img
                        src={photoUrl(photo.id)}
                        alt=""
                        loading="lazy"
                        className="aspect-[4/3] w-full object-cover"
                      />
                      <span className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-surface/90 text-ink opacity-0 transition-opacity group-hover:opacity-100">
                        <Maximize2 className="size-4" />
                      </span>
                    </button>
                    <div className="flex items-center gap-2 border-t border-line bg-surface px-2.5 py-2 text-xs">
                      {photo.imported ? (
                        <span className="inline-flex items-center gap-1 text-success">
                          <Check className="size-3.5" />
                          {t('imported')}
                        </span>
                      ) : (
                        <>
                          <Checkbox
                            id={`pick-${photo.id}`}
                            checked={checked}
                            disabled={!props.canReview || busy}
                            onCheckedChange={() => toggle(photo.id)}
                          />
                          <Label htmlFor={`pick-${photo.id}`} className="cursor-pointer text-xs font-normal">
                            {t('usePhoto')}
                          </Label>
                        </>
                      )}
                      <span className="ml-auto text-ink-subtle">
                        {photo.width}×{photo.height}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {props.details}
      </div>

      <div className="space-y-6">
        <section className="rounded-card border border-line bg-surface p-5">
          <h2 className="font-semibold text-ink">{t('sections.decision')}</h2>

          {submission.status === 'approved' ? (
            <div className="mt-3 space-y-3 text-sm">
              <p className="flex items-center gap-2 text-success">
                <CheckCircle2 className="size-4" />
                {t('approvedNote')}
              </p>
              {props.listing ? (
                <Button asChild variant="outline" full>
                  <Link href={props.listing.href}>
                    <ExternalLink />
                    {props.listing.label}
                  </Link>
                </Button>
              ) : null}
              {props.canReview && remaining.length > 0 ? (
                <Button
                  full
                  disabled={busy}
                  onClick={() => void approveAndImport(undefined, false)}
                >
                  {busy ? <Loader2 className="animate-spin" /> : null}
                  {t('importRemaining', { count: remaining.length })}
                </Button>
              ) : null}
            </div>
          ) : null}

          {submission.status === 'rejected' && submission.rejectionReason ? (
            <p className="mt-3 rounded-control bg-surface-muted p-3 text-sm text-ink-muted">
              {t('rejectedBecause')}: {submission.rejectionReason}
            </p>
          ) : null}
          {submission.status === 'spam' ? (
            <p className="mt-3 text-sm text-ink-muted">{t('spamNote')}</p>
          ) : null}

          {isOpen && props.canReview ? (
            <div className="mt-4 space-y-2">
              <ApproveDialog
                disabled={busy}
                options={props.locationOptions}
                defaultLocationId={props.defaultLocationId}
                visitorLocation={submission.locationText}
                selectedCount={available.filter((photo) => selected.has(photo.id)).length}
                notifyDefault={props.notifyDefaults.approve}
                taxonomyPath={props.taxonomyPath}
                onConfirm={(locationId, notify) => void approveAndImport(locationId, notify)}
              />
              {submission.status === 'pending' ? (
                <RejectDialog
                  disabled={busy}
                  notifyDefault={props.notifyDefaults.reject}
                  onConfirm={(reason, notify) =>
                    void run(() => rejectSubmission({ id: submission.id, reason, notify }))
                  }
                />
              ) : null}
              <Button
                variant="ghost"
                full
                disabled={busy}
                onClick={() => {
                  if (window.confirm(t('spamConfirm'))) {
                    void run(() => markSubmissionSpam({ id: submission.id }));
                  }
                }}
              >
                <Ban />
                {t('markSpam')}
              </Button>
            </div>
          ) : null}

          {progress ? (
            <div className="mt-4" role="status" aria-live="polite">
              <p className="text-sm text-ink">
                {t('importing', { done: progress.done, total: progress.total })}
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-sunken">
                <div
                  className="h-full bg-brand transition-[width]"
                  style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 100}%` }}
                />
              </div>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="mt-4 rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}

          {props.canDelete ? (
            <div className="mt-5 border-t border-line pt-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-danger hover:bg-danger-soft hover:text-danger"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(t('deleteConfirm'))) {
                    void run(
                      () => deleteSubmission({ id: submission.id }),
                      () => router.push(props.queuePath),
                    );
                  }
                }}
              >
                <Trash2 />
                {t('delete')}
              </Button>
              <p className="mt-1 text-xs text-ink-subtle">{t('deleteHint')}</p>
            </div>
          ) : null}
        </section>

        {props.contact}
        <NoteEditor id={submission.id} initial={submission.internalNote} />
        {props.history}
      </div>

      <PhotoViewer
        photos={available}
        index={viewing}
        onIndex={setViewing}
        labels={{ previous: tRoot('listing.previousImage'), next: tRoot('listing.nextImage'), close: tRoot('common.close') }}
      />
    </div>
  );
}

function ApproveDialog({
  disabled,
  options,
  defaultLocationId,
  visitorLocation,
  selectedCount,
  notifyDefault,
  taxonomyPath,
  onConfirm,
}: {
  disabled: boolean;
  options: readonly { value: string; label: string }[];
  defaultLocationId: string | null;
  visitorLocation: string | null;
  selectedCount: number;
  notifyDefault: boolean;
  taxonomyPath: string;
  onConfirm: (locationId: string, notify: boolean) => void;
}) {
  const t = useTranslations('admin.submissions');
  const tCommon = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [locationId, setLocationId] = useState<string | undefined>(defaultLocationId ?? undefined);
  const [notify, setNotify] = useState(notifyDefault);

  return (
    <>
      <Button full disabled={disabled} onClick={() => setOpen(true)}>
        <CheckCircle2 />
        {t('approve')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent closeLabel={tCommon('close')}>
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">{t('approveTitle')}</DialogTitle>
            <DialogDescription className="text-sm text-ink-muted">{t('approveText')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Field label={t('approveLocation')} htmlFor="approve-location" required>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger id="approve-location">
                  <SelectValue placeholder={t('chooseLocation')} />
                </SelectTrigger>
                <SelectContent>
                  {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {visitorLocation ? (
              <p className="text-sm text-ink-muted">
                {t('visitorWrote')}: <span className="font-medium text-ink">{visitorLocation}</span>{' '}
                ·{' '}
                <Link href={taxonomyPath} className="text-brand hover:underline">
                  {t('addLocation')}
                </Link>
              </p>
            ) : null}

            <p className="text-sm text-ink-muted">{t('approvePhotos', { count: selectedCount })}</p>

            <div className="flex items-center gap-2.5">
              <Checkbox
                id="approve-notify"
                checked={notify}
                onCheckedChange={(checked) => setNotify(checked === true)}
              />
              <Label htmlFor="approve-notify" className="cursor-pointer font-normal">
                {t('notifyOwner')}
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              disabled={!locationId}
              onClick={() => {
                if (!locationId) return;
                setOpen(false);
                onConfirm(locationId, notify);
              }}
            >
              <CheckCircle2 />
              {t('approveConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RejectDialog({
  disabled,
  notifyDefault,
  onConfirm,
}: {
  disabled: boolean;
  notifyDefault: boolean;
  onConfirm: (reason: string | undefined, notify: boolean) => void;
}) {
  const t = useTranslations('admin.submissions');
  const tCommon = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [notify, setNotify] = useState(notifyDefault);

  return (
    <>
      <Button variant="outline" full disabled={disabled} onClick={() => setOpen(true)}>
        <XCircle />
        {t('reject')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent closeLabel={tCommon('close')}>
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">{t('rejectTitle')}</DialogTitle>
            <DialogDescription className="text-sm text-ink-muted">{t('rejectText')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label={t('rejectReason')} htmlFor="reject-reason" hint={t('rejectReasonHint')}>
              <Textarea
                id="reject-reason"
                rows={4}
                maxLength={1000}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </Field>
            <div className="flex items-center gap-2.5">
              <Checkbox
                id="reject-notify"
                checked={notify}
                onCheckedChange={(checked) => setNotify(checked === true)}
              />
              <Label htmlFor="reject-notify" className="cursor-pointer font-normal">
                {t('notifyOwner')}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setOpen(false);
                onConfirm(reason.trim() || undefined, notify);
              }}
            >
              <XCircle />
              {t('rejectConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function NoteEditor({ id, initial }: { id: string; initial: string }) {
  const t = useTranslations('admin.submissions');
  const [note, setNote] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [pending, setPending] = useState(false);

  return (
    <section className="rounded-card border border-line bg-surface p-5">
      <Field label={t('internalNote')} htmlFor="internal-note" hint={t('internalNoteHint')}>
        <Textarea
          id="internal-note"
          rows={4}
          maxLength={4000}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </Field>
      <Button
        className="mt-3"
        size="sm"
        variant="outline"
        disabled={pending || note === saved}
        onClick={async () => {
          setPending(true);
          const result = await saveSubmissionNote({ id, note }).catch(() => null);
          setPending(false);
          if (result?.data?.ok) setSaved(note);
        }}
      >
        {pending ? <Loader2 className="animate-spin" /> : <Save />}
        {note === saved && saved !== initial ? t('noteSaved') : t('saveNote')}
      </Button>
    </section>
  );
}

function PhotoViewer({
  photos,
  index,
  onIndex,
  labels,
}: {
  photos: readonly ReviewPhoto[];
  index: number | null;
  onIndex: (index: number | null) => void;
  labels: { previous: string; next: string; close: string };
}) {
  const photo = index !== null ? photos[index] : undefined;

  return (
    <Dialog open={photo !== undefined} onOpenChange={(open) => (open ? undefined : onIndex(null))}>
      <DialogContent variant="full" closeLabel={labels.close}>
        <DialogTitle className="sr-only">
          {index !== null ? `${index + 1} / ${photos.length}` : ''}
        </DialogTitle>
        {photo ? (
          <div
            className="flex size-full items-center justify-center p-4 sm:p-12"
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft' && index! > 0) onIndex(index! - 1);
              if (event.key === 'ArrowRight' && index! < photos.length - 1) onIndex(index! + 1);
            }}
          >
            <img
              src={photoUrl(photo.id, true)}
              alt=""
              width={photo.width}
              height={photo.height}
              className="max-h-full max-w-full object-contain"
            />
            <button
              type="button"
              onClick={() => onIndex(Math.max(0, index! - 1))}
              disabled={index === 0}
              aria-label={labels.previous}
              className="absolute left-4 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30"
            >
              <ArrowLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => onIndex(Math.min(photos.length - 1, index! + 1))}
              disabled={index === photos.length - 1}
              aria-label={labels.next}
              className="absolute right-4 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30"
            >
              <ArrowRight className="size-5" />
            </button>
            <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/80">
              {index! + 1} / {photos.length}
            </p>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
