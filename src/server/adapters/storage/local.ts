import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import { clientEnv } from '@/env';
import type { PresignedUpload, PutOptions, StorageAdapter } from './types';

/** Which local directory an upload URL writes into. */
export type LocalBucket = 'public' | 'private';

/**
 * Filesystem-backed storage for development and for self-hosted deployments
 * that would rather not run a bucket.
 *
 * "Presigned" uploads are routed through the app's own upload endpoint, which
 * validates the signature — the same two-step flow as S3, so no feature code
 * has to know which adapter is active.
 */
export function createLocalStorage(
  rootDir: string,
  options: { readonly bucket?: LocalBucket } = {},
): StorageAdapter {
  // `turbopackIgnore`: the root is a runtime setting, so the bundler cannot
  // scope it; without the hint it traces the whole project into every route
  // that imports storage (same as the /media and upload routes).
  const root = resolve(/* turbopackIgnore: true */ process.cwd(), rootDir);
  const bucketParam = options.bucket === 'private' ? 'bucket=private&' : '';

  /** Refuses keys that would escape the storage root via `..`. */
  function resolveKey(key: string): string {
    const target = resolve(/* turbopackIgnore: true */ root, normalize(key));
    if (target !== root && !target.startsWith(root + sep)) {
      throw new Error(`Refusing to access a path outside the storage root: ${key}`);
    }
    return target;
  }

  return {
    name: 'local',

    async put(key, body, _options: PutOptions) {
      const target = resolveKey(key);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, body);
    },

    async get(key) {
      return readFile(resolveKey(key));
    },

    async remove(keys) {
      await Promise.all(keys.map((key) => rm(resolveKey(key), { force: true })));
    },

    async removePrefix(prefix) {
      const target = resolveKey(prefix);
      // Never the whole store, whatever prefix a caller computes.
      if (target === root) throw new Error('Refusing to remove the storage root.');
      await rm(target, { recursive: true, force: true });
    },

    async createUploadUrl(key, contentType): Promise<PresignedUpload> {
      return {
        url: `/api/uploads/local?${bucketParam}key=${encodeURIComponent(key)}`,
        method: 'PUT',
        headers: { 'content-type': contentType },
        expiresInSeconds: 600,
      };
    },

    publicUrl(key) {
      return `${clientEnv.NEXT_PUBLIC_MEDIA_BASE_URL.replace(/\/$/, '')}/${key}`;
    },
  };
}

export function localStorageRoot(rootDir: string): string {
  return resolve(/* turbopackIgnore: true */ process.cwd(), rootDir);
}

export function joinStorageKey(...parts: string[]): string {
  return join(...parts).split(sep).join('/');
}
