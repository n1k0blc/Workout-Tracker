// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import deMessages from '@/messages/de.json';
import enMessages from '@/messages/en.json';
import { ApiError } from '@/lib/api/errors';

const { register, notify } = vi.hoisted(() => ({
  register: vi.fn(),
  notify: { error: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn() },
}));

vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ register }) }));
vi.mock('@/lib/toast', () => ({ notify }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import RegisterPage from './page';

// A successful registration hard-navigates; jsdom's real setter is a "not implemented" no-op.
beforeEach(() => {
  Object.defineProperty(window, 'location', {
    value: { href: '' },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

type Locale = 'en' | 'de';

function renderPage(locale: Locale = 'en') {
  render(
    <NextIntlClientProvider locale={locale} messages={locale === 'en' ? enMessages : deMessages}>
      <RegisterPage />
    </NextIntlClientProvider>,
  );
}

const label = (text: string) => screen.getByLabelText(text) as HTMLInputElement;
const type = (field: string, value: string) =>
  fireEvent.change(label(field), { target: { value } });

const validStep1: Record<string, string> = {
  'Email address': 'max@example.com',
  Password: 'correct horse',
  'Confirm password': 'correct horse',
  'First name': 'Max',
  'Last name': 'Mustermann',
  'Date of birth': '1990-01-01',
  'Height (cm)': '180',
  'Weight (kg)': '75.5',
};

function fillStep1(overrides: Record<string, string> = {}) {
  for (const [field, value] of Object.entries({ ...validStep1, ...overrides })) type(field, value);
}

const next = () => fireEvent.click(screen.getByRole('button', { name: 'Next' }));
const alerts = () => screen.getAllByRole('alert').map((a) => a.textContent);

describe('RegisterPage — no browser validation', () => {
  it('turns native validation off on both steps', () => {
    renderPage();
    expect(document.querySelector('form')!.noValidate).toBe(true);

    fillStep1();
    next();
    expect(screen.getByText('Step 2 of 2: Your gyms')).toBeTruthy();
    expect(document.querySelector('form')!.noValidate).toBe(true);
  });
});

describe('RegisterPage — step 1 field errors', () => {
  it('shows an inline error under every empty field, in the user language', () => {
    renderPage('de');

    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    expect(alerts()).toEqual([
      'Bitte gib deine E-Mail-Adresse ein.',
      'Bitte gib ein Passwort ein.',
      'Bitte wiederhole dein Passwort.',
      'Bitte gib deinen Vornamen ein.',
      'Bitte gib deinen Nachnamen ein.',
      'Bitte gib dein Geburtsdatum ein.',
      'Bitte gib deine Größe ein.',
      'Bitte gib dein Gewicht ein.',
    ]);
    expect(screen.queryByText('Schritt 2 von 2: Deine Studios')).toBeNull();
  });

  it('marks the invalid fields and focuses the first one', () => {
    renderPage();

    next();

    expect(label('Email address').getAttribute('aria-invalid')).toBe('true');
    expect(label('Weight (kg)').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(label('Email address'));
  });

  it('focuses the first invalid field even when an earlier one is fine', () => {
    renderPage();
    fillStep1({ 'Last name': '' });

    next();

    expect(document.activeElement).toBe(label('Last name'));
    expect(label('First name').getAttribute('aria-invalid')).toBeNull();
  });

  it.each(['Müller', 'José', "O'Brien", 'Anna-Lena', 'Nguyễn'])('accepts the name %s', (name) => {
    renderPage();
    fillStep1({ 'First name': name, 'Last name': name });

    next();

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Step 2 of 2: Your gyms')).toBeTruthy();
  });

  it.each(['Max2', '4711', 'Max@', 'Max_M'])('rejects the name %s', (name) => {
    renderPage();
    fillStep1({ 'First name': name });

    next();

    expect(alerts()).toEqual([
      'Use only letters, spaces, apostrophes, periods and hyphens, starting with a letter.',
    ]);
    expect(label('First name').getAttribute('aria-invalid')).toBe('true');
  });

  it('checks passwords, height, weight and age with the shared limits', () => {
    renderPage();
    fillStep1({
      Password: 'short',
      'Confirm password': 'different',
      'Height (cm)': '99',
      'Weight (kg)': '75.55',
      'Date of birth': '2999-01-01',
    });

    next();

    expect(alerts()).toEqual([
      'The password must be at least 8 characters long.',
      'The passwords do not match.',
      'You must be at least 13 years old.',
      'The height must be at least 100 cm.',
      'Use at most one decimal place.',
    ]);
  });

  it('clears a field error as soon as that field is edited', () => {
    renderPage();
    next();
    expect(screen.getAllByRole('alert')).toHaveLength(8);

    type('Email address', 'max@example.com');

    expect(screen.getAllByRole('alert')).toHaveLength(7);
    expect(label('Email address').getAttribute('aria-invalid')).toBeNull();
  });

  it('gives the number inputs their limits from the rules', () => {
    renderPage();

    expect(label('Height (cm)').min).toBe('100');
    expect(label('Height (cm)').max).toBe('250');
    expect(label('Weight (kg)').min).toBe('30');
    expect(label('Weight (kg)').max).toBe('400');
    expect(label('Weight (kg)').step).toBe('0.1');
  });
});

describe('RegisterPage — step 2 and the server', () => {
  async function toStep2AndSubmit(gym = 'Fit & Fun') {
    renderPage();
    fillStep1();
    next();
    fireEvent.click(screen.getByRole('button', { name: 'Add home gym' }));
    fireEvent.change(screen.getByPlaceholderText('Gym name'), { target: { value: gym } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
  }

  it('sends trimmed values and the gym as typed', async () => {
    register.mockResolvedValue({ locale: 'en' });
    renderPage();
    fillStep1({ 'First name': '  Max  ' });
    next();
    fireEvent.click(screen.getByRole('button', { name: 'Add home gym' }));
    fireEvent.change(screen.getByPlaceholderText('Gym name'), { target: { value: 'Fit & Fun' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(register).toHaveBeenCalled());
    expect(register.mock.calls[0][0]).toMatchObject({
      firstName: 'Max',
      homeGyms: [{ name: 'Fit & Fun' }],
      height: 180,
      weight: 75.5,
    });
  });

  it('asks for a gym with a field error instead of a banner', () => {
    renderPage();
    fillStep1();
    next();

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(alerts()).toEqual(['Please add at least one home gym.']);
    expect(register).not.toHaveBeenCalled();
  });

  it('offers ten gyms and no eleventh', () => {
    renderPage();
    fillStep1();
    next();
    fireEvent.click(screen.getByRole('button', { name: 'Add home gym' }));
    for (let i = 1; i < 10; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'Add another home gym' }));
    }
    expect(screen.getAllByPlaceholderText('Gym name')).toHaveLength(10);
    expect((screen.getByRole('button', { name: 'Add another home gym' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows an invalid gym name under that gym', () => {
    renderPage();
    fillStep1();
    next();
    fireEvent.click(screen.getByRole('button', { name: 'Add home gym' }));
    fireEvent.change(screen.getByPlaceholderText('Gym name'), {
      target: { value: 'a'.repeat(101) },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(alerts()).toEqual(['The name can be at most 100 characters.']);
    expect(screen.getByPlaceholderText('Gym name').getAttribute('aria-invalid')).toBe('true');
    expect(register).not.toHaveBeenCalled();
  });

  it('brings a server validation failure back to its field on step 1', async () => {
    register.mockRejectedValue(
      new ApiError(400, 'VALIDATION_FAILED', [{ property: 'firstName', constraints: ['isPersonName'] }]),
    );
    await toStep2AndSubmit();

    await waitFor(() => expect(screen.getByText('Step 1 of 2: Your details')).toBeTruthy());
    expect(alerts()).toEqual([
      'Use only letters, spaces, apostrophes, periods and hyphens, starting with a letter.',
    ]);
    expect(document.activeElement).toBe(label('First name'));
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('shows an already-registered e-mail under the e-mail field', async () => {
    register.mockRejectedValue(new ApiError(409, 'EMAIL_ALREADY_REGISTERED'));
    await toStep2AndSubmit();

    await waitFor(() => expect(screen.getByText('Step 1 of 2: Your details')).toBeTruthy());
    expect(alerts()).toEqual(['An account with this email address already exists.']);
    expect(label('Email address').getAttribute('aria-invalid')).toBe('true');
  });

  it('shows a server failure that matches no field as a toast', async () => {
    register.mockRejectedValue(new ApiError(500, 'USER_CREATION_FAILED'));
    await toStep2AndSubmit();

    await waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith('Your account could not be created. Please try again.'),
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
