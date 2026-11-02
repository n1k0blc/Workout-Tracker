// @vitest-environment jsdom
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/messages/de.json';

// The router must be referentially stable: the page reloads the workout whenever it changes.
const { push, router, getWorkout, updateWorkout } = vi.hoisted(() => {
  const push = vi.fn();
  return { push, router: { push }, getWorkout: vi.fn(), updateWorkout: vi.fn() };
});

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'w1' }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => router,
}));

const notify = vi.hoisted(() => ({ error: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn() }));
vi.mock('@/lib/toast', () => ({ notify }));

vi.mock('@/lib/api', () => ({
  apiClient: { getWorkout, updateWorkout },
}));

vi.mock('@/components/protected-route', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import EditWorkoutPage from './page';

const originalTz = process.env.TZ;

afterAll(() => {
  process.env.TZ = originalTz;
});

function renderEditPage() {
  return render(
    <NextIntlClientProvider locale="de" messages={messages}>
      <EditWorkoutPage />
    </NextIntlClientProvider>,
  );
}

/**
 * Bug #232: the native date input answers with UTC midnight, and the page read the local
 * day back out of it -- which is the previous day anywhere west of Greenwich. The zones
 * below are the ones where that shows (and Berlin, where it never did).
 */
describe.each(['America/New_York', 'America/Los_Angeles', 'Pacific/Honolulu', 'Europe/Berlin'])(
  'editing a past workout in %s',
  (timeZone) => {
    beforeEach(() => {
      process.env.TZ = timeZone;
      getWorkout.mockResolvedValue({
        id: 'w1',
        date: '2026-08-15T10:00:00.000Z',
        localDate: '2026-08-15',
        totalDuration: 3600,
        isFreeWorkout: true,
        exercises: [],
      });
      updateWorkout.mockResolvedValue({});
    });

    afterEach(() => {
      cleanup();
      getWorkout.mockReset();
      updateWorkout.mockReset();
      push.mockClear();
    });

    it('saves the picked day as the workout date', async () => {
      const { container } = renderEditPage();

      await screen.findByText('Workout bearbeiten');
      const input = container.querySelector('input[type="date"]') as HTMLInputElement;
      expect(input.value).toBe('2026-08-15');

      fireEvent.change(input, { target: { value: '2026-08-17' } });
      expect(input.value).toBe('2026-08-17');

      fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

      await waitFor(() => expect(updateWorkout).toHaveBeenCalledTimes(1));
      const payload = updateWorkout.mock.calls[0][1];
      expect(payload.localDate).toBe('2026-08-17');
      expect(payload.date.slice(0, 10)).toBe('2026-08-17');
    });
  },
);

/**
 * The date of a past workout runs from 2000-01-01 through the user's today (#230). The native
 * input lets a typed value past its min/max, so the page judges it on save.
 */
describe('the date of a past workout', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 2, 12, 0));
    getWorkout.mockResolvedValue({
      id: 'w1',
      date: '2026-08-15T10:00:00.000Z',
      localDate: '2026-08-15',
      totalDuration: 3600,
      isFreeWorkout: true,
      exercises: [],
    });
    updateWorkout.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    getWorkout.mockReset();
    updateWorkout.mockReset();
    push.mockClear();
  });

  async function saveWith(day: string) {
    const { container } = renderEditPage();
    await screen.findByText('Workout bearbeiten');
    const input = container.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: day } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    return input;
  }

  it.each(['2000-01-01', '2026-11-02'])('saves %s, the last valid day at either end', async (day) => {
    await saveWith(day);
    await waitFor(() => expect(updateWorkout).toHaveBeenCalledTimes(1));
  });

  it.each([
    ['1999-12-31', 'Das Datum liegt zu weit in der Vergangenheit.'],
    ['2026-11-03', 'Das Datum darf nicht in der Zukunft liegen.'],
  ])('refuses %s with the reason under the field', async (day, message) => {
    const input = await saveWith(day);
    expect(await screen.findByText(message)).toBeTruthy();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(updateWorkout).not.toHaveBeenCalled();
  });
});

/** Failures are a toast (#231), never a native alert(): the page stays put or leaves, unblocked. */
describe('editing a past workout, when the server fails', () => {
  const workout = {
    id: 'w1',
    date: '2026-08-15T10:00:00.000Z',
    localDate: '2026-08-15',
    totalDuration: 3600,
    isFreeWorkout: true,
    exercises: [],
  };

  afterEach(() => {
    cleanup();
    getWorkout.mockReset();
    updateWorkout.mockReset();
    push.mockClear();
    notify.error.mockClear();
  });

  it('toasts the save error and stays on the page', async () => {
    getWorkout.mockResolvedValue(workout);
    updateWorkout.mockRejectedValue(new Error('boom'));
    renderEditPage();

    await screen.findByText('Workout bearbeiten');
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(notify.error).toHaveBeenCalledWith('Fehler beim Speichern des Workouts'));
    expect(push).not.toHaveBeenCalled();
  });

  it('toasts the load error and returns to the history', async () => {
    getWorkout.mockRejectedValue(new Error('boom'));
    renderEditPage();

    await waitFor(() => expect(notify.error).toHaveBeenCalledWith('Fehler beim Laden des Workouts'));
    expect(push).toHaveBeenCalledWith('/history');
  });
});
