"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  ArrowRight,
  GripVertical,
  Loader2,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResponsiveImage } from "@/components/media/responsive-image";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
  type MediaVariant,
} from "@/lib/domain/media";
import { cn } from "@/lib/utils";
import {
  attachMedia,
  deleteMedia,
  reorderMedia,
  requestUpload,
} from "@/features/media/actions";

export type ManagedPhoto = {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly blurDataUrl: string | null;
  readonly variants: MediaVariant[];
};

/**
 * Photo manager.
 *
 * Order matters: the first photo becomes the card image everywhere on the site,
 * so reordering is a primary action rather than a hidden setting. Drag-and-drop
 * is supported alongside explicit move buttons — pointer dragging is unusable
 * with a keyboard or a screen reader, and this is a tool people use all day.
 */
export function MediaManager({
  listingId,
  initialPhotos,
}: {
  listingId: string;
  initialPhotos: readonly ManagedPhoto[];
}) {
  const t = useTranslations("admin");
  const [photos, setPhotos] = useState<ManagedPhoto[]>([...initialPhotos]);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const persistOrder = useCallback(
    (ordered: ManagedPhoto[]) => {
      startTransition(async () => {
        await reorderMedia({
          listingId,
          orderedIds: ordered.map((photo) => photo.id),
        });
      });
    },
    [listingId],
  );

  const move = useCallback(
    (from: number, to: number) => {
      if (to < 0 || to >= photos.length) return;
      const ordered = arrayMove(photos, from, to);
      setPhotos(ordered);
      persistOrder(ordered);
    },
    [photos, persistOrder],
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = photos.findIndex((photo) => photo.id === active.id);
    const to = photos.findIndex((photo) => photo.id === over.id);
    if (from === -1 || to === -1) return;
    const ordered = arrayMove(photos, from, to);
    setPhotos(ordered);
    persistOrder(ordered);
  }

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);

    let attachedCount = 0;
    const failures: string[] = [];

    for (const file of Array.from(files)) {
      if (
        !ACCEPTED_IMAGE_TYPES.includes(
          file.type as (typeof ACCEPTED_IMAGE_TYPES)[number],
        )
      ) {
        failures.push(`${file.name}: unsupported type`);
        continue;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        failures.push(`${file.name}: too large`);
        continue;
      }

      setUploading((count) => count + 1);
      try {
        const ticket = await requestUpload({
          listingId,
          contentType: file.type,
          size: file.size,
        });

        if (!ticket?.data?.ok) {
          failures.push(`${file.name}: ${t("media.uploading")}`);
          continue;
        }

        // The bytes go straight to storage; the server only ever sees the key.
        const response = await fetch(ticket.data.data.url, {
          method: "PUT",
          headers: ticket.data.data.headers,
          body: file,
        });

        if (!response.ok) {
          failures.push(`${file.name}: upload failed`);
          continue;
        }

        const attached = await attachMedia({
          listingId,
          uploadKey: ticket.data.data.uploadKey,
          kind: "photo",
        });

        if (attached?.data?.ok) {
          attachedCount += 1;
        } else {
          failures.push(`${file.name}: processing failed`);
        }
      } finally {
        setUploading((count) => count - 1);
      }
    }

    if (inputRef.current) inputRef.current.value = "";

    if (failures.length > 0) {
      setError(failures.join(" · "));
    }

    // Reload once after the whole batch — reloading after the first file used to
    // abort multi-select uploads mid-loop.
    if (attachedCount > 0) {
      window.location.reload();
    }
  }

  async function remove(id: string) {
    if (!window.confirm(t("media.deleteConfirm"))) return;
    const result = await deleteMedia({ id });
    if (result?.data?.ok)
      setPhotos((current) => current.filter((photo) => photo.id !== id));
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void uploadFiles(event.dataTransfer.files);
        }}
        className="rounded-card border-2 border-dashed border-line-strong bg-surface-muted p-8 text-center"
      >
        <Upload className="mx-auto size-6 text-ink-subtle" aria-hidden="true" />
        <p className="mt-3 text-sm font-medium text-ink">
          {t("media.dropzone")}
        </p>
        <p className="mt-1 text-xs text-ink-subtle">
          {t("media.dropzoneHint")}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          multiple
          className="sr-only"
          onChange={(event) => void uploadFiles(event.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => inputRef.current?.click()}
          disabled={uploading > 0}
        >
          {uploading > 0 ? <Loader2 className="animate-spin" /> : <Upload />}
          {uploading > 0 ? t("media.processing") : t("media.dropzone")}
        </Button>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}

      {photos.length > 0 ? (
        <>
          <p className="text-xs text-ink-subtle">{t("media.reorderHint")}</p>
          <DndContext
            id={`listing-media-${listingId}`}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={photos.map((photo) => photo.id)}
              strategy={rectSortingStrategy}
            >
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {photos.map((photo, index) => (
                  <SortablePhoto
                    key={photo.id}
                    photo={photo}
                    index={index}
                    isCover={index === 0}
                    coverLabel={t("media.cover")}
                    moveUpLabel={t("media.moveUp")}
                    moveDownLabel={t("media.moveDown")}
                    deleteLabel={t("media.deleteConfirm")}
                    onMove={move}
                    onRemove={remove}
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

function SortablePhoto({
  photo,
  index,
  isCover,
  coverLabel,
  moveUpLabel,
  moveDownLabel,
  deleteLabel,
  onMove,
  onRemove,
}: {
  photo: ManagedPhoto;
  index: number;
  isCover: boolean;
  coverLabel: string;
  moveUpLabel: string;
  moveDownLabel: string;
  deleteLabel: string;
  onMove: (from: number, to: number) => void;
  onRemove: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: photo.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative overflow-hidden rounded-card border border-line bg-surface",
        isDragging && "z-10 opacity-80 shadow-pop",
      )}
    >
      <ResponsiveImage
        variants={photo.variants}
        width={photo.width}
        height={photo.height}
        blurDataUrl={photo.blurDataUrl}
        alt=""
        sizes="240px"
        className="aspect-[4/3] w-full"
      />

      {isCover ? (
        <Badge tone="accent" className="absolute left-2 top-2">
          <Star className="size-3" />
          {coverLabel}
        </Badge>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-surface/90 p-1.5 backdrop-blur-sm">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="grid size-8 cursor-grab place-items-center rounded text-ink-subtle hover:bg-surface-muted"
          aria-label={moveUpLabel}
        >
          <GripVertical className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => onMove(index, index - 1)}
          aria-label={moveUpLabel}
          className="grid size-8 place-items-center rounded text-ink-subtle hover:bg-surface-muted"
        >
          <ArrowLeft className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => onMove(index, index + 1)}
          aria-label={moveDownLabel}
          className="grid size-8 place-items-center rounded text-ink-subtle hover:bg-surface-muted"
        >
          <ArrowRight className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => onRemove(photo.id)}
          aria-label={deleteLabel}
          className="ml-auto grid size-8 place-items-center rounded text-ink-subtle hover:bg-danger-soft hover:text-danger"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </li>
  );
}
