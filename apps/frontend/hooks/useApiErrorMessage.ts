'use client';

import { useCallback } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { ApiError } from '@/lib/api/errors';
import { weekdayReferenceDate } from '@/lib/weekday';

/**
 * The catalogue text for one broken rule on one field, or undefined when there is none (#222).
 * `property` may be a path (`homeGyms.0.name`); the last segment names the field. Tries the
 * field-specific entry (`validation.password.minLength`) before the generic one
 * (`validation.minLength`). Client checks and server `fieldErrors` both go through this, so the
 * same constraint reads the same on either side.
 */
export function useValidationMessage() {
  const t = useTranslations('ApiErrors');

  return useCallback(
    (
      property: string,
      constraint: string,
      values: Record<string, string | number> = {},
    ): string | undefined => {
      const field = property.split('.').pop() ?? property;
      const params = { property: field, ...values };
      // A message that names a limit (`{min}`, `{max}`, `{unit}`) is used only when the caller
      // supplied those numbers; without them the next, generic entry is the better text than a
      // sentence with a hole in it.
      const key = [`validation.${field}.${constraint}`, `validation.${constraint}`].find(
        (k) =>
          t.has(k) &&
          [...String(t.raw(k)).matchAll(/\{\s*(\w+)\s*[,}]/g)].every((m) => m[1] in params),
      );
      return key ? t(key, params) : undefined;
    },
    [t],
  );
}

/**
 * The user-facing text for a failed API call (#190). The API's own `message` is German/English
 * developer text and is never displayed. A validation failure maps each `property` + constraint
 * name to `ApiErrors.validation`, trying the property-specific entry
 * (`validation.password.minLength`) before the generic one (`validation.minLength`); any other
 * error `code` maps to `ApiErrors.codes.<CODE>` (a validation failure with nothing mappable
 * lands on `codes.VALIDATION_FAILED`). Anything unmapped logs the gap and falls back to the
 * caller's context-specific message, or to `ApiErrors.generic`, so the user never sees a blank
 * or an untranslated string.
 */
export function useApiErrorMessage() {
  const t = useTranslations('ApiErrors');
  const format = useFormatter();
  const validationMessage = useValidationMessage();

  return useCallback(
    (error: unknown, fallback?: string): string => {
      const generic = fallback ?? t('generic');
      if (!(error instanceof ApiError)) return generic;

      if (error.fieldErrors.length > 0) {
        const messages = new Set<string>();
        for (const { property, constraints } of error.fieldErrors) {
          for (const constraint of constraints) {
            const message = validationMessage(property, constraint);
            if (message) messages.add(message);
            else console.warn(`[i18n] no ApiErrors message for ${property} / ${constraint}`);
          }
        }
        if (messages.size > 0) return [...messages].join(' ');
      }

      if (error.code && t.has(`codes.${error.code}`)) {
        // `details` are the message's parameters; a weekday arrives as its number and is named in
        // the user's locale. A code whose parameters did not arrive falls through to the generic.
        const values = { ...error.details };
        if (typeof values.weekday === 'number') {
          values.weekday = format.dateTime(weekdayReferenceDate(values.weekday), {
            weekday: 'long',
            timeZone: 'UTC',
          });
        }
        try {
          return t(`codes.${error.code}`, values);
        } catch {
          console.warn(`[i18n] ApiErrors.codes.${error.code} could not be filled from its details`);
          return generic;
        }
      }

      console.warn(
        `[i18n] no ApiErrors message for status ${error.status} code ${error.code ?? '-'}`,
      );
      return generic;
    },
    [t, format, validationMessage],
  );
}
