// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { ApiError } from '@/lib/api/errors';
import deMessages from '@/messages/de.json';
import enMessages from '@/messages/en.json';

const notify = vi.hoisted(() => ({ error: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn() }));
vi.mock('@/lib/toast', () => ({ notify }));

import { FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useFormErrors } from './useFormErrors';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** A two-field form that submits whatever `outcome` says: client constraints or an API failure. */
function Harness({
  outcome,
  codeFields,
}: {
  outcome: () => { constraints?: Record<string, string | null>; error?: unknown };
  codeFields?: Record<string, string>;
}) {
  const [form, formRef] = useFormErrors({ fields: ['email', 'password'], codeFields });
  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const { constraints, error } = outcome();
        if (constraints) form.setConstraints(constraints);
        if (error) form.showApiError(error);
      }}
    >
      <Input aria-label="email" {...form.fieldProps('email')} onChange={() => form.clear('email')} />
      <FieldError id={form.errorId('email')}>{form.errors.email}</FieldError>
      <Input aria-label="password" {...form.fieldProps('password')} />
      <FieldError id={form.errorId('password')}>{form.errors.password}</FieldError>
      <button type="submit">go</button>
    </form>
  );
}

function renderForm(props: Parameters<typeof Harness>[0], locale: 'en' | 'de' = 'en') {
  render(
    <NextIntlClientProvider locale={locale} messages={locale === 'en' ? enMessages : deMessages}>
      <Harness {...props} />
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByText('go'));
}

describe('useFormErrors — client constraints', () => {
  it('shows the catalogue text under each invalid field, in the user language', () => {
    renderForm({ outcome: () => ({ constraints: { email: 'isEmail', password: 'minLength' } }) }, 'de');

    expect(screen.getAllByRole('alert').map((a) => a.textContent)).toEqual([
      'Bitte gib eine gültige E-Mail-Adresse ein.',
      expect.stringContaining('mindestens 8 Zeichen'),
    ]);
  });

  it('marks invalid fields with aria-invalid and points them at their message', () => {
    renderForm({ outcome: () => ({ constraints: { email: 'isEmail', password: null } }) });

    const email = screen.getByLabelText('email');
    expect(email.getAttribute('aria-invalid')).toBe('true');
    expect(email.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id);
    expect(screen.getByLabelText('password').getAttribute('aria-invalid')).toBeNull();
  });

  it('moves focus to the first invalid field in the form', () => {
    renderForm({ outcome: () => ({ constraints: { password: 'minLength', email: 'isEmail' } }) });

    expect(document.activeElement).toBe(screen.getByLabelText('email'));
  });

  it('clears one field error when that field is edited', () => {
    renderForm({ outcome: () => ({ constraints: { email: 'isEmail', password: 'minLength' } }) });

    fireEvent.change(screen.getByLabelText('email'), { target: { value: 'x' } });

    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByLabelText('email').getAttribute('aria-invalid')).toBeNull();
  });

  it('shows nothing when every constraint passes', () => {
    renderForm({ outcome: () => ({ constraints: { email: null, password: null } }) });

    expect(screen.queryByRole('alert')).toBeNull();
    expect(notify.error).not.toHaveBeenCalled();
  });
});

describe('useFormErrors — server failures', () => {
  it('puts a validation failure under its field and raises no toast', () => {
    const error = new ApiError(400, 'VALIDATION_FAILED', [
      { property: 'email', constraints: ['isEmail'] },
    ]);
    renderForm({ outcome: () => ({ error }) });

    expect(screen.getByRole('alert').textContent).toBe('Please enter a valid email address.');
    expect(screen.getByLabelText('email').getAttribute('aria-invalid')).toBe('true');
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('falls back to a toast when no field matches, including nested payload paths', () => {
    const error = new ApiError(400, 'VALIDATION_FAILED', [
      { property: 'items.0.quantity', constraints: ['min'] },
    ]);
    renderForm({ outcome: () => ({ error }) });

    expect(screen.queryByRole('alert')).toBeNull();
    expect(notify.error).toHaveBeenCalledWith('The value is too small.');
  });

  it('shows the matched part under its field and the rest as a toast', () => {
    const error = new ApiError(400, 'VALIDATION_FAILED', [
      { property: 'email', constraints: ['isEmail'] },
      { property: 'extra', constraints: ['isInt'] },
    ]);
    renderForm({ outcome: () => ({ error }) });

    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(notify.error).toHaveBeenCalledWith('Please enter a whole number.');
  });

  it('maps a configured error code to its field', () => {
    renderForm({
      outcome: () => ({ error: new ApiError(409, 'EMAIL_ALREADY_REGISTERED') }),
      codeFields: { EMAIL_ALREADY_REGISTERED: 'email' },
    });

    expect(screen.getByRole('alert').textContent).toBe(
      'An account with this email address already exists.',
    );
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('toasts any other failure, including a network error', () => {
    renderForm({ outcome: () => ({ error: new ApiError(404, 'CYCLE_NOT_FOUND') }) });
    expect(notify.error).toHaveBeenCalledWith('Cycle not found.');

    cleanup();
    renderForm({ outcome: () => ({ error: new TypeError('Failed to fetch') }) });
    expect(notify.error).toHaveBeenLastCalledWith('Something went wrong. Please try again.');
  });
});
