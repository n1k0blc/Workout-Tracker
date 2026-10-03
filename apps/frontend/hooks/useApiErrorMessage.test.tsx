// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { ERROR_CODES } from '../../backend/src/common/errors/error-codes';
import { ApiError } from '@/lib/api/errors';
import { useApiErrorMessage } from './useApiErrorMessage';
import deMessages from '@/messages/de.json';
import enMessages from '@/messages/en.json';

function messageFor(locale: 'de' | 'en', error: unknown, fallback?: string) {
  const messages = locale === 'de' ? deMessages : enMessages;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
  return renderHook(() => useApiErrorMessage(), { wrapper }).result.current(error, fallback);
}

afterEach(() => vi.restoreAllMocks());

describe('useApiErrorMessage — codes', () => {
  it('shows the catalogue text in the active locale, never the API message', () => {
    const error = new ApiError('Cycle not found', 404, 'CYCLE_NOT_FOUND');
    expect(messageFor('en', error)).toBe('Cycle not found.');
    expect(messageFor('de', error)).toBe('Zyklus nicht gefunden.');
  });

  it('has a non-empty message in both locales for every code the API can return', () => {
    for (const code of ERROR_CODES) {
      for (const locale of ['de', 'en'] as const) {
        const text = messageFor(locale, new ApiError('raw backend text', 400, code));
        expect(text, `${code} (${locale})`).not.toBe('raw backend text');
        expect(text.length, `${code} (${locale})`).toBeGreaterThan(0);
      }
    }
  });

  it('falls back to the generic message for an unknown code and logs the gap', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = new ApiError('raw backend text', 500, 'SOMETHING_NEW');

    expect(messageFor('en', error)).toBe('Something went wrong. Please try again.');
    expect(messageFor('de', error)).toBe('Etwas ist schiefgelaufen. Bitte versuche es erneut.');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('SOMETHING_NEW'));
  });

  it('prefers the caller context message over the generic one when the code is unmapped', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = new ApiError('raw', 500);
    expect(messageFor('en', error, 'Could not save the gym.')).toBe('Could not save the gym.');
  });

  it('never leaks the message of a non-API error (network failure, bug)', () => {
    expect(messageFor('en', new TypeError('Failed to fetch'))).toBe(
      'Something went wrong. Please try again.',
    );
    expect(messageFor('en', 'boom', 'Context text')).toBe('Context text');
  });
});

describe('useApiErrorMessage — validation', () => {
  const failed = (errors: { property: string; constraints: string[] }[]) =>
    new ApiError('email must be an email', 400, 'VALIDATION_FAILED', errors);

  it('maps property + constraint, preferring the property-specific entry', () => {
    const error = failed([
      { property: 'email', constraints: ['isEmail'] },
      { property: 'password', constraints: ['minLength'] },
    ]);
    expect(messageFor('en', error)).toBe(
      'Please enter a valid email address. The password must be at least 8 characters long.',
    );
    expect(messageFor('de', error)).toContain('mindestens 8 Zeichen');
  });

  it('falls back to the generic constraint entry, keyed by the last path segment', () => {
    const error = failed([{ property: 'items.0.quantity', constraints: ['min'] }]);
    expect(messageFor('en', error)).toBe('The value is too small.');
  });

  it('collapses duplicates and never shows the generated English', () => {
    const error = failed([
      { property: 'a', constraints: ['isInt'] },
      { property: 'b', constraints: ['isInt'] },
    ]);
    expect(messageFor('en', error)).toBe('Please enter a whole number.');
  });

  it('uses the generic validation message when no constraint is mapped, and logs it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = failed([{ property: 'x', constraints: ['customRule'] }]);

    expect(messageFor('en', error)).toBe(
      'Some of your input is invalid. Please check it and try again.',
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('customRule'));
  });
});
