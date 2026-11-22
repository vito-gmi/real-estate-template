import { z } from 'zod';

/**
 * Field parsers shared by every form that describes a property.
 *
 * HTML inputs hand over strings, React Hook Form sometimes hands over numbers,
 * and an empty field must mean "not given" rather than zero. These normalise
 * all three so the admin listing form and the public submission form agree on
 * what a value is.
 */

/** A number that may be blank. Spaces are allowed as thousands separators. */
export const optionalNumber = z
  .union([z.number(), z.string()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === '') return undefined;
    const parsed = typeof value === 'number' ? value : Number(String(value).replace(/\s/g, ''));
    return Number.isFinite(parsed) ? parsed : undefined;
  });

/** Trimmed text where an empty string means "not given". */
export const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === '' ? undefined : value));

/** `optionalText` with a length cap. */
export function optionalTextMax(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === '' ? undefined : value));
}

/** An optional number that, when given, must fall within a range. */
export function boundedNumber(
  min: number,
  max: number,
  { integer = false, message }: { integer?: boolean; message: string },
) {
  return optionalNumber.refine(
    (value) =>
      value === undefined || (value >= min && value <= max && (!integer || Number.isInteger(value))),
    message,
  );
}

/** A select whose empty choice arrives as `''` or `undefined`. */
export const optionalUuid = z
  .union([z.uuid(), z.literal('')])
  .optional()
  .transform((value) => (value ? value : undefined));
