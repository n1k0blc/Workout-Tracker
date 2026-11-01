// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import enMessages from '@/messages/en.json';
import { ApiError } from '@/lib/api/errors';

const { login, notify } = vi.hoisted(() => ({
  login: vi.fn(),
  notify: { error: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn() },
}));

vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ login }) }));
vi.mock('@/lib/toast', () => ({ notify }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import LoginPage from './page';

beforeEach(() => {
  Object.defineProperty(window, 'location', {
    value: { href: '' },
    writable: true,
    configurable: true,
  });
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <LoginPage />
    </NextIntlClientProvider>,
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

describe('LoginPage', () => {
  it('has no browser validation and shows field errors inline instead', () => {
    expect(document.querySelector('form')!.noValidate).toBe(true);

    submit();

    expect(screen.getAllByRole('alert').map((a) => a.textContent)).toEqual([
      'Please enter your email address.',
      'Please enter a password.',
    ]);
    expect(document.activeElement).toBe(field('Email address'));
    expect(login).not.toHaveBeenCalled();
  });

  it('shows wrong credentials as a toast', async () => {
    login.mockRejectedValue(new ApiError(401, 'INVALID_CREDENTIALS'));
    fireEvent.change(field('Email address'), { target: { value: 'max@example.com' } });
    fireEvent.change(field('Password'), { target: { value: 'whatever' } });

    submit();

    await waitFor(() => expect(notify.error).toHaveBeenCalledWith('Incorrect email or password.'));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
