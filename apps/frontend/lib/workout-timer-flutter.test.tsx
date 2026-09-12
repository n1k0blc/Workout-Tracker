// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { useEffect } from 'react';

vi.mock('@/lib/api', () => ({
  apiClient: {
    getWorkouts: vi.fn().mockResolvedValue([]),
    createWorkout: vi.fn(),
    getExercises: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: { id: 'u1' }, loading: false }),
}));

import { WorkoutProvider, useWorkout } from '@/lib/workout-context';
import { SetType, type Workout } from '@/types';

const workout = (): Workout =>
  ({
    id: 'w1',
    date: new Date().toISOString(),
    localDate: '2026-09-12',
    duration: 0,
    isFreeWorkout: true,
    exercises: [
      {
        id: 'ex1',
        exerciseId: 'e1',
        exerciseName: 'Bizeps Curl',
        order: 1,
        isUnilateral: false,
        plannedSets: [],
        sets: [
          {
            id: 's1',
            setNumber: 1,
            setType: SetType.WORKING,
            reps: 10,
            weight: 20,
            rir: 2,
            completedAt: new Date().toISOString(),
          },
        ],
      },
    ],
  }) as unknown as Workout;

/** Records every workoutDuration the provider hands out. */
const samples: number[] = [];
let api: ReturnType<typeof useWorkout>;

function Probe() {
  const ctx = useWorkout();
  useEffect(() => {
    api = ctx;
    samples.push(ctx.workoutDuration);
  });
  return <div data-testid="dauer">{ctx.workoutDuration}</div>;
}

describe('active workout timer while editing a logged set', () => {
  beforeEach(() => {
    samples.length = 0;
    localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  // `globals: true` is off, so RTL's auto-cleanup is not registered: without this the
  // first case's provider stays mounted and keeps pushing samples during the second.
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('does not drop back to 0 when a logged set is edited', async () => {
    render(
      <WorkoutProvider>
        <Probe />
      </WorkoutProvider>,
    );

    // Start a live session and let the clock run for 5s.
    await act(async () => {
      api.setActiveWorkoutDirectly(workout());
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    const before = samples[samples.length - 1];
    expect(before).toBeGreaterThanOrEqual(4);

    // Type "2", "5" into the weight field of the already-logged set -- exactly what
    // ExerciseCard.handleRowValueChange does, one context write per keystroke.
    samples.length = 0;
    await act(async () => {
      api.updateSet('s1', { weight: 2, reps: 10, rir: 2 });
    });
    await act(async () => {
      api.updateSet('s1', { weight: 25, reps: 10, rir: 2 });
    });

    const dip = samples.filter((s) => s < before);
    expect(dip, `timer fluttered: ${JSON.stringify(samples)}`).toEqual([]);
  });

  it('stays paused when a logged set is edited', async () => {
    render(
      <WorkoutProvider>
        <Probe />
      </WorkoutProvider>,
    );

    await act(async () => {
      api.setActiveWorkoutDirectly(workout());
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    await act(async () => {
      api.togglePause();
    });
    expect(api.isPaused).toBe(true);

    const paused = api.workoutDuration;
    await act(async () => {
      api.updateSet('s1', { weight: 25, reps: 10, rir: 2 });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(api.isPaused).toBe(true);
    expect(api.workoutDuration).toBe(paused);
  });
});
