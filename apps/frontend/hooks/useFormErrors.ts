'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api/errors';
import { notify } from '@/lib/toast';
import { useApiErrorMessage, useValidationMessage } from './useApiErrorMessage';

interface Options {
  /**
   * The error keys this form can show under a field. A server `fieldErrors` property that is one
   * of these lands under that field; any other goes to a toast. For a nested payload the key is the
   * full path the server reports (`homeGyms.0.name`), so list the keys the form currently renders.
   */
  fields: string[];
  /** API error codes that belong to one field instead of a toast (`EMAIL_ALREADY_REGISTERED` -> `email`). */
  codeFields?: Record<string, string>;
}

/**
 * Field errors for one form (#222). Wire it up like this:
 *
 *   const [form, formRef] = useFormErrors({ fields: ["email"] });
 *   <form ref={formRef} noValidate onSubmit=...>
 *     <Input id="email" {...form.fieldProps('email')} onChange={() => form.clear('email')} />
 *     <FieldError id={form.errorId('email')}>{form.errors.email}</FieldError>
 *
 *  - Client checks: `form.setConstraints({ email: checkEmail(v), ... })` with the constraint names
 *    from `lib/field-rules.ts` (null = valid). Returns true when nothing is invalid.
 *  - Server failures: `form.showApiError(err)` puts `ApiError.fieldErrors` under their fields and
 *    sends everything it cannot place (unlisted properties, other codes, network errors) to an
 *    error toast. Returns the keys it placed under a field.
 *  - Either way, focus moves to the first `aria-invalid` field in the bound form, in DOM order.
 *
 * `errors` maps a field key to its message in the user's language.
 */
export function useFormErrors({ fields, codeFields = {} }: Options) {
  const validationMessage = useValidationMessage();
  const apiError = useApiErrorMessage();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [focusRequest, setFocusRequest] = useState(0);
  // A callback ref held in state rather than a ref object, so the hook's result can be read
  // during render (react-hooks/refs). Any container works, not only a `<form>`: a dialog or a
  // page section holding the fields is enough.
  const [formElement, bindForm] = useState<HTMLElement | null>(null);

  // Focus after the render that put aria-invalid on the fields.
  useEffect(() => {
    if (focusRequest === 0) return;
    formElement?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [focusRequest, formElement]);

  const setConstraints = useCallback(
    (constraints: Record<string, string | null>): boolean => {
      const next: Record<string, string> = {};
      for (const [key, constraint] of Object.entries(constraints)) {
        if (constraint) {
          next[key] = validationMessage(key, constraint) ?? apiError(undefined);
        }
      }
      setErrors(next);
      if (Object.keys(next).length > 0) setFocusRequest((n) => n + 1);
      return Object.keys(next).length === 0;
    },
    [validationMessage, apiError],
  );

  const showApiError = useCallback(
    (error: unknown): string[] => {
      const placed: Record<string, string> = {};
      const unplaced: string[] = [];

      if (error instanceof ApiError && error.fieldErrors.length > 0) {
        for (const { property, constraints } of error.fieldErrors) {
          const message = constraints
            .map((c) => validationMessage(property, c))
            .find((m) => m !== undefined);
          if (fields.includes(property) && message) placed[property] = message;
          else unplaced.push(message ?? apiError(error));
        }
      } else {
        const field = error instanceof ApiError && error.code ? codeFields[error.code] : undefined;
        if (field && fields.includes(field)) placed[field] = apiError(error);
        else unplaced.push(apiError(error));
      }

      const keys = Object.keys(placed);
      if (keys.length > 0) {
        setErrors((prev) => ({ ...prev, ...placed }));
        setFocusRequest((n) => n + 1);
      }
      if (unplaced.length > 0) notify.error([...new Set(unplaced)].join(' '));
      return keys;
    },
    [fields, codeFields, validationMessage, apiError],
  );

  const clear = useCallback((key: string) => {
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      return Object.fromEntries(Object.entries(prev).filter(([k]) => k !== key));
    });
  }, []);

  const errorId = (key: string) => `${key}-error`;

  /** Spread onto the field: `aria-invalid` and a pointer to its message while it has one. */
  const fieldProps = (key: string) =>
    errors[key]
      ? ({ 'aria-invalid': true, 'aria-describedby': errorId(key) } as const)
      : ({} as const);

  return [{ errors, setConstraints, showApiError, clear, fieldProps, errorId }, bindForm] as const;
}
