// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/messages/de.json';
import { ApiError } from '@/lib/api/errors';

// Radix Select relies on pointer-capture and scroll APIs jsdom doesn't implement.
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

// The language switch does a hard navigation (window.location.href), not the locale-aware
// router -- see the comment on handleLocaleChange in page.tsx for why. jsdom's real
// location.href setter is a no-op ("Not implemented: navigation"), so it must be stubbed
// to make the assignment observable.
beforeEach(() => {
  Object.defineProperty(window, 'location', {
    value: { href: '' },
    writable: true,
    configurable: true,
  });
});

const baseUser = {
  id: 'u1',
  email: 'sam@example.com',
  firstName: 'Sam',
  lastName: 'Lee',
  createdAt: '2026-01-01T00:00:00.000Z',
  locale: 'de' as const,
  unitSystem: 'METRIC' as 'METRIC' | 'IMPERIAL',
};

const { push, logout, updateProfile, getHomeGyms, deleteHomeGym, changePassword } = vi.hoisted(() => ({
  push: vi.fn(),
  logout: vi.fn(),
  updateProfile: vi.fn(),
  getHomeGyms: vi.fn(),
  deleteHomeGym: vi.fn(),
  changePassword: vi.fn(),
}));

const notify = vi.hoisted(() => ({ error: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn() }));
vi.mock('@/lib/toast', () => ({ notify }));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push }),
}));

let currentUser = baseUser;
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: currentUser, logout }),
}));

// Pulled in transitively by LogoutButton, rendered at the bottom of the page.
vi.mock('@/lib/workout-context', () => ({
  useWorkout: () => ({ activeWorkout: null, isPastWorkout: false }),
}));

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    getHomeGyms,
    updateProfile,
    createHomeGym: vi.fn(),
    updateHomeGym: vi.fn(),
    deleteHomeGym,
    changePassword,
  },
}));

updateProfile.mockResolvedValue({ ...baseUser, locale: 'en' });
getHomeGyms.mockResolvedValue([]);

import ProfilePage from './page';

function renderProfilePage() {
  return render(
    <NextIntlClientProvider locale="de" messages={messages}>
      <ProfilePage />
    </NextIntlClientProvider>,
  );
}

/**
 * Locale tracer bullet (#179): the Profil language select is the one UI surface this
 * ticket ships. Every literal in this page also comes from the `Profile` catalogue --
 * rendering it against the real de.json is a regression check that the catalogue has
 * every key the component calls (a missing key throws in next-intl's strict mode).
 */
describe('ProfilePage language select', () => {
  afterEach(() => {
    cleanup();
    updateProfile.mockClear();
    push.mockClear();
    currentUser = baseUser;
  });

  it("shows the user's current locale", async () => {
    renderProfilePage();

    await waitFor(() => expect(screen.getByText('Deutsch')).toBeTruthy());
  });

  it('persists the new locale and navigates to the locale-prefixed profile URL', async () => {
    renderProfilePage();

    const trigger = await screen.findByRole('combobox', { name: 'Sprache' });
    fireEvent.click(trigger);

    const englishOption = await screen.findByText('English');
    fireEvent.click(englishOption);

    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ locale: 'en' }));
    expect(window.location.href).toBe('/en/profile');
    expect(push).not.toHaveBeenCalled();
  });

  it('shows an error and does not navigate when persisting the new locale fails', async () => {
    updateProfile.mockRejectedValueOnce(new Error('network down'));
    renderProfilePage();

    const trigger = await screen.findByRole('combobox', { name: 'Sprache' });
    fireEvent.click(trigger);

    const englishOption = await screen.findByText('English');
    fireEvent.click(englishOption);

    // The context message as a toast, never the raw error text (#190).
    await waitFor(() => expect(notify.error).toHaveBeenCalledWith('Fehler beim Ändern der Sprache'));
    expect(notify.error).not.toHaveBeenCalledWith(expect.stringContaining('network down'));
    expect(window.location.href).toBe('');
    expect(push).not.toHaveBeenCalled();
  });

  it('shows the catalogue text for the API error code instead of the API message', async () => {
    updateProfile.mockRejectedValueOnce(
      new ApiError(409, 'EMAIL_ALREADY_IN_USE'),
    );
    renderProfilePage();

    fireEvent.click(await screen.findByRole('combobox', { name: 'Sprache' }));
    fireEvent.click(await screen.findByText('English'));

    await waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith('Diese E-Mail-Adresse wird bereits verwendet.'),
    );
    expect(notify.error).not.toHaveBeenCalledWith('EMAIL_ALREADY_IN_USE');
  });
});

/**
 * Weight unit system (#186): the Einheiten select persists `unitSystem` independently of the
 * language, and body weight/height display in it. An untouched weight/height must never be
 * written back re-converted -- only a field the user edited is converted (once).
 */
describe('ProfilePage unit system', () => {
  const reload = vi.fn();
  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: { href: '', reload },
      writable: true,
      configurable: true,
    });
  });
  afterEach(() => {
    cleanup();
    updateProfile.mockClear();
    reload.mockClear();
    currentUser = baseUser;
  });

  it('persists unitSystem without touching locale', async () => {
    renderProfilePage();

    fireEvent.click(await screen.findByRole('combobox', { name: 'Einheiten' }));
    fireEvent.click(await screen.findByText('Imperial (lb, in)'));

    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ unitSystem: 'IMPERIAL' }));
    expect(reload).toHaveBeenCalled();
  });

  it('shows body weight and height in the imperial system', async () => {
    currentUser = { ...baseUser, unitSystem: 'IMPERIAL', weight: 100, height: 180 } as typeof baseUser;
    renderProfilePage();

    await waitFor(() => expect(screen.getByText('220 lb')).toBeTruthy());
    expect(screen.getByText('71 in')).toBeTruthy();
  });

  it('writes back the stored kg/cm for untouched weight and height', async () => {
    currentUser = {
      ...baseUser,
      unitSystem: 'IMPERIAL',
      weight: 100,
      height: 180,
      dateOfBirth: '1990-01-01T00:00:00.000Z',
    } as typeof baseUser;
    renderProfilePage();

    fireEvent.click((await screen.findAllByRole('button', { name: 'Bearbeiten' }))[1]);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Speichern' }))[0]);

    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith(expect.objectContaining({ weight: 100, height: 180 })),
    );
  });
});

/** Deleting a gym is destructive: an app dialog asks first (#231), and No means nothing is sent. */
describe('ProfilePage gym deletion', () => {
  beforeEach(() => {
    getHomeGyms.mockResolvedValue([{ id: 'g1', name: 'Downtown Gym' }]);
    deleteHomeGym.mockResolvedValue(undefined);
  });
  afterEach(() => {
    cleanup();
    deleteHomeGym.mockReset();
    getHomeGyms.mockReset();
    getHomeGyms.mockResolvedValue([]);
  });

  async function openDeleteDialog() {
    await screen.findByText('Downtown Gym');
    const row = screen.getByText('Downtown Gym').closest('div.flex.items-center') as HTMLElement;
    const buttons = row.querySelectorAll('button');
    fireEvent.click(buttons[buttons.length - 1]);
    return screen.findByRole('alertdialog');
  }

  it('asks in a dialog and deletes only after confirmation', async () => {
    renderProfilePage();

    const dialog = await openDeleteDialog();
    expect(dialog.textContent).toContain(messages.Profile.gyms.deleteConfirm);
    expect(deleteHomeGym).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));

    await waitFor(() => expect(deleteHomeGym).toHaveBeenCalledWith('g1'));
    await waitFor(() => expect(screen.queryByText('Downtown Gym')).toBeNull());
  });

  it('deletes nothing when the dialog is cancelled', async () => {
    renderProfilePage();

    await openDeleteDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(deleteHomeGym).not.toHaveBeenCalled();
    expect(screen.getByText('Downtown Gym')).toBeTruthy();
  });
});

/**
 * Sign-in hardening (#225): the change-password dialog and the e-mail field mirror the server's
 * rules, so a limit breach is caught before the request and read the same either way.
 */
describe('ProfilePage password and e-mail rules', () => {
  afterEach(() => {
    cleanup();
    changePassword.mockReset();
    updateProfile.mockClear();
    logout.mockReset();
    currentUser = baseUser;
  });

  async function fillPasswordDialog(current: string, next: string, confirm = next) {
    renderProfilePage();
    fireEvent.click(await screen.findByRole('button', { name: 'Passwort ändern' }));
    fireEvent.change(await screen.findByLabelText('Aktuelles Passwort'), { target: { value: current } });
    fireEvent.change(screen.getByLabelText('Neues Passwort'), { target: { value: next } });
    fireEvent.change(screen.getByLabelText('Neues Passwort bestätigen'), { target: { value: confirm } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Passwort ändern' }).at(-1)!);
  }

  it('sends both passwords when each is 8 to 100 characters', async () => {
    changePassword.mockResolvedValue(undefined);
    await fillPasswordDialog('a'.repeat(100), 'b'.repeat(100));

    await waitFor(() =>
      expect(changePassword).toHaveBeenCalledWith({
        currentPassword: 'a'.repeat(100),
        newPassword: 'b'.repeat(100),
      }),
    );
  });

  it.each([
    ['a'.repeat(7), 'valid-new-password', 'Aktuelles Passwort', 'Das aktuelle Passwort muss mindestens 8 Zeichen lang sein.'],
    ['a'.repeat(101), 'valid-new-password', 'Aktuelles Passwort', 'Das aktuelle Passwort darf höchstens 100 Zeichen lang sein.'],
    ['valid-old-password', 'b'.repeat(7), 'Neues Passwort', 'Das neue Passwort muss mindestens 8 Zeichen lang sein.'],
    ['valid-old-password', 'b'.repeat(101), 'Neues Passwort', 'Das neue Passwort darf höchstens 100 Zeichen lang sein.'],
  ])('refuses case %#: nothing is sent and the field says why', async (current, next, label, message) => {
    await fillPasswordDialog(current, next);

    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.getByLabelText(label).getAttribute('aria-invalid')).toBe('true');
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('refuses an e-mail address that is not valid', async () => {
    currentUser = {
      ...baseUser,
      weight: 100,
      height: 180,
      dateOfBirth: '1990-01-01T00:00:00.000Z',
    } as typeof baseUser;
    renderProfilePage();

    fireEvent.click((await screen.findAllByRole('button', { name: 'Bearbeiten' }))[1]);
    fireEvent.change(await screen.findByDisplayValue('sam@example.com'), {
      target: { value: 'not-an-address' },
    });
    fireEvent.click((await screen.findAllByRole('button', { name: 'Speichern' }))[0]);

    expect(await screen.findByText('Bitte gib eine gültige E-Mail-Adresse ein.')).toBeTruthy();
    expect(updateProfile).not.toHaveBeenCalled();
  });
});
