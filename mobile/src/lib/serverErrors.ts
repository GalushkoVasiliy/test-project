import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

import { ApiError } from '@/api/errors';

/**
 * Copies server validation errors onto the matching form fields. Keys are JSON paths such as
 * "applicantInfo.email"; `prefix` strips the part that is not a field of this form.
 * Returns the messages that did not match any field, so the caller can show them elsewhere.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
  prefix = '',
): string[] {
  if (!(error instanceof ApiError)) {
    return [];
  }

  const unmatched: string[] = [];
  for (const [key, messages] of Object.entries(error.fieldErrors)) {
    const field = (key.startsWith(prefix) ? key.slice(prefix.length) : key) as Path<T>;
    if (fields.includes(field)) {
      setError(field, { type: 'server', message: messages[0] });
    } else {
      unmatched.push(...messages);
    }
  }

  if (!error.isValidation) {
    unmatched.push(error.message);
  }
  return unmatched;
}
