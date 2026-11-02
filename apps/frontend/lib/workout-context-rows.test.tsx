// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useEffect } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/messages/de.json';

const { createWorkout } = vi.hoisted(() => ({ createWorkout: vi.fn() }));

vi.mock('@/lib/api', () => ({
  apiClient: {
    getWorkouts: vi.fn().mockResolvedValue([]),
    createWorkout,
    getExercises: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: { id: 'u1' }, loading: false }),
}));

import { WorkoutProvider, useWorkout } from '@/lib/workout-context';
import { SetType, type PlannedSet, type Workout } from '@/types';

const planned = (order: number): PlannedSet => ({
  id: `p${order}`,
  order,
  setType: SetType.WORKING,
  reps: 10,
  weight: 60,
  rir: 2,
  rest: 90,
});

const workout = (): Workout =>
  ({
    id: 'local-workout-1',
    date: '2026-11-02T10:00:00.000Z',
    localDate: '2026-11-02',
    isFreeWorkout: true,
    createdAt: '2026-11-02T10:00:00.000Z',
    exercises: [
      { id: 'ex1', exerciseId: 'e1', exerciseName: 'Kniebeuge', order: 1, plannedSets: [planned(1), planned(2), planned(3)], sets: [] },
      { id: 'ex2', exerciseId: 'e2', exerciseName: 'Bankdrücken', order: 2, plannedSets: [planned(1)], sets: [] },
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

const mount = () =>
  render(
    <NextIntlClientProvider locale="de" messages={messages}>
      <WorkoutProvider>
        <Probe />
      </WorkoutProvider>
    </NextIntlClientProvider>,
  );

/** What a page reload does to the app: the React tree is gone, localStorage is not. */
const reload = (view: ReturnType<typeof mount>) => {
  view.unmount();
  return mount();
};

const logWorking = (exerciseLogId: string, setNumber: number) =>
  act(() => api.logSet(exerciseLogId, { setNumber, reps: 10, weight: 60, rir: 2 }));

beforeEach(() => {
  localStorage.clear();
  createWorkout.mockReset().mockResolvedValue({ id: 'saved' });
});
afterEach(cleanup);

describe('swiped-away planned sets', () => {
  it('survive a reload', () => {
    const view = mount();
    act(() => api.setActiveWorkoutDirectly(workout()));
    act(() => api.skipPlannedSet('ex1', 2));
    act(() => api.skipPlannedSet('ex1', 3));

    reload(view);

    expect(api.activeWorkout?.id).toBe('local-workout-1');
    expect(api.setRowState.skipped).toEqual({ ex1: [2, 3] });
  });

  it('survive a reload of past-workout tracking too', () => {
    const view = mount();
    act(() => api.setActiveWorkoutDirectly(workout(), true, 1800));
    act(() => api.skipPlannedSet('ex2', 1));

    reload(view);

    expect(api.isPastWorkout).toBe(true);
    expect(api.setRowState.skipped).toEqual({ ex2: [1] });
  });

  it('are restored from the draft of an older version that never stored them', () => {
    const view = mount();
    act(() => api.setActiveWorkoutDirectly(workout()));
    const metaKey = 'activeWorkoutDraftMeta::u1';
    const meta = JSON.parse(localStorage.getItem(metaKey)!);
    delete meta.skippedSets;
    localStorage.setItem(metaKey, JSON.stringify(meta));

    reload(view);

    expect(api.setRowState.skipped).toEqual({});
  });

  it('ignore a set that is swiped away twice', () => {
    mount();
    act(() => api.setActiveWorkoutDirectly(workout()));
    act(() => api.skipPlannedSet('ex1', 2));
    act(() => api.skipPlannedSet('ex1', 2));

    expect(api.setRowState.skipped).toEqual({ ex1: [2] });
  });

  it('are gone once the workout is discarded', () => {
    const view = mount();
    act(() => api.setActiveWorkoutDirectly(workout()));
    act(() => api.skipPlannedSet('ex1', 2));

    act(() => api.discardWorkout());
    expect(api.setRowState.skipped).toEqual({});

    reload(view);
    expect(api.activeWorkout).toBeNull();
    expect(api.setRowState.skipped).toEqual({});
  });

  it('are gone once the workout is saved', async () => {
    mount();
    act(() => api.setActiveWorkoutDirectly(workout()));
    await logWorking('ex1', 1);
    act(() => api.skipPlannedSet('ex1', 2));

    await act(() => api.completeWorkout());

    expect(api.setRowState.skipped).toEqual({});
  });

  it('are forgotten with their Übung', async () => {
    mount();
    act(() => api.setActiveWorkoutDirectly(workout()));
    act(() => api.skipPlannedSet('ex2', 1));
    act(() => api.addSetRow('ex2', 2));

    await act(() => api.removeExercise('ex2'));

    expect(api.setRowState).toEqual({ skipped: {}, added: {} });
  });

  it('are not logged-over: logging a set takes its number out of the swiped-away ones', async () => {
    mount();
    act(() => api.setActiveWorkoutDirectly(workout()));
    act(() => api.skipPlannedSet('ex1', 2));

    await logWorking('ex1', 2);

    expect(api.setRowState.skipped).toEqual({});
  });
});

describe('added set rows', () => {
  it('are held by the context, per Übung', () => {
    mount();
    act(() => api.setActiveWorkoutDirectly(workout()));
    act(() => api.addSetRow('ex1', 4));
    act(() => api.addSetRow('ex1', 5));

    expect(api.setRowState.added).toEqual({ ex1: [4, 5] });
  });

  it('can be removed again without logging', () => {
    mount();
    act(() => api.setActiveWorkoutDirectly(workout()));
    act(() => api.addSetRow('ex1', 4));

    act(() => api.removeSetRow('ex1', 4));

    expect(api.setRowState.added).toEqual({});
  });

  it('stop being rows once the set is logged', async () => {
    mount();
    act(() => api.setActiveWorkoutDirectly(workout()));
    act(() => api.addSetRow('ex1', 4));

    await logWorking('ex1', 4);

    expect(api.setRowState.added).toEqual({});
    expect(api.activeWorkout?.exercises[0].sets.map((s) => s.setNumber)).toEqual([4]);
  });
});

describe('saving a workout with a swiped-away Übung', () => {
  it('leaves the Übung out of the payload', async () => {
    mount();
    act(() => api.setActiveWorkoutDirectly(workout()));
    act(() => api.skipPlannedSet('ex1', 1));
    act(() => api.skipPlannedSet('ex1', 2));
    act(() => api.skipPlannedSet('ex1', 3));
    await logWorking('ex2', 1);

    await act(() => api.completeWorkout());

    const payload = createWorkout.mock.calls[0][0];
    expect(payload.exercises).toHaveLength(1);
    expect(payload.exercises[0]).toMatchObject({ exerciseId: 'e2', order: 1 });
  });
});

/**
 * Past-workout tracking auto-commits every filled row from a `setTimeout(…, 0)` on mount, so
 * several cards -- or several sets of one -- log in the same tick, all through the `logSet` of
 * the render they mounted in. Each must build on the workout the previous one left, not on the
 * workout that render saw.
 */
describe('mutations in the same tick', () => {
  const setsOf = (exerciseId: string) =>
    api.activeWorkout!.exercises.find((ex) => ex.id === exerciseId)!.sets.map((s) => s.setNumber);
  const working = (setNumber: number) => ({ setNumber, reps: 10, weight: 60, rir: 2 });

  it('keep the set of every Übung that logs in that tick', async () => {
    mount();
    act(() => api.setActiveWorkoutDirectly(workout(), true, 1800));

    await act(async () => {
      await Promise.all([api.logSet('ex1', working(1)), api.logSet('ex2', working(1))]);
    });

    expect(setsOf('ex1')).toEqual([1]);
    expect(setsOf('ex2')).toEqual([1]);
  });

  it('keep every set of one Übung that logs in that tick', async () => {
    mount();
    act(() => api.setActiveWorkoutDirectly(workout(), true, 1800));

    await act(async () => {
      await Promise.all([1, 2, 3].map((n) => api.logSet('ex1', working(n))));
    });

    expect(setsOf('ex1')).toEqual([1, 2, 3]);
  });

  it('keep an edit made in the same tick as a log', async () => {
    mount();
    act(() => api.setActiveWorkoutDirectly(workout(), true, 1800));
    await logWorking('ex1', 1);
    const loggedId = api.activeWorkout!.exercises[0].sets[0].id;

    await act(async () => {
      await Promise.all([api.updateSet(loggedId, { weight: 70 }), api.logSet('ex2', working(1))]);
    });

    expect(api.activeWorkout!.exercises[0].sets[0].weight).toBe(70);
    expect(setsOf('ex2')).toEqual([1]);
  });

  it('keep a deletion made in the same tick as a log', async () => {
    mount();
    act(() => api.setActiveWorkoutDirectly(workout(), true, 1800));
    await logWorking('ex1', 1);
    const loggedId = api.activeWorkout!.exercises[0].sets[0].id;

    await act(async () => {
      await Promise.all([api.deleteSet(loggedId), api.logSet('ex2', working(1))]);
    });

    expect(setsOf('ex1')).toEqual([]);
    expect(setsOf('ex2')).toEqual([1]);
  });
});
