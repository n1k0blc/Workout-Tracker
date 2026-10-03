// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { useSlotName } from './useSlotName';
import deMessages from '@/messages/de.json';
import enMessages from '@/messages/en.json';

function wrapperFor(locale: 'de' | 'en') {
  const messages = locale === 'de' ? deMessages : enMessages;
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
      </NextIntlClientProvider>
    );
  };
}

const DEFAULTS = [
  ['breakfast', 'Frühstück', 'Breakfast'],
  ['lunch', 'Mittagessen', 'Lunch'],
  ['dinner', 'Abendessen', 'Dinner'],
  ['snacks', 'Snacks', 'Snacks'],
] as const;

describe('useSlotName', () => {
  it.each(DEFAULTS)(
    'renders the %s default from the catalogue in the active locale',
    (seedKey, de, en) => {
      const slot = { name: 'Frühstück', seedKey };
      expect(
        renderHook(() => useSlotName()(slot), { wrapper: wrapperFor('de') }).result.current,
      ).toBe(de);
      expect(
        renderHook(() => useSlotName()(slot), { wrapper: wrapperFor('en') }).result.current,
      ).toBe(en);
    },
  );

  it('keeps a renamed Abschnitt (seedKey null) verbatim in every locale', () => {
    const slot = { name: 'Pre-Workout', seedKey: null };
    expect(
      renderHook(() => useSlotName()(slot), { wrapper: wrapperFor('en') }).result.current,
    ).toBe('Pre-Workout');
    expect(
      renderHook(() => useSlotName()(slot), { wrapper: wrapperFor('de') }).result.current,
    ).toBe('Pre-Workout');
  });

  it('falls back to the stored name for a seedKey the catalogue does not know', () => {
    const slot = { name: 'Frühstück', seedKey: 'brunch' };
    expect(
      renderHook(() => useSlotName()(slot), { wrapper: wrapperFor('en') }).result.current,
    ).toBe('Frühstück');
  });
});
