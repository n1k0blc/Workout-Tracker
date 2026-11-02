// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import deMessages from '@/messages/de.json';
import enMessages from '@/messages/en.json';
import { ApiError } from '@/lib/api/errors';

/**
 * Field validation on the Profil page (#230): names, Größe, Gewicht, Geburtsdatum, Tagesziele and
 * gym names are checked with the shared rules, each limit at its last valid and first invalid
 * value, and the limits are named in the user's own unit.
 */

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

beforeEach(() => {
  Object.defineProperty(window, 'location', {
    value: { href: '', reload: vi.fn() },
    writable: true,
    configurable: true,
  });
});

const notify = vi.hoisted(() => ({ error: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn() }));
vi.mock('@/lib/toast', () => ({ notify }));

const { updateProfile, getHomeGyms, createHomeGym, updateHomeGym } = vi.hoisted(() => ({
  updateProfile: vi.fn(),
  getHomeGyms: vi.fn(),
  createHomeGym: vi.fn(),
  updateHomeGym: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const baseUser = {
  id: 'u1',
  email: 'sam@example.com',
  firstName: 'Sam',
  lastName: 'Lee',
  dateOfBirth: '1990-01-01T00:00:00.000Z',
  height: 180,
  weight: 80,
  createdAt: '2026-01-01T00:00:00.000Z',
  locale: 'de' as 'de' | 'en',
  unitSystem: 'METRIC' as 'METRIC' | 'IMPERIAL',
  targetKcal: 2400,
  targetCarbs: 250,
  targetProtein: 150,
  targetFat: 70,
};
let currentUser: typeof baseUser = baseUser;
vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: currentUser, logout: vi.fn() }) }));
vi.mock('@/lib/workout-context', () => ({
  useWorkout: () => ({ activeWorkout: null, isPastWorkout: false }),
}));
vi.mock('@/lib/api/client', () => ({
  apiClient: { getHomeGyms, updateProfile, createHomeGym, updateHomeGym, deleteHomeGym: vi.fn(), changePassword: vi.fn() },
}));

import ProfilePage from './page';

function renderPage(locale: 'de' | 'en' = 'de') {
  currentUser = { ...currentUser, locale };
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'de' ? deMessages : enMessages}>
      <ProfilePage />
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  currentUser = baseUser;
  updateProfile.mockResolvedValue({});
  getHomeGyms.mockResolvedValue([]);
});
updateProfile.mockResolvedValue({});
getHomeGyms.mockResolvedValue([]);

async function editProfile() {
  fireEvent.click((await screen.findAllByRole('button', { name: /Bearbeiten|Edit/ }))[1]);
}
async function editTargets() {
  fireEvent.click((await screen.findAllByRole('button', { name: /Bearbeiten|Edit/ }))[0]);
}
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const save = () => fireEvent.click(screen.getAllByRole('button', { name: /Speichern|Save/ }).at(-1)!);
const saveProfile = () => fireEvent.click(screen.getAllByRole('button', { name: /Speichern|Save/ })[0]);

describe('Profil names', () => {
  it.each(['Müller', 'José', "O'Brien", 'Anna-Lena', 'Nguyễn', 'a'.repeat(50)])('accepts %s', async (name) => {
    renderPage();
    await editProfile();
    type('Vorname', name);
    saveProfile();
    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith(expect.objectContaining({ firstName: name })));
  });

  it.each([
    ['Sam2', 'Erlaubt sind nur Buchstaben'],
    ['a'.repeat(51), 'Der Vorname darf höchstens 50 Zeichen lang sein.'],
    ['   ', 'Bitte gib deinen Vornamen ein.'],
  ])('refuses %j and says why under the field', async (name, message) => {
    renderPage();
    await editProfile();
    type('Vorname', name);
    saveProfile();

    expect((await screen.findByText(new RegExp(message.replace('.', '\\.')))).textContent).toContain(message);
    expect(screen.getByLabelText('Vorname').getAttribute('aria-invalid')).toBe('true');
    expect(updateProfile).not.toHaveBeenCalled();
  });
});

describe('Profil Geburtsdatum', () => {
  it('refuses a birth date under 13 years', async () => {
    renderPage();
    await editProfile();
    const young = new Date();
    young.setFullYear(young.getFullYear() - 12);
    fireEvent.change(screen.getByLabelText(/Geburtsdatum/), {
      target: { value: young.toISOString().slice(0, 10) },
    });
    saveProfile();

    expect(await screen.findByText('Du musst mindestens 13 Jahre alt sein.')).toBeTruthy();
    expect(updateProfile).not.toHaveBeenCalled();
  });
});

describe('Profil Größe and Gewicht', () => {
  it('names the limits in centimetres and kilograms for a metric user', async () => {
    renderPage('en');
    await editProfile();
    type('Height (cm)', '99');
    type('Weight (kg)', '29.9');
    saveProfile();

    expect(await screen.findByText('The height must be at least 100 cm.')).toBeTruthy();
    expect(screen.getByText('The weight must be at least 30 kg.')).toBeTruthy();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('names the limits in inches and pounds for an imperial user', async () => {
    currentUser = { ...baseUser, unitSystem: 'IMPERIAL' };
    renderPage('en');
    await editProfile();
    type('Height (in)', '99');
    type('Weight (lb)', '881.9');
    saveProfile();

    expect(await screen.findByText('The height must be at most 98 in.')).toBeTruthy();
    expect(screen.getByText('The weight must be at most 881.8 lb.')).toBeTruthy();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('saves the last valid imperial values, converted once', async () => {
    currentUser = { ...baseUser, unitSystem: 'IMPERIAL' };
    renderPage('en');
    await editProfile();
    type('Height (in)', '40');
    type('Weight (lb)', '66.2');
    saveProfile();

    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ height: 102, weight: 66.2 * 0.45359237 }),
      ),
    );
  });

  it('allows one decimal of weight and no second', async () => {
    renderPage('en');
    await editProfile();
    type('Weight (kg)', '75.55');
    saveProfile();
    expect(await screen.findByText('Use at most one decimal place.')).toBeTruthy();
    type('Weight (kg)', '75.5');
    saveProfile();
    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith(expect.objectContaining({ weight: 75.5 })));
  });

  it('does not let the stored profile block saving a different field', async () => {
    // 30 kg is the lowest valid weight; its pound display (66) is below the lowest typed value.
    currentUser = { ...baseUser, unitSystem: 'IMPERIAL', weight: 30 };
    renderPage('en');
    await editProfile();
    type('First name', 'Samuel');
    saveProfile();
    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith(expect.objectContaining({ weight: 30 })));
  });
});

describe('Tagesziele', () => {
  const kcal = 'Calories';

  it.each([
    ['499', 'The calorie target must be at least 500 kcal.'],
    ['10001', 'The calorie target must be at most 10,000 kcal.'],
    ['2400.5', 'The calorie target must be a whole number.'],
  ])('refuses kcal %s', async (value, message) => {
    renderPage('en');
    await editTargets();
    type(kcal, value);
    save();
    expect(await screen.findByText(message)).toBeTruthy();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it.each(['500', '10000'])('accepts kcal %s', async (value) => {
    renderPage('en');
    await editTargets();
    type(kcal, value);
    save();
    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith(expect.objectContaining({ targetKcal: Number(value) })));
  });

  it.each([
    ['0', 'The carbs target must be at least 1 g.'],
    ['1001', 'The carbs target must be at most 1,000 g.'],
  ])('refuses carbs %s', async (value, message) => {
    renderPage('en');
    await editTargets();
    type('Carbs', value);
    save();
    expect(await screen.findByText(message)).toBeTruthy();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it.each(['1', '1000'])('accepts carbs %s', async (value) => {
    renderPage('en');
    await editTargets();
    type('Carbs', value);
    save();
    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith(expect.objectContaining({ targetCarbs: Number(value) })));
  });

  it('clears a target left blank', async () => {
    renderPage('en');
    await editTargets();
    type('Protein', '');
    save();
    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith(expect.objectContaining({ targetProtein: null })));
  });
});

describe('Gym names', () => {
  async function openAddDialog() {
    fireEvent.click(await screen.findByRole('button', { name: 'Gym hinzufügen' }));
    return screen.findByLabelText('Gym-Name');
  }

  it('adds a name of 100 characters and refuses 101 with the limit named', async () => {
    createHomeGym.mockResolvedValue({ id: 'g1', name: 'x' });
    renderPage();
    const field = await openAddDialog();

    fireEvent.change(field, { target: { value: 'g'.repeat(101) } });
    fireEvent.click(screen.getByRole('button', { name: 'Hinzufügen' }));
    expect(await screen.findByText('Der Name darf höchstens 100 Zeichen lang sein.')).toBeTruthy();
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(createHomeGym).not.toHaveBeenCalled();

    fireEvent.change(field, { target: { value: 'g'.repeat(100) } });
    fireEvent.click(screen.getByRole('button', { name: 'Hinzufügen' }));
    await waitFor(() => expect(createHomeGym).toHaveBeenCalledWith({ name: 'g'.repeat(100) }));
  });

  it('allows special characters such as & in a gym name', async () => {
    createHomeGym.mockResolvedValue({ id: 'g1', name: 'Fit & Fun' });
    renderPage();
    fireEvent.change(await openAddDialog(), { target: { value: 'Fit & Fun' } });
    fireEvent.click(screen.getByRole('button', { name: 'Hinzufügen' }));
    await waitFor(() => expect(createHomeGym).toHaveBeenCalledWith({ name: 'Fit & Fun' }));
  });

  it('asks for a name instead of silently ignoring an empty one', async () => {
    renderPage();
    await openAddDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Hinzufügen' }));
    expect(await screen.findByText('Bitte gib einen Namen ein.')).toBeTruthy();
    expect(createHomeGym).not.toHaveBeenCalled();
  });

  it('refuses an eleventh gym', async () => {
    getHomeGyms.mockResolvedValue(Array.from({ length: 10 }, (_, i) => ({ id: `g${i}`, name: `Gym ${i}` })));
    renderPage();
    await screen.findByText('Gym 9');
    fireEvent.change(await openAddDialog(), { target: { value: 'Elf' } });
    fireEvent.click(screen.getByRole('button', { name: 'Hinzufügen' }));
    expect(await screen.findByText('Du kannst höchstens 10 Studios hinzufügen.')).toBeTruthy();
    expect(createHomeGym).not.toHaveBeenCalled();
  });

  it('shows a server rejection of the name under the field', async () => {
    createHomeGym.mockRejectedValue(new ApiError(400, 'VALIDATION_FAILED', [{ property: 'name', constraints: ['noControlCharacters'] }]));
    renderPage();
    fireEvent.change(await openAddDialog(), { target: { value: 'Gym' } });
    fireEvent.click(screen.getByRole('button', { name: 'Hinzufügen' }));
    expect(await screen.findByText('Bitte entferne Steuer- oder unsichtbare Zeichen.')).toBeTruthy();
    expect(notify.error).not.toHaveBeenCalled();
  });
});
