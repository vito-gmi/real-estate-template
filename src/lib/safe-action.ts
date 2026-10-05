import { createSafeActionClient } from 'next-safe-action';
import { z } from 'zod';
import { appError, type AppError } from './result';

/**
 * Server-action plumbing.
 *
 * Two things matter here. First, validation is declared once as a Zod schema and
 * enforced on the server no matter what the client sent — a form is a hint, not
 * a guarantee. Second, unexpected exceptions are logged in full server-side but
 * reduced to a generic translation key before they cross the wire, so a stack
 * trace or a SQL fragment can never reach a browser.
 */
export const actionClient = createSafeActionClient({
  defineMetadataSchema: () => z.object({ name: z.string() }),
  handleServerError(error, utils) {
    console.error(`[action:${utils.metadata?.name ?? 'unknown'}]`, error);
    return 'errors.unexpected';
  },
});

/** Shape every action resolves to, so the UI has one thing to branch on. */
export type ActionResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: AppError };

export const actionOk = <T>(data: T): ActionResult<T> => ({ ok: true, data });
export const actionErr = (
  code: AppError['code'],
  messageKey: string,
  details?: Record<string, unknown>,
): ActionResult<never> => ({ ok: false, error: appError(code, messageKey, details) });
