// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useEffect } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import de from '@/messages/de.json';
import en from '@/messages/en.json';

const { notify, createWorkout } = vi.hoisted(() => ({
  notify: { error: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn() },
  createWorkout: vi.fn(),
}));

vi.mock('@/lib/toast', () => ({ notify }));
vi.mock('@/lib/api', () => ({
  apiClient: {
    getWorkouts: vi.fn().mockResolvedValue([]),
    getExercises: vi.fn().mockResolvedValue([]),
    getPersonalRecords: vi.fn().mockResolvedValue({ recentPRs: [] }),
    createWorkout,
  },
}));
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: { id: 'u1', unitSystem: 'METRIC' }, loading: false }),
}));

import { WorkoutProvider, useWorkout } from '@/lib/workout-context';
import ActiveWorkoutScreen from '@/components/workout/active-workout-screen';
import { ForgottenWorkoutPrompt } from '@/components/workout/forgotten-workout-prompt';
import { SetType, type PlannedSet, type Workout } from '@/types';

const HOUR = 3_600_000;
const T0 = Date.parse('2026-11-02T08:00:00.000Z');

const planned = (order: number): PlannedSet => ({
  id: `p${order}`,
  order,
  setType: SetType.WORKING,
  reps: 10,
  weight: 60,
  rir: 2,
  rest: 90,
});

const workout = (plannedCount: number): Workout =>
  ({
    id: 'local-workout-1',
    date: new Date(T0).toISOString(),
    localDate: '2026-11-02',
    isFreeWorkout: true,
    createdAt: new Date(T0).toISOString(),
    exercises: [
      {
        id: 'ex1',
        exerciseId: 'e1',
        exerciseName: 'Kniebeuge',
        order: 1,
        plannedSets: Array.from({ length: plannedCount }, (_, i) => planned(i + 1)),
        sets: [
          {
            id: 's1',
            setNumber: 1,
            setType: SetType.WORKING,
            reps: 10,
            weight: 60,
            rir: 2,
            completedAt: new Date(T0 + 30 * 60_000).toISOString(),
          },
        ],
      },
    ],
  }) as unknown as Workout;

let api: ReturnType<typeof useWorkout>;
function Probe() {
  const ctx = useWorkout();
  useEffect(() => {
    api = ctx;
  });
  return null;
}

function mount(locale: 'de' | 'en' = 'de') {
  render(
    <NextIntlClientProvider locale={locale} messages={locale === 'de' ? de : en}>
      <WorkoutProvider>
        <Probe />
        <ActiveWorkoutScreen mode="active" />
        <ForgottenWorkoutPrompt />
      </WorkoutProvider>
    </NextIntlClientProvider>,
  );
}

/** Start a live workout now, then let the clock run to 5 hours later and one tick past it. */
async function startAndLetItRun(wk: Workout) {
  await act(async () => {
    api.setActiveWorkoutDirectly(wk);
  });
  await act(async () => {
    vi.setSystemTime(T0 + 5 * HOUR);
    await vi.advanceTimersByTimeAsync(1000);
  });
}

const dialog = () => screen.queryByRole('alertdialog');
const inDialog = () => within(screen.getByRole('alertdialog'));

describe('the 5-hour prompt', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    Object.values(notify).forEach((fn) => fn.mockReset());
    createWorkout.mockReset().mockResolvedValue({ id: 'saved' });
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('is not on screen while the workout is young', async () => {
    mount();
    await act(async () => {
      api.setActiveWorkoutDirectly(workout(1));
    });
    await act(async () => {
      vi.setSystemTime(T0 + 4 * HOUR);
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(dialog()).toBeNull();
  });

  it('asks after 5 hours and promises to save a complete workout when nobody answers', async () => {
    mount();
    await startAndLetItRun(workout(1));

    expect(inDialog().getByText('Trainierst du noch?')).toBeTruthy();
    const text = dialog()!.textContent ?? '';
    expect(text).toContain('Dein Workout läuft seit über 5 Stunden.');
    expect(text).toContain('in 5:00 automatisch gespeichert');
    expect(inDialog().getByRole('button', { name: 'Weiter trainieren' })).toBeTruthy();
    expect(inDialog().getByRole('button', { name: 'Workout beenden' })).toBeTruthy();
    expect(inDialog().getByRole('button', { name: 'Verwerfen' })).toBeTruthy();
  });

  it('warns that an incomplete workout will be discarded, and that this cannot be undone', async () => {
    mount();
    await startAndLetItRun(workout(2));

    const text = dialog()!.textContent ?? '';
    expect(text).toContain('in 5:00 verworfen');
    expect(text).toContain('Das lässt sich nicht rückgängig machen.');
  });

  it('counts down on screen', async () => {
    mount();
    await startAndLetItRun(workout(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(65_000);
    });

    expect(dialog()!.textContent).toContain('in 3:55 automatisch gespeichert');
  });

  it('speaks English in the English locale', async () => {
    mount('en');
    await startAndLetItRun(workout(1));

    expect(inDialog().getByText('Still training?')).toBeTruthy();
    expect(inDialog().getByRole('button', { name: 'Keep training' })).toBeTruthy();
    expect(inDialog().getByRole('button', { name: 'Finish workout' })).toBeTruthy();
    expect(inDialog().getByRole('button', { name: 'Discard' })).toBeTruthy();
  });

  it('is not dismissed by Escape', async () => {
    mount();
    await startAndLetItRun(workout(1));

    await act(async () => {
      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    });

    expect(dialog()).not.toBeNull();
  });

  it('"Weiter trainieren" closes it and keeps the workout', async () => {
    mount();
    await startAndLetItRun(workout(1));

    await act(async () => {
      fireEvent.click(inDialog().getByRole('button', { name: 'Weiter trainieren' }));
    });

    expect(dialog()).toBeNull();
    expect(api.activeWorkout).not.toBeNull();
    expect(createWorkout).not.toHaveBeenCalled();
  });

  it('"Verwerfen" throws the workout away', async () => {
    mount();
    await startAndLetItRun(workout(1));

    await act(async () => {
      fireEvent.click(inDialog().getByRole('button', { name: 'Verwerfen' }));
    });

    expect(dialog()).toBeNull();
    expect(api.activeWorkout).toBeNull();
    expect(createWorkout).not.toHaveBeenCalled();
  });

  it('"Workout beenden" on a complete workout opens the usual confirm dialog', async () => {
    mount();
    await startAndLetItRun(workout(1));

    await act(async () => {
      fireEvent.click(inDialog().getByRole('button', { name: 'Workout beenden' }));
    });

    expect(screen.queryByText('Workout beenden?')).not.toBeNull();
    expect(screen.queryByText('Trainierst du noch?')).toBeNull();
    expect(createWorkout).not.toHaveBeenCalled();
  });

  it('"Workout beenden" on an incomplete workout names the first problem instead', async () => {
    mount();
    await startAndLetItRun(workout(2));

    await act(async () => {
      fireEvent.click(inDialog().getByRole('button', { name: 'Workout beenden' }));
    });

    expect(notify.warning).toHaveBeenCalledWith(
      'Kniebeuge: Satz 2 ist noch nicht geloggt. Logge ihn oder wische ihn weg.',
    );
    expect(screen.queryByText('Workout beenden?')).toBeNull();
  });

  it('is never shown for past-workout tracking', async () => {
    mount();
    await act(async () => {
      api.setActiveWorkoutDirectly(workout(1), true, 1800);
    });
    await act(async () => {
      vi.setSystemTime(T0 + 9 * HOUR);
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(dialog()).toBeNull();
  });
});
