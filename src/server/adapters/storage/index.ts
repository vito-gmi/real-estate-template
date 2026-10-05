import { serverEnv } from '@/env';
import { createLocalStorage } from './local';
import { createS3Storage } from './s3';
import type { StorageAdapter } from './types';

let instance: StorageAdapter | undefined;

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

export type { StorageAdapter, PresignedUpload, PutOptions } from './types';
export { createLocalStorage } from './local';
export { createS3Storage } from './s3';
