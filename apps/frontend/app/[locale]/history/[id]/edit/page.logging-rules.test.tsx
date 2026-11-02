// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/messages/de.json';

const { push, router, getWorkout, updateWorkout, notify } = vi.hoisted(() => {
  const push = vi.fn();
  return {
    push,
    router: { push },
    getWorkout: vi.fn(),
    updateWorkout: vi.fn(),
    notify: { error: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn() },
  };
});

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'w1' }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/i18n/navigation', () => ({ useRouter: () => router }));
vi.mock('@/lib/toast', () => ({ notify }));
vi.mock('@/lib/api', () => ({ apiClient: { getWorkout, updateWorkout, getExercises: vi.fn().mockResolvedValue([]) } }));
vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: { unitSystem: 'METRIC' } }) }));
vi.mock('@/components/protected-route', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
// The history editor never touches the live session; the card still reads the context.
vi.mock('@/lib/workout-context', () => ({
  useWorkout: () => ({
    removeExercise: vi.fn(),
    replaceExercise: vi.fn(),
    logSet: vi.fn(),
    updateSet: vi.fn(),
    loading: false,
    activeWorkout: null,
    setActiveWorkoutDirectly: vi.fn(),
    isPastWorkout: false,
    pastWorkoutDuration: 0,
  }),
}));

import EditWorkoutPage from './page';

/** An old workout: a working set that was logged back when RIR was optional. */
const oldWorkout = () => ({
  id: 'w1',
  date: '2026-01-10T10:00:00.000Z',
  localDate: '2026-01-10',
  totalDuration: 3600,
  isFreeWorkout: true,
  exercises: [
    {
      id: 'we1',
      exerciseId: 'e1',
      exerciseName: 'Kniebeuge',
      equipment: 'BARBELL',
      order: 1,
      sets: [
        { id: 's1', order: 1, setType: 'WORKING', reps: 8, weight: 100, rir: null, rest: 90, completedAt: '2026-01-10T10:05:00.000Z' },
        { id: 's2', order: 2, setType: 'WORKING', reps: 8, weight: 100, rir: null, rest: 90, completedAt: '2026-01-10T10:10:00.000Z' },
      ],
    },
  ],
});

async function renderPage() {
  render(
    <NextIntlClientProvider locale="de" messages={messages}>
      <EditWorkoutPage />
    </NextIntlClientProvider>,
  );
  await screen.findByText('Workout bearbeiten');
  // The card starts collapsed.
  fireEvent.click(screen.getByText('Kniebeuge'));
}

const save = () => fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
const inputs = () => screen.getAllByRole('spinbutton') as HTMLInputElement[];

describe('editing an old workout in Verlauf (#227)', () => {
  beforeEach(() => {
    getWorkout.mockResolvedValue(oldWorkout());
    updateWorkout.mockResolvedValue({});
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('saves an old workout whose working sets have no RIR when nothing in them changed', async () => {
    await renderPage();

    save();

    await waitFor(() => expect(updateWorkout).toHaveBeenCalled());
    expect(notify.warning).not.toHaveBeenCalled();
  });

  it('holds only the sets the user changed to the rules', async () => {
    await renderPage();

    // Set 1: weight, reps, RIR. Changing its reps makes it a set the user edited.
    fireEvent.change(inputs()[1], { target: { value: '9' } });
    save();

    await waitFor(() => expect(notify.warning).toHaveBeenCalledWith(messages.HistoryEditPage.setsIncomplete));
    expect(updateWorkout).not.toHaveBeenCalled();
    expect(inputs()[2].getAttribute('aria-invalid')).toBe('true');
    // Set 2 was not touched and shows nothing.
    expect(inputs()[5].getAttribute('aria-invalid')).toBeNull();

    fireEvent.change(inputs()[2], { target: { value: '2' } });
    save();
    await waitFor(() => expect(updateWorkout).toHaveBeenCalled());
    const sent = updateWorkout.mock.calls[0][1].exercises[0].sets;
    expect(sent[0]).toMatchObject({ reps: 9, rir: 2 });
    // The untouched old set goes back as it was, without an RIR.
    expect(sent[1].rir ?? null).toBeNull();
  });
});
