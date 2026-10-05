/**
 * Expected failures travel as values, not exceptions.
 *
 * Use cases return `Result` so callers must acknowledge the failure path; real
 * bugs (a broken query, a null deref) still throw and reach the error boundary.
 */

export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E = AppError> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export const appErrorCodes = [
  'not_found',
  'validation',
  'unauthorized',
  'forbidden',
  'rate_limited',
  'conflict',
  'storage_failure',
  'unexpected',
] as const;

export type AppErrorCode = (typeof appErrorCodes)[number];

export type AppError = {
  readonly code: AppErrorCode;
  /** Translation key the UI can render, e.g. `errors.rateLimited`. */
  readonly messageKey: string;
  readonly details?: Readonly<Record<string, unknown>>;
};

export function appError(
  code: AppErrorCode,
  messageKey: string,
  details?: Record<string, unknown>,
): AppError {
  return { code, messageKey, details };
}

export const errors = {
  notFound: () => appError('not_found', 'errors.notFound'),
  validation: (details?: Record<string, unknown>) =>
    appError('validation', 'errors.validation', details),
  unauthorized: () => appError('unauthorized', 'errors.unauthorized'),
  forbidden: () => appError('forbidden', 'errors.forbidden'),
  rateLimited: (retryAfterSeconds?: number) =>
    appError('rate_limited', 'errors.rateLimited', { retryAfterSeconds }),
  conflict: (messageKey = 'errors.conflict') => appError('conflict', messageKey),
  storage: (messageKey = 'errors.storage') => appError('storage_failure', messageKey),
  unexpected: () => appError('unexpected', 'errors.unexpected'),
} as const;

export function unwrap<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(`Unwrapped a failed Result: ${result.error.code} (${result.error.messageKey})`);
  }
  return result.value;
}
