// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { usePrefillToast } from './usePrefillToast';
import deMessages from '@/messages/de.json';
import enMessages from '@/messages/en.json';

vi.mock('sonner', () => ({ toast: { info: vi.fn() } }));

function show(locale: 'de' | 'en', info: Parameters<ReturnType<typeof usePrefillToast>>[0]) {
  const messages = locale === 'de' ? deMessages : enMessages;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
  renderHook(() => usePrefillToast(), { wrapper }).result.current(info);
}

const base = {
  performedOn: '2026-08-20',
  gymName: 'Nordgym',
  degraded: null,
  setCountMismatch: false,
  durationMs: 6000,
} as const;

beforeEach(() => vi.clearAllMocks());

describe('usePrefillToast', () => {
  it('words the toast in German with the locale date format', () => {
    show('de', base);
    expect(toast.info).toHaveBeenCalledWith('Werte vom 20.08.2026 (Nordgym) übernommen.', {
      duration: 6000,
    });
  });

  it('words the toast in English', () => {
    show('en', base);
    expect(vi.mocked(toast.info).mock.calls[0][0]).toBe('Values from 08/20/2026 (Nordgym) applied.');
  });

  it('adds the degraded-gym and set-count clauses, and a fallback gym name', () => {
    show('en', {
      ...base,
      gymName: null,
      degraded: 'HOME_GYM',
      setCountMismatch: true,
      durationMs: 10000,
    });
    const [text, options] = vi.mocked(toast.info).mock.calls[0];
    expect(text).toBe(
      'Values from 08/20/2026 (Other gym) applied. No entry for this gym – used another gym. Different number of sets than planned – adjust the sets if needed.',
    );
    expect(options).toEqual({ duration: 10000 });
  });
});
