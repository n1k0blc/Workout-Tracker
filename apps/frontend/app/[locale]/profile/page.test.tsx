// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/messages/de.json';

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

const { push, logout, updateProfile } = vi.hoisted(() => ({
  push: vi.fn(),
  logout: vi.fn(),
  updateProfile: vi.fn(),
}));

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
    getHomeGyms: vi.fn().mockResolvedValue([]),
    updateProfile,
    createHomeGym: vi.fn(),
    updateHomeGym: vi.fn(),
    deleteHomeGym: vi.fn(),
    changePassword: vi.fn(),
  },
}));

updateProfile.mockResolvedValue({ ...baseUser, locale: 'en' });

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

    await waitFor(() => expect(screen.getByText('network down')).toBeTruthy());
    expect(window.location.href).toBe('');
    expect(push).not.toHaveBeenCalled();
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
