import {
  MAX_UPLOAD_BYTES,
  SUBMISSION_PHOTO_MAX_EDGE,
  SUBMISSION_PHOTO_MIN_EDGE,
} from '@/lib/domain/media';

/**
 * Shrinks a photo in the browser before it is uploaded.
 *
 * A phone photo is 4–8 MB; the same photo at 2560 px on its long edge is a few
 * hundred KB and indistinguishable on a listing page. Doing this on the device
 * makes uploads several times faster on mobile data, and re-encoding through a
 * canvas drops EXIF (GPS included) before the file ever leaves the phone. The
 * server re-checks everything regardless.
 *
 * iPhones hand HEIC photos to a file input already converted to JPEG. A HEIC
 * file picked on a desktop decodes in Safari but not in Chrome, which gets a
 * clear "please export as JPEG" message instead of a silent failure.
 */

export type PrepareErrorCode = 'type' | 'heic' | 'tooSmall' | 'tooLarge';

export class PrepareImageError extends Error {
  constructor(readonly code: PrepareErrorCode) {
    super(code);
  }
}

const JPEG_QUALITY = 0.85;
const HEIC = /\.(heic|heif)$/i;

export type PreparedImage = {
  readonly blob: Blob;
  readonly width: number;
  readonly height: number;
};

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file, { imageOrientation: 'from-image' });
  }
  // Older Safari: an <img> applies EXIF orientation by default.
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  const isHeic = HEIC.test(file.name) || /^image\/hei[cf]/.test(file.type);
  if (!file.type.startsWith('image/') && !isHeic) throw new PrepareImageError('type');

  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await decode(file);
  } catch {
    throw new PrepareImageError(isHeic ? 'heic' : 'type');
  }

  const width = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const height = 'naturalHeight' in source ? source.naturalHeight : source.height;

  try {
    if (Math.min(width, height) < SUBMISSION_PHOTO_MIN_EDGE) {
      throw new PrepareImageError('tooSmall');
    }

    const scale = Math.min(1, SUBMISSION_PHOTO_MAX_EDGE / Math.max(width, height));
    const targetWidth = Math.round(width * scale);
    const targetHeight = Math.round(height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new PrepareImageError('type');

    // JPEG has no transparency; a transparent PNG would otherwise turn black.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, targetWidth, targetHeight);
    context.imageSmoothingQuality = 'high';
    context.drawImage(source, 0, 0, targetWidth, targetHeight);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    );
    // Free the canvas backing store now rather than at the next GC.
    canvas.width = 0;
    canvas.height = 0;

    if (!blob) throw new PrepareImageError('type');
    if (blob.size > MAX_UPLOAD_BYTES) throw new PrepareImageError('tooLarge');

    return { blob, width: targetWidth, height: targetHeight };
  } finally {
    if ('close' in source) source.close();
  }
}

/** PUT with upload progress, which `fetch` cannot report. */
export function putWithProgress(
  url: string,
  headers: Record<string, string>,
  body: Blob,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', url);
    for (const [name, value] of Object.entries(headers)) request.setRequestHeader(name, value);

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new Error(`Upload failed with ${request.status}`));
    request.onerror = () => reject(new Error('Upload failed'));
    request.onabort = () => reject(new DOMException('Aborted', 'AbortError'));

    signal?.addEventListener('abort', () => request.abort(), { once: true });
    request.send(body);
  });
}
