import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { clientEnv, serverEnv } from "@/env";
import type { PresignedUpload, StorageAdapter } from "./types";

const UPLOAD_URL_TTL_SECONDS = 600;

/**
 * S3-compatible storage: Cloudflare R2, AWS S3 or MinIO.
 *
 * R2 is the intended production target because it charges nothing for egress,
 * which matters a great deal for a site whose payload is mostly photographs.
 */
export function createS3Storage(): StorageAdapter {
  const bucket = serverEnv.S3_BUCKET;
  if (!bucket)
    throw new Error('S3_BUCKET is required when STORAGE_DRIVER is "s3".');

  const client = new S3Client({
    region: serverEnv.S3_REGION,
    endpoint: serverEnv.S3_ENDPOINT,
    forcePathStyle: serverEnv.S3_FORCE_PATH_STYLE,
    // AWS SDK v3 defaults to flexible checksums that R2 does not always honour,
    // and that force extra CORS-preflight headers on browser PUTs.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials:
      serverEnv.S3_ACCESS_KEY_ID && serverEnv.S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: serverEnv.S3_ACCESS_KEY_ID,
            secretAccessKey: serverEnv.S3_SECRET_ACCESS_KEY,
          }
        : undefined,
  });

  return {
    name: "s3",

    async put(key, body, options) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: options.contentType,
          CacheControl: options.immutable
            ? "public, max-age=31536000, immutable"
            : "public, max-age=3600",
        }),
      );
    },

    async get(key) {
      const result = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
      );

      const bytes = await result.Body?.transformToByteArray();
      if (!bytes) throw new Error(`Object not found: ${key}`);

      return Buffer.from(bytes);
    },

    async remove(keys) {
      if (keys.length === 0) return;

      // DeleteObjects accepts at most 1000 keys per call.
      for (let index = 0; index < keys.length; index += 1000) {
        const batch = keys.slice(index, index + 1000);
        await client.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
          }),
        );
      }
    },

    async createUploadUrl(key, contentType): Promise<PresignedUpload> {
      const url = await getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          ContentType: contentType,
        }),
        { expiresIn: UPLOAD_URL_TTL_SECONDS },
      );
      return {
        url,
        method: "PUT",
        headers: { "content-type": contentType },
        expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
      };
    },

    publicUrl(key) {
      return `${clientEnv.NEXT_PUBLIC_MEDIA_BASE_URL.replace(/\/$/, "")}/${key}`;
    },
  };
}
