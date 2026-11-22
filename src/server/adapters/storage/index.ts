import { serverEnv } from '@/env';
import { createLocalStorage } from './local';
import { createS3Storage } from './s3';
import type { StorageAdapter } from './types';

let instance: StorageAdapter | undefined;
let privateInstance: StorageAdapter | undefined;

/** Resolves the configured storage backend once per process. */
export function storage(): StorageAdapter {
  if (!instance) {
    instance =
      serverEnv.STORAGE_DRIVER === 's3'
        ? createS3Storage()
        : createLocalStorage(serverEnv.LOCAL_STORAGE_DIR);
  }
  return instance;
}

/**
 * Whether files nobody has reviewed yet have somewhere private to go.
 *
 * The public bucket is served whole from its media domain, so an upload there
 * is world-readable the moment it lands. Features that accept files from the
 * public (property submissions) stay off until a private bucket exists.
 */
export function isPrivateStorageConfigured(): boolean {
  return serverEnv.STORAGE_DRIVER === 'local' || Boolean(serverEnv.S3_PRIVATE_BUCKET);
}

/**
 * Storage for unreviewed uploads: a separate, non-public bucket (or a local
 * directory that `/media` never serves). Objects here are only ever read by
 * the server — staff see them through an authenticated route.
 */
export function privateStorage(): StorageAdapter {
  if (!isPrivateStorageConfigured()) {
    throw new Error('S3_PRIVATE_BUCKET is required for private uploads when STORAGE_DRIVER is "s3".');
  }
  if (!privateInstance) {
    privateInstance =
      serverEnv.STORAGE_DRIVER === 's3'
        ? createS3Storage(serverEnv.S3_PRIVATE_BUCKET)
        : createLocalStorage(serverEnv.LOCAL_PRIVATE_STORAGE_DIR, { bucket: 'private' });
  }
  return privateInstance;
}

export type { StorageAdapter, PresignedUpload, PutOptions } from './types';
export { createLocalStorage } from './local';
export { createS3Storage } from './s3';
