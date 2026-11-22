'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  GripVertical,
  ImagePlus,
  Loader2,
  RotateCcw,
  Star,
  Trash2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SUBMISSION_PHOTO_MIN_EDGE } from '@/lib/domain/media';
import { cn } from '@/lib/utils';
import {
  confirmSubmissionPhoto,
  removeSubmissionPhoto,
  requestSubmissionUpload,
} from '../actions';
import { PrepareImageError, prepareImage, putWithProgress } from '../prepare-image';

/**
 * Photo picker for the public submission form.
 *
 * Each photo travels on its own: shrink in the browser, PUT straight to
 * private storage, then the server checks and thumbnails it. Two at a time is
 * enough to keep a phone's connection busy without decoding several 12 MP
 * images in memory at once. A failed photo can be retried or removed without
 * touching the others.
 */

const CONCURRENCY = 2;

type Status = 'queued' | 'preparing' | 'uploading' | 'processing' | 'done' | 'error';

type UploadItem = {
  readonly id: string;
  readonly name: string;
  readonly status: Status;
  readonly progress: number;
  readonly previewUrl: string | null;
  readonly photoId: string | null;
  /** Translation key (`submit.…` or `errors.…`). */
  readonly error: string | null;
};

export type PhotoState = {
  /** Uploaded photos in display order; the first is the cover. */
  readonly photoIds: string[];
  /** True while anything is still being prepared or uploaded. */
  readonly busy: boolean;
};

const PREPARE_ERRORS: Record<PrepareImageError['code'], string> = {
  type: 'submit.photos.errors.type',
  heic: 'submit.photos.errors.heic',
  tooSmall: 'submit.photos.errors.tooSmall',
  tooLarge: 'submit.photos.errors.tooLarge',
};

export function PhotoUploader({
  ensureToken,
  maxPhotos,
  onChange,
  invalid,
  describedBy,
}: {
  ensureToken: () => Promise<string | null>;
  maxPhotos: number;
  onChange: (state: PhotoState) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const t = useTranslations('submit');
  const tRoot = useTranslations();
  const [items, setItems] = useState<UploadItem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const files = useRef(new Map<string, File>());
  const removed = useRef(new Set<string>());
  const controllers = useRef(new Map<string, AbortController>());
  const queue = useRef<string[]>([]);
  const active = useRef(0);

  const patch = useCallback((id: string, next: Partial<UploadItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...next } : item)));
  }, []);

  useEffect(() => {
    onChange({
      photoIds: items.filter((item) => item.status === 'done' && item.photoId).map((item) => item.photoId!),
      busy: items.some((item) => item.status !== 'done' && item.status !== 'error'),
    });
  }, [items, onChange]);

  // Free every preview blob when the form goes away.
  const previews = useRef(new Set<string>());
  useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const run = useCallback(
    async (id: string) => {
      const file = files.current.get(id);
      if (!file || removed.current.has(id)) return;

      patch(id, { status: 'preparing', progress: 0, error: null });

      let prepared;
      try {
        prepared = await prepareImage(file);
      } catch (error) {
        const key = error instanceof PrepareImageError ? PREPARE_ERRORS[error.code] : PREPARE_ERRORS.type;
        patch(id, { status: 'error', error: key });
        return;
      }

      const previewUrl = URL.createObjectURL(prepared.blob);
      previews.current.add(previewUrl);
      patch(id, { previewUrl, status: 'uploading' });

      const token = await ensureToken();
      if (!token) {
        patch(id, { status: 'error', error: 'submit.photos.errors.upload' });
        return;
      }

      const ticket = await requestSubmissionUpload({
        token,
        contentType: prepared.blob.type,
        size: prepared.blob.size,
      }).catch(() => null);
      if (!ticket?.data?.ok) {
        const key = ticket?.data && !ticket.data.ok ? ticket.data.error.messageKey : 'submit.photos.errors.upload';
        patch(id, { status: 'error', error: key });
        return;
      }

      const controller = new AbortController();
      controllers.current.set(id, controller);
      try {
        await putWithProgress(
          ticket.data.data.url,
          ticket.data.data.headers,
          prepared.blob,
          (progress) => patch(id, { progress }),
          controller.signal,
        );
      } catch {
        if (!removed.current.has(id)) patch(id, { status: 'error', error: 'submit.photos.errors.upload' });
        return;
      } finally {
        controllers.current.delete(id);
      }

      patch(id, { status: 'processing', progress: 1 });
      const confirmed = await confirmSubmissionPhoto({ token, uploadKey: ticket.data.data.uploadKey }).catch(
        () => null,
      );
      if (!confirmed?.data?.ok) {
        const key =
          confirmed?.data && !confirmed.data.ok ? confirmed.data.error.messageKey : 'submit.photos.errors.upload';
        patch(id, { status: 'error', error: key });
        return;
      }

      const photoId = confirmed.data.data.id;
      if (removed.current.has(id)) {
        // Removed while the server was still processing it.
        void removeSubmissionPhoto({ token, photoId });
        return;
      }
      patch(id, { status: 'done', photoId });
    },
    [ensureToken, patch],
  );

  const pump = useCallback(
    function pumpQueue() {
      while (active.current < CONCURRENCY && queue.current.length > 0) {
        const id = queue.current.shift()!;
        active.current += 1;
        void run(id).finally(() => {
          active.current -= 1;
          pumpQueue();
        });
      }
    },
    [run],
  );

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setNotice(null);

    const room = maxPhotos - items.filter((item) => item.status !== 'error').length;
    const accepted = Array.from(list).slice(0, Math.max(0, room));
    if (accepted.length < list.length) setNotice(t('photos.limitReached', { max: maxPhotos }));

    const added: UploadItem[] = accepted.map((file) => {
      const id = crypto.randomUUID();
      files.current.set(id, file);
      return { id, name: file.name, status: 'queued', progress: 0, previewUrl: null, photoId: null, error: null };
    });
    if (added.length === 0) return;

    setItems((current) => [...current, ...added]);
    queue.current.push(...added.map((item) => item.id));
    pump();
    if (inputRef.current) inputRef.current.value = '';
  }

  function retry(id: string) {
    patch(id, { status: 'queued', error: null, progress: 0 });
    queue.current.push(id);
    pump();
  }

  async function remove(id: string) {
    const item = items.find((entry) => entry.id === id);
    removed.current.add(id);
    controllers.current.get(id)?.abort();
    queue.current = queue.current.filter((queued) => queued !== id);
    setItems((current) => current.filter((entry) => entry.id !== id));
    files.current.delete(id);
    if (item?.previewUrl) {
      URL.revokeObjectURL(item.previewUrl);
      previews.current.delete(item.previewUrl);
    }
    if (item?.photoId) {
      const token = await ensureToken();
      if (token) void removeSubmissionPhoto({ token, photoId: item.photoId });
    }
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= items.length) return;
    setItems((current) => arrayMove(current, from, to));
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active: dragged, over } = event;
    if (!over || dragged.id === over.id) return;
    const from = items.findIndex((item) => item.id === dragged.id);
    const to = items.findIndex((item) => item.id === over.id);
    if (from !== -1 && to !== -1) move(from, to);
  }

  const done = items.filter((item) => item.status === 'done').length;
  const full = items.filter((item) => item.status !== 'error').length >= maxPhotos;

  return (
    <div className="space-y-4">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles(event.dataTransfer.files);
        }}
        className={cn(
          'rounded-card border-2 border-dashed bg-surface-muted p-6 text-center transition-colors',
          dragging ? 'border-brand bg-brand-soft' : invalid ? 'border-danger' : 'border-line-strong',
        )}
      >
        <ImagePlus className="mx-auto size-7 text-ink-subtle" aria-hidden="true" />
        <p className="mt-2 text-sm font-medium text-ink">{t('photos.dropzone')}</p>
        <p className="mt-1 text-xs text-ink-subtle">
          {t('photos.hint', { max: maxPhotos, min: SUBMISSION_PHOTO_MIN_EDGE })}
        </p>
        <input
          ref={inputRef}
          id="submission-photos"
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          aria-label={t('photos.choose')}
          aria-describedby={describedBy}
          onChange={(event) => addFiles(event.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          disabled={full}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus />
          {t('photos.choose')}
        </Button>
      </div>

      {notice ? (
        <p role="status" className="rounded-control bg-warning-soft px-3 py-2 text-sm text-warning">
          {notice}
        </p>
      ) : null}

      {items.length > 0 ? (
        <>
          <p className="text-xs text-ink-subtle" aria-live="polite">
            {t('photos.summary', { done, total: items.length })} · {t('photos.reorderHint')}
          </p>
          <DndContext
            id="submission-photos-dnd"
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext items={items.map((item) => item.id)} strategy={rectSortingStrategy}>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {items.map((item, index) => (
                  <PhotoTile
                    key={item.id}
                    item={item}
                    index={index}
                    last={index === items.length - 1}
                    errorText={item.error ? translateKey(tRoot, item.error, { min: SUBMISSION_PHOTO_MIN_EDGE }) : null}
                    onMove={move}
                    onRemove={(id) => void remove(id)}
                    onRetry={retry}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </>
      ) : null}
    </div>
  );
}

/** Messages are full keys from the root (`submit.photos.errors.type`, `errors.rateLimited`). */
function translateKey(
  t: ReturnType<typeof useTranslations>,
  key: string,
  values: Record<string, string | number>,
): string {
  return t.has(key) ? t(key, values) : t('errors.unexpected');
}

function PhotoTile({
  item,
  index,
  last,
  errorText,
  onMove,
  onRemove,
  onRetry,
}: {
  item: UploadItem;
  index: number;
  last: boolean;
  errorText: string | null;
  onMove: (from: number, to: number) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const t = useTranslations('submit.photos');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const working = item.status !== 'done' && item.status !== 'error';

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'relative overflow-hidden rounded-card border bg-surface',
        item.status === 'error' ? 'border-danger' : 'border-line',
        isDragging && 'z-10 opacity-80 shadow-pop',
      )}
    >
      <div className="relative aspect-[4/3] bg-surface-sunken">
        {item.previewUrl ? (
          <img src={item.previewUrl} alt="" className="size-full object-cover" />
        ) : null}

        {working ? (
          <div className="absolute inset-0 grid place-items-center bg-surface/70 text-xs font-medium text-ink">
            <span className="flex flex-col items-center gap-1.5">
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              {t(`status.${item.status}`)}
              {item.status === 'uploading' ? ` ${Math.round(item.progress * 100)}%` : null}
            </span>
          </div>
        ) : null}

        {item.status === 'error' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-danger-soft/95 p-3 text-center text-xs text-danger">
            <AlertCircle className="size-5" aria-hidden="true" />
            <span className="line-clamp-2 break-all font-medium">{item.name}</span>
            <span role="alert">{errorText}</span>
          </div>
        ) : null}

        {index === 0 && item.status === 'done' ? (
          <Badge tone="accent" className="absolute left-2 top-2">
            <Star className="size-3" aria-hidden="true" />
            {t('cover')}
          </Badge>
        ) : null}
      </div>

      <div className="flex items-center gap-0.5 border-t border-line p-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="grid size-9 cursor-grab touch-none place-items-center rounded text-ink-subtle hover:bg-surface-muted"
          aria-label={t('dragHandle')}
        >
          <GripVertical className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => onMove(index, index - 1)}
          disabled={index === 0}
          aria-label={t('moveLeft')}
          className="grid size-9 place-items-center rounded text-ink-subtle hover:bg-surface-muted disabled:opacity-30"
        >
          <ArrowLeft className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => onMove(index, index + 1)}
          disabled={last}
          aria-label={t('moveRight')}
          className="grid size-9 place-items-center rounded text-ink-subtle hover:bg-surface-muted disabled:opacity-30"
        >
          <ArrowRight className="size-4" />
        </button>
        {item.status === 'done' && index !== 0 ? (
          <button
            type="button"
            onClick={() => onMove(index, 0)}
            aria-label={t('makeCover')}
            title={t('makeCover')}
            className="grid size-9 place-items-center rounded text-ink-subtle hover:bg-surface-muted"
          >
            <Star className="size-4" />
          </button>
        ) : null}
        {item.status === 'error' ? (
          <button
            type="button"
            onClick={() => onRetry(item.id)}
            aria-label={t('retry')}
            title={t('retry')}
            className="grid size-9 place-items-center rounded text-ink-subtle hover:bg-surface-muted"
          >
            <RotateCcw className="size-4" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          aria-label={t('remove')}
          title={t('remove')}
          className="ml-auto grid size-9 place-items-center rounded text-ink-subtle hover:bg-danger-soft hover:text-danger"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </li>
  );
}
