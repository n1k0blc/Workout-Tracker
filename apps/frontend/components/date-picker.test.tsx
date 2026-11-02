// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import deMessages from '@/messages/de.json';
import enMessages from '@/messages/en.json';
import { DatePicker } from './date-picker';

afterEach(cleanup);

function renderPicker(locale: 'de' | 'en', placeholder?: string) {
  render(
    <NextIntlClientProvider locale={locale} messages={locale === 'de' ? deMessages : enMessages}>
      <DatePicker date={null} onSelect={() => {}} placeholder={placeholder} id="d" />
    </NextIntlClientProvider>,
  );
  return document.getElementById('d') as HTMLInputElement;
}

describe('DatePicker placeholder', () => {
  it('comes from the message catalogue in the user language', () => {
    expect(renderPicker('de').placeholder).toBe('TT.MM.JJJJ');
    cleanup();
    expect(renderPicker('en').placeholder).toBe('MM/DD/YYYY');
  });

  it('is overridden by the caller', () => {
    expect(renderPicker('de', 'Beginn').placeholder).toBe('Beginn');
  });
});

describe('DatePicker latest date', () => {
  it("is the user's local today, not the UTC day", () => {
    const input = renderPicker('de');
    const now = new Date();
    const local = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(input.max).toBe(local);
  });
});
