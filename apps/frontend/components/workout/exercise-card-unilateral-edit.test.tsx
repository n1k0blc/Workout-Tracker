// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
  apiClient: { getExercises: vi.fn().mockResolvedValue([]) },
}));

const updateSet = vi.fn();

vi.mock('@/lib/workout-context', () => ({
  useWorkout: () => ({
    removeExercise: vi.fn(),
    replaceExercise: vi.fn(),
    logSet: vi.fn(),
    updateSet,
    loading: false,
    activeWorkout: { id: 'w1', exercises: [] },
    setActiveWorkoutDirectly: vi.fn(),
    isPastWorkout: false,
    pastWorkoutDuration: 0,
  }),
}));

import ExerciseCard from '@/components/workout/exercise-card';
import { SetType, type ExerciseLog } from '@/types';

const loggedSet = () =>
  ({
    id: 's1',
    setNumber: 1,
    setType: SetType.WORKING,
    reps: 10,
    weight: 20,
    rir: 2,
    repsLeft: 10,
    repsRight: 9,
    weightLeft: 20,
    weightRight: 20,
    rirLeft: 2,
    rirRight: 2,
    completedAt: new Date().toISOString(),
  });

/** An exercise started from a plan -- the shape every real workout has. */
const unilateralPlannedWithLoggedSet = (): ExerciseLog =>
  ({
    id: 'ex1',
    exerciseId: 'e1',
    exerciseName: 'Einarmiges Rudern',
    order: 1,
    isUnilateral: true,
    plannedSets: [
      {
        id: 'p1',
        order: 1,
        setType: SetType.WORKING,
        reps: 10,
        weight: 20,
        rir: 2,
      },
    ],
    sets: [loggedSet()],
  }) as unknown as ExerciseLog;

/** A set logged beyond the plan (or in a free workout) -- the "extra row" path. */
const unilateralWithLoggedSet = (): ExerciseLog =>
  ({
    id: 'ex1',
    exerciseId: 'e1',
    exerciseName: 'Einarmiges Rudern',
    order: 1,
    isUnilateral: true,
    plannedSets: [],
    sets: [
      {
        id: 's1',
        setNumber: 1,
        setType: SetType.WORKING,
        reps: 10,
        weight: 20,
        rir: 2,
        repsLeft: 10,
        repsRight: 9,
        weightLeft: 20,
        weightRight: 20,
        rirLeft: 2,
        rirRight: 2,
        completedAt: new Date().toISOString(),
      },
    ],
  }) as unknown as ExerciseLog;

describe('active workout: logged unilateral set', () => {
  beforeEach(() => updateSet.mockClear());
  // `globals: true` is off, so RTL's auto-cleanup is not registered: without this the
  // first case's DOM leaks into the second and every query sees both cards.
  afterEach(cleanup);

  it.each([
    ['planned set', unilateralPlannedWithLoggedSet],
    ['extra set', unilateralWithLoggedSet],
  ])('renders editable per-side inputs for a logged %s, like a bilateral one does', (_label, build) => {
    render(
      <ExerciseCard exercise={build()} exerciseNumber={1} mode="active" defaultOpen />,
    );

    const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
    // 2 sides x (weight, reps, RIR)
    expect(inputs).toHaveLength(6);

    // Editing the right side's reps writes that side back through updateSet.
    const rightReps = inputs[4];
    fireEvent.change(rightReps, { target: { value: '11' } });
    expect(updateSet).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ repsRight: 11, repsLeft: 10 }),
    );
  });
});
