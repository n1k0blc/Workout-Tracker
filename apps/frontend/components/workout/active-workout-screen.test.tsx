// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/messages/de.json';

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
import { Equipment, SetType, type ExerciseLog, type PlannedSet, type SetLog, type Workout } from '@/types';

const planned = (order: number, over: Partial<PlannedSet> = {}): PlannedSet => ({
  id: `p${order}`,
  order,
  setType: SetType.WORKING,
  reps: 10,
  weight: 60,
  rir: 2,
  rest: 90,
  ...over,
});

const logged = (setNumber: number, over: Partial<SetLog> = {}): SetLog => ({
  id: `s${setNumber}`,
  setNumber,
  setType: SetType.WORKING,
  reps: 10,
  weight: 60,
  rir: 2,
  completedAt: '2026-11-02T10:00:00.000Z',
  ...over,
});

const exercise = (id: string, name: string, over: Partial<ExerciseLog> = {}): ExerciseLog => ({
  id,
  exerciseId: `e-${id}`,
  exerciseName: name,
  order: 1,
  equipment: Equipment.BARBELL,
  plannedSets: [planned(1), planned(2)],
  sets: [],
  ...over,
});

const workoutOf = (exercises: ExerciseLog[]): Workout =>
  ({
    id: 'local-workout-1',
    date: '2026-11-02T10:00:00.000Z',
    localDate: '2026-11-02',
    isFreeWorkout: true,
    createdAt: '2026-11-02T10:00:00.000Z',
    exercises,
  }) as unknown as Workout;

let api: ReturnType<typeof useWorkout>;

function Harness({ workout, past }: { workout: Workout | null; past?: boolean }) {
  const ctx = useWorkout();
  useEffect(() => {
    api = ctx;
  });
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !workout) return;
    seeded.current = true;
    ctx.setActiveWorkoutDirectly(workout, past, past ? 1800 : undefined);
  });
  return <ActiveWorkoutScreen mode={past ? 'edit' : 'active'} />;
}

/** `null` seeds nothing: the provider restores whatever draft a previous render left in localStorage. */
function renderScreen(exercises: ExerciseLog[] | null, opts: { past?: boolean } = {}) {
  return render(
    <NextIntlClientProvider locale="de" messages={messages}>
      <WorkoutProvider>
        <Harness workout={exercises && workoutOf(exercises)} past={opts.past} />
      </WorkoutProvider>
    </NextIntlClientProvider>,
  );
}

const finish = () => fireEvent.click(screen.getByRole('button', { name: 'Workout beenden' }));
const finishDialog = () => screen.queryByText('Workout beenden?');
const expand = (name: string) => fireEvent.click(screen.getByText(name));
const ticks = () => screen.queryAllByTitle('Satz loggen (oder Swipe LTR)');
const warned = () => notify.warning.mock.calls.map((c) => c[0] as string);

/** jsdom has no PointerEvent constructor that keeps clientX, so build the events by hand. */
const pointer = (type: string, target: HTMLElement, clientX: number) =>
  fireEvent(target, new MouseEvent(type, { bubbles: true, clientX, clientY: 0 }));
const swipeLeft = (row: HTMLElement) => {
  pointer('pointerdown', row, 120);
  pointer('pointermove', row, 0);
  pointer('pointerup', row, 0);
};
const rowOf = (input: HTMLElement) => input.closest('.touch-pan-y') as HTMLElement;
const inputs = () => screen.getAllByRole('spinbutton') as HTMLInputElement[];

const scrollIntoView = vi.fn();

beforeEach(() => {
  localStorage.clear();
  Object.values(notify).forEach((fn) => fn.mockReset());
  createWorkout.mockReset().mockResolvedValue({ id: 'saved' });
  scrollIntoView.mockReset();
  Element.prototype.scrollIntoView = scrollIntoView;
});
afterEach(cleanup);

describe('"Beenden" in the live workout', () => {
  it('looks enabled while sets are still open', () => {
    renderScreen([exercise('a', 'Kniebeuge')]);

    expect((screen.getByRole('button', { name: 'Workout beenden' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('cannot finish a workout whose last Übung has unlogged sets: a toast names the first problem', async () => {
    renderScreen([
      exercise('a', 'Kniebeuge', { sets: [logged(1), logged(2)] }),
      exercise('b', 'Bankdrücken', { sets: [logged(1)] }),
    ]);

    finish();

    expect(finishDialog()).toBeNull();
    expect(warned()).toEqual(['Bankdrücken: Satz 2 ist noch nicht geloggt. Logge ihn oder wische ihn weg.']);
  });

  it('scrolls to the first problem, opening the collapsed card on the way', async () => {
    renderScreen([
      exercise('a', 'Kniebeuge', { sets: [logged(1), logged(2)] }),
      exercise('b', 'Bankdrücken', { sets: [logged(1)] }),
    ]);
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0); // everything collapsed

    finish();

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
    expect((scrollIntoView.mock.contexts[0] as HTMLElement).id).toBe('set-row-b-2');
    expect(inputs().length).toBeGreaterThan(0);
  });

  it('names a logged working set that lacks RIR', () => {
    renderScreen([exercise('a', 'Kniebeuge', { sets: [logged(1, { rir: undefined }), logged(2)] })]);

    finish();

    expect(warned()).toEqual(['Kniebeuge: Satz 1 braucht noch einen RIR.']);
    expect(finishDialog()).toBeNull();
  });

  it('names an Übung with no sets at all', () => {
    renderScreen([
      exercise('a', 'Kniebeuge', { sets: [logged(1), logged(2)] }),
      exercise('b', 'Bankdrücken', { plannedSets: [], sets: [] }),
    ]);

    finish();

    expect(warned()).toEqual(['Bankdrücken hat noch keine Sätze. Füge einen Satz hinzu oder entferne die Übung.']);
  });

  it('asks for at least one set when nothing is logged', () => {
    renderScreen([]);

    finish();

    expect(warned()).toEqual(['Logge mindestens einen Satz, bevor du das Workout beendest.']);
  });

  it('opens the confirm dialog only for a complete workout', () => {
    renderScreen([exercise('a', 'Kniebeuge', { sets: [logged(1), logged(2)] })]);

    finish();

    expect(finishDialog()).not.toBeNull();
    expect(notify.warning).not.toHaveBeenCalled();
  });

  it('is complete once the open sets are swiped away, and saves without the Übung that was swiped away entirely', async () => {
    renderScreen([
      exercise('a', 'Kniebeuge'),
      exercise('b', 'Bankdrücken', { plannedSets: [planned(1)], sets: [logged(1)] }),
    ]);
    expand('Kniebeuge');
    swipeLeft(rowOf(inputs()[0]));
    swipeLeft(rowOf(inputs()[0]));

    finish();
    expect(finishDialog()).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Beenden' }));

    await waitFor(() => expect(createWorkout).toHaveBeenCalled());
    const payload = createWorkout.mock.calls[0][0];
    expect(payload.exercises).toHaveLength(1);
    expect(payload.exercises[0]).toMatchObject({ exerciseId: 'e-b', order: 1 });
  });

  it('still needs one logged set when every set of every Übung is swiped away', () => {
    renderScreen([exercise('a', 'Kniebeuge', { plannedSets: [planned(1)] })]);
    expand('Kniebeuge');
    swipeLeft(rowOf(inputs()[0]));

    finish();

    expect(finishDialog()).toBeNull();
    expect(warned()).toEqual(['Logge mindestens einen Satz, bevor du das Workout beendest.']);
  });

  it('keeps swiped-away sets swiped away after a reload', () => {
    const view = renderScreen([exercise('a', 'Kniebeuge', { sets: [logged(1)] })]);
    expand('Kniebeuge');
    expect(inputs().length).toBeGreaterThan(0);
    swipeLeft(rowOf(inputs()[3])); // set 2, still open
    finish();
    expect(finishDialog()).not.toBeNull();
    view.unmount();

    renderScreen(null);
    finish();

    expect(finishDialog()).not.toBeNull();
  });
});

describe('the Übung order lock in the live workout', () => {
  const two = () => [
    exercise('a', 'Kniebeuge', { plannedSets: [planned(1)] }),
    exercise('b', 'Bankdrücken', { plannedSets: [planned(1)] }),
  ];

  it('refuses to log a set while the Übung above is not complete, and suggests dragging up', async () => {
    renderScreen(two());
    expand('Bankdrücken');

    fireEvent.click(ticks()[0]);

    await waitFor(() => expect(notify.warning).toHaveBeenCalled());
    expect(warned()).toEqual([
      'Schließe zuerst „Kniebeuge“ ab – oder ziehe diese Übung nach oben, wenn das Gerät belegt ist.',
    ]);
    expect(api.activeWorkout?.exercises[1].sets).toHaveLength(0);
  });

  it('lets the set through once the Übung above is complete', async () => {
    renderScreen(two());
    expand('Kniebeuge');
    fireEvent.click(ticks()[0]);
    await waitFor(() => expect(api.activeWorkout?.exercises[0].sets).toHaveLength(1));
    expand('Bankdrücken');

    fireEvent.click(ticks()[0]);

    await waitFor(() => expect(api.activeWorkout?.exercises[1].sets).toHaveLength(1));
    expect(notify.warning).not.toHaveBeenCalled();
  });

  it('counts an Übung above with every set swiped away as complete', async () => {
    renderScreen(two());
    expand('Kniebeuge');
    swipeLeft(rowOf(inputs()[0]));
    expand('Bankdrücken');

    fireEvent.click(ticks()[0]);

    await waitFor(() => expect(api.activeWorkout?.exercises[1].sets).toHaveLength(1));
    expect(notify.warning).not.toHaveBeenCalled();
  });

  it('is lifted by dragging the Übung up', async () => {
    renderScreen(two());
    act(() => {
      void api.reorderExercises(['b', 'a']);
    });
    await waitFor(() => expect(api.activeWorkout?.exercises[0].id).toBe('b'));
    expand('Bankdrücken');

    fireEvent.click(ticks()[0]);

    await waitFor(() => expect(api.activeWorkout?.exercises[0].sets).toHaveLength(1));
    expect(notify.warning).not.toHaveBeenCalled();
  });

  it('does not lock the first Übung', async () => {
    renderScreen(two());
    expand('Kniebeuge');

    fireEvent.click(ticks()[0]);

    await waitFor(() => expect(api.activeWorkout?.exercises[0].sets).toHaveLength(1));
  });
});

describe('tracking a past workout', () => {
  // Weight 0 on a barbell Übung cannot be logged, so its row stays empty. Only one Übung has
  // anything to log on mount: every card logs through the same context in the same tick.
  const withEmptyRow = () => [
    exercise('a', 'Kniebeuge', { plannedSets: [planned(1), planned(2, { weight: 0 })] }),
    exercise('b', 'Bankdrücken', { plannedSets: [planned(1)], sets: [logged(1)] }),
  ];

  it('blocks saving while a row is empty, and marks the row', async () => {
    renderScreen(withEmptyRow(), { past: true });
    await waitFor(() => expect(api.activeWorkout?.exercises[0].sets).toHaveLength(1));
    expand('Kniebeuge');
    expect(inputs().filter((i) => i.getAttribute('aria-invalid') === 'true')).toHaveLength(0);

    finish();

    expect(finishDialog()).toBeNull();
    expect(warned()).toEqual(['Kniebeuge: Satz 2 ist noch nicht geloggt. Logge ihn oder wische ihn weg.']);
    expect(screen.getByText('0 kg ist nur bei Körpergewicht-Übungen möglich.')).not.toBeNull();
    expect(inputs().filter((i) => i.getAttribute('aria-invalid') === 'true')).toHaveLength(1);
  });

  it('saves once the empty row is filled in', async () => {
    renderScreen(withEmptyRow(), { past: true });
    await waitFor(() => expect(api.activeWorkout?.exercises[0].sets).toHaveLength(1));
    expand('Kniebeuge');
    finish();

    const weight = inputs().filter((i) => i.getAttribute('aria-invalid') === 'true')[0];
    fireEvent.change(weight, { target: { value: '50' } });
    fireEvent.blur(weight);
    await waitFor(() => expect(api.activeWorkout?.exercises[0].sets).toHaveLength(2));
    finish();

    expect(finishDialog()).not.toBeNull();
  });

  it('saves once the empty row is swiped away', async () => {
    renderScreen(withEmptyRow(), { past: true });
    await waitFor(() => expect(api.activeWorkout?.exercises[0].sets).toHaveLength(1));
    expand('Kniebeuge');
    swipeLeft(rowOf(inputs().find((i) => i.value === '0')!)); // the 0 kg row

    finish();

    expect(finishDialog()).not.toBeNull();
  });

  it('does not lock an Übung behind the one above it', async () => {
    renderScreen(
      [
        exercise('a', 'Kniebeuge', { plannedSets: [planned(1, { weight: 0 })] }),
        exercise('b', 'Bankdrücken', { plannedSets: [planned(1)] }),
      ],
      { past: true },
    );

    await waitFor(() => expect(api.activeWorkout?.exercises[1].sets).toHaveLength(1));
    expect(notify.warning).not.toHaveBeenCalled();
  });
});
