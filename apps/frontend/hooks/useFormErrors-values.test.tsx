// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { ApiError } from '@/lib/api/errors';
import { bodyLimits } from '@/lib/field-rules';
import deMessages from '@/messages/de.json';
import enMessages from '@/messages/en.json';

vi.mock('@/lib/toast', () => ({ notify: { error: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn() } }));

import { FieldError } from '@/components/ui/field';
import { useFormErrors } from './useFormErrors';

afterEach(cleanup);

/** A form whose limit messages carry the user's own numbers and unit (#230). */
function Harness({
  system,
  constraint,
  error,
}: {
  system: 'METRIC' | 'IMPERIAL';
  constraint?: string;
  error?: ApiError;
}) {
  const limits = bodyLimits(system);
  const [form] = useFormErrors({ fields: ['height'], messageValues: { height: limits.height } });
  return (
    <>
      <button
        onClick={() => {
          if (constraint) form.setConstraints({ height: constraint });
          if (error) form.showApiError(error);
        }}
      >
        go
      </button>
      <FieldError>{form.errors.height}</FieldError>
    </>
  );
}

function show(props: Parameters<typeof Harness>[0], locale: 'en' | 'de') {
  render(
    <NextIntlClientProvider locale={locale} messages={locale === 'en' ? enMessages : deMessages}>
      <Harness {...props} />
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByText('go'));
}

describe('limit messages in the user\'s unit', () => {
  it('names centimetres for a metric user and inches for an imperial one', () => {
    show({ system: 'METRIC', constraint: 'min' }, 'en');
    expect(screen.getByRole('alert').textContent).toBe('The height must be at least 100 cm.');
    cleanup();
    show({ system: 'IMPERIAL', constraint: 'min' }, 'en');
    expect(screen.getByRole('alert').textContent).toBe('The height must be at least 40 in.');
  });

  it('does the same in German and for the upper limit', () => {
    show({ system: 'IMPERIAL', constraint: 'max' }, 'de');
    expect(screen.getByRole('alert').textContent).toBe('Die Größe darf höchstens 98 in betragen.');
  });

  it('uses the same numbers for a rejection that came back from the server', () => {
    show(
      {
        system: 'IMPERIAL',
        error: new ApiError(400, 'VALIDATION_FAILED', [{ property: 'height', constraints: ['max'] }]),
      },
      'en',
    );
    expect(screen.getByRole('alert').textContent).toBe('The height must be at most 98 in.');
  });
});
