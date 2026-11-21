import { z } from "zod";

/**
 * Boot-time environment validation.
 *
 * Every variable the app can read is declared here exactly once, so a missing or
 * malformed value fails loudly at startup instead of surfacing as a confusing
 * runtime error three layers deep. Public values are referenced through literal
 * `process.env.NEXT_PUBLIC_*` keys so the bundler can inline them.
 */

const optionalUrl = z
  .url()
  .optional()
  .or(z.literal("").transform(() => undefined));

const serverSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DATABASE_MAX_CONNECTIONS: z.coerce.number().int().positive().default(10),

  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),

  STORAGE_DRIVER: z.enum(["s3", "local"]).default("local"),
  S3_ENDPOINT: optionalUrl,
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.stringbool().default(false),
  LOCAL_STORAGE_DIR: z.string().default(".storage"),

  MAIL_DRIVER: z.enum(["resend", "console"]).default("console"),
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default("Estate <onboarding@resend.dev>"),
  MAIL_TO: z.string().optional(),

  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  /**
   * The ONE request header that carries the real client address. Only a header
   * your edge overwrites on every request is safe; any other can be set by the
   * client to dodge per-IP rate limits.
   *   x-real-ip        Vercel (set by the platform) and the bundled Caddyfile
   *   cf-connecting-ip Cloudflare-proxied, AND the origin only reachable via Cloudflare
   *   x-forwarded-for  a proxy that replaces/appends it (right-most entry is used)
   */
  CLIENT_IP_HEADER: z
    .enum(["x-real-ip", "cf-connecting-ip", "x-forwarded-for"])
    .default("x-real-ip"),

  IP_HASH_SALT: z.string().min(16).default("dev-only-ip-hash-salt-change-me"),
  PREVIEW_TOKEN_SECRET: z
    .string()
    .min(16)
    .default("dev-only-preview-secret-change"),

  SENTRY_DSN: z.string().optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_MEDIA_BASE_URL: z.string().default("/media"),
  NEXT_PUBLIC_MAP_STYLE_URL: z
    .url()
    .default("https://tiles.openfreemap.org/styles/bright"),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
});

const clientValues = {
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_MEDIA_BASE_URL: process.env.NEXT_PUBLIC_MEDIA_BASE_URL,
  NEXT_PUBLIC_MAP_STYLE_URL: process.env.NEXT_PUBLIC_MAP_STYLE_URL,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
};

function stripEmpty<T extends Record<string, unknown>>(values: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([, value]) => value !== undefined && value !== "",
    ),
  ) as Partial<T>;
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
}

const skipValidation =
  process.env.SKIP_ENV_VALIDATION === "1" ||
  process.env.SKIP_ENV_VALIDATION === "true";

const isServer = typeof window === "undefined";

function parseClientEnv() {
  const parsed = clientSchema.safeParse(stripEmpty(clientValues));
  if (!parsed.success) {
    throw new Error(
      `Invalid public environment variables:\n${formatIssues(parsed.error)}`,
    );
  }
  return parsed.data;
}

/**
 * Secrets that sign tokens or salt hashes. In production each must be set
 * explicitly and must not be one of the values published in this repository
 * (`.env.example`, `docker-compose.yml`, the dev defaults above) — anyone can
 * read those, and with them forge upload/preview tokens.
 */
const PRODUCTION_SECRETS = [
  "AUTH_SECRET",
  "IP_HASH_SALT",
  "PREVIEW_TOKEN_SECRET",
] as const;

const PUBLISHED_PLACEHOLDERS = new Set([
  "change-me-to-a-random-48-byte-base64-string-abcdefgh",
  "change-me-random-32-chars-minimum",
  "dev-only-ip-hash-salt-change-me",
  "dev-only-preview-secret-change",
]);

function productionSecretIssues(env: z.infer<typeof serverSchema>): string[] {
  if (env.NODE_ENV !== "production") return [];
  return PRODUCTION_SECRETS.filter((key) => {
    const raw = process.env[key];
    return !raw || PUBLISHED_PLACEHOLDERS.has(raw);
  }).map(
    (key) =>
      `  - ${key}: must be set to a unique random value in production (openssl rand -base64 48)`,
  );
}

function parseServerEnv() {
  if (skipValidation) {
    // Used by lint/typecheck/build steps that never open a socket.
    return serverSchema.partial().parse(stripEmpty(process.env)) as z.infer<
      typeof serverSchema
    >;
  }
  const parsed = serverSchema.safeParse(stripEmpty(process.env));
  if (!parsed.success) {
    throw new Error(
      `Invalid server environment variables:\n${formatIssues(parsed.error)}`,
    );
  }
  const secretIssues = productionSecretIssues(parsed.data);
  if (secretIssues.length > 0) {
    throw new Error(
      `Insecure server environment variables:\n${secretIssues.join("\n")}`,
    );
  }
  return parsed.data;
}

export const clientEnv = parseClientEnv();

/**
 * Server-only configuration. Accessing this from a client component throws, which
 * is the point: it makes credential leakage a build-time failure, not a breach.
 */
export const serverEnv: z.infer<typeof serverSchema> = isServer
  ? parseServerEnv()
  : (new Proxy({} as z.infer<typeof serverSchema>, {
      get() {
        throw new Error(
          "serverEnv is not available in the browser. Use clientEnv instead.",
        );
      },
    }) as z.infer<typeof serverSchema>);

export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;
