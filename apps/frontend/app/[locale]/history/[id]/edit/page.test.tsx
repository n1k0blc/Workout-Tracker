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
