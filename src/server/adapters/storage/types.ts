/**
 * Object storage behind one interface.
 *
 * The application only ever depends on this contract, which is what lets the
 * same codebase run on Cloudflare R2 in production, MinIO on a VPS, or the local
 * filesystem during development — a configuration change, not a code change.
 */
export type PutOptions = {
  readonly contentType: string;
  /** Derivatives are content-hashed, so they can be cached forever. */
  readonly immutable?: boolean;
};

export type PresignedUpload = {
  readonly url: string;
  readonly method: 'PUT';
  readonly headers: Readonly<Record<string, string>>;
  readonly expiresInSeconds: number;
};

export interface StorageAdapter {
  readonly name: string;
  put(key: string, body: Buffer, options: PutOptions): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(keys: readonly string[]): Promise<void>;
  /**
   * Lets the browser upload straight to the bucket. Keeping bytes out of the
   * application server is what makes uploads cheap on serverless hosting.
   */
  createUploadUrl(key: string, contentType: string): Promise<PresignedUpload>;
  /** Public, CDN-facing URL for a stored object. */
  publicUrl(key: string): string;
}
