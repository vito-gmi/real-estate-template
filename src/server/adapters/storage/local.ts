import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import { clientEnv } from '@/env';
import type { PresignedUpload, PutOptions, StorageAdapter } from './types';

/**
 * Filesystem-backed storage for development and for self-hosted deployments
 * that would rather not run a bucket.
 *
 * "Presigned" uploads are routed through the app's own upload endpoint, which
 * validates the signature — the same two-step flow as S3, so no feature code
 * has to know which adapter is active.
 */
export function createLocalStorage(rootDir: string): StorageAdapter {
  const root = resolve(process.cwd(), rootDir);

  /** Refuses keys that would escape the storage root via `..`. */
  function resolveKey(key: string): string {
    const target = resolve(root, normalize(key));
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

    async createUploadUrl(key, contentType): Promise<PresignedUpload> {
      return {
        url: `/api/uploads/local?key=${encodeURIComponent(key)}`,
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
  return resolve(process.cwd(), rootDir);
}

export function joinStorageKey(...parts: string[]): string {
  return join(...parts).split(sep).join('/');
}
