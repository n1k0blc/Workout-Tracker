// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/messages/de.json';

const { notify, logSet, updateSet, workoutState, units } = vi.hoisted(() => ({
  notify: { error: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn() },
  logSet: vi.fn(),
  updateSet: vi.fn(),
  workoutState: { isPastWorkout: false },
  units: { system: 'METRIC' as 'METRIC' | 'IMPERIAL' },
}));

vi.mock('@/lib/toast', () => ({ notify }));
vi.mock('@/lib/api', () => ({ apiClient: { getExercises: vi.fn().mockResolvedValue([]) } }));
vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: { unitSystem: units.system } }) }));
vi.mock('@/lib/workout-context', async () => {
  const { useFakeSetRowState } = await import('@/test-utils/set-row-state');
  return {
    useWorkout: () => ({
      ...useFakeSetRowState(),
      removeExercise: vi.fn(),
      replaceExercise: vi.fn(),
      logSet,
      updateSet,
      loading: false,
      activeWorkout: { id: 'w1', exercises: [] },
      setActiveWorkoutDirectly: vi.fn(),
      isPastWorkout: workoutState.isPastWorkout,
      pastWorkoutDuration: 0,
    }),
  };
});

import ExerciseCard from '@/components/workout/exercise-card';
import { Equipment, SetType, type ExerciseLog, type PlannedSet, type SetLog } from '@/types';

type CardProps = Partial<React.ComponentProps<typeof ExerciseCard>>;

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
  completedAt: new Date().toISOString(),
  ...over,
});

const exerciseOf = (over: Partial<ExerciseLog> = {}): ExerciseLog =>
  ({
    id: 'ex1',
    exerciseId: 'e1',
    exerciseName: 'Kniebeuge',
    order: 1,
    equipment: Equipment.BARBELL,
    plannedSets: [planned(1)],
    sets: [],
    ...over,
  }) as ExerciseLog;

function renderCard(exercise: ExerciseLog, props: CardProps = {}) {
  return render(
    <NextIntlClientProvider locale="de" messages={messages}>
      <ExerciseCard exercise={exercise} exerciseNumber={1} mode="active" defaultOpen {...props} />
    </NextIntlClientProvider>,
  );
}

const inputs = () => screen.getAllByRole('spinbutton') as HTMLInputElement[];
const tick = () => fireEvent.click(screen.getAllByTitle('Satz loggen (oder Swipe LTR)')[0]);

/** The row container that carries the swipe handlers. */
const rowOf = (input: HTMLElement) => input.closest('.touch-pan-y') as HTMLElement;

/** jsdom has no PointerEvent constructor that keeps clientX, so build the events by hand. */
function pointer(type: string, target: HTMLElement, clientX: number) {
  const event = new MouseEvent(type, { bubbles: true, clientX, clientY: 0 });
  fireEvent(target, event);
}
function swipe(row: HTMLElement, from: number, to: number) {
  pointer('pointerdown', row, from);
  pointer('pointermove', row, to);
  pointer('pointerup', row, to);
}
const swipeRight = (row: HTMLElement) => swipe(row, 0, 120); // log
const swipeLeft = (row: HTMLElement) => swipe(row, 120, 0); // discard

const flush = () => waitFor(() => undefined);

beforeEach(() => {
  logSet.mockReset().mockResolvedValue(undefined);
  updateSet.mockReset();
  Object.values(notify).forEach((fn) => fn.mockReset());
  workoutState.isPastWorkout = false;
  units.system = 'METRIC';
});
afterEach(cleanup);

describe.each([
  ['tick', () => tick()],
  ['swipe', () => swipeRight(rowOf(inputs()[0]))],
])('logging a working set by %s', (_name, logIt) => {
  it('logs a complete set', async () => {
    renderCard(exerciseOf());

    logIt();
    await flush();

    expect(logSet).toHaveBeenCalledWith(
      'ex1',
      expect.objectContaining({ setNumber: 1, weight: 60, reps: 10, rir: 2, setType: SetType.WORKING }),
    );
    expect(notify.warning).not.toHaveBeenCalled();
  });

  it('refuses a set without RIR: a toast names it and the field shows an error', async () => {
    renderCard(exerciseOf());
    fireEvent.change(inputs()[2], { target: { value: '' } });

    logIt();
    await flush();

    expect(logSet).not.toHaveBeenCalled();
    expect(notify.warning).toHaveBeenCalledTimes(1);
    expect(notify.warning.mock.calls[0][0]).toContain('RIR');
    expect((inputs()[2]).getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Bitte gib den RIR ein.')).not.toBeNull();
    expect((inputs()[0]).getAttribute('aria-invalid')).toBeNull();
  });

  it('names every missing field in the toast and marks each one', async () => {
    renderCard(exerciseOf());
    fireEvent.change(inputs()[0], { target: { value: '' } });
    fireEvent.change(inputs()[1], { target: { value: '' } });

    logIt();
    await flush();

    expect(logSet).not.toHaveBeenCalled();
    const toast = notify.warning.mock.calls[0][0] as string;
    expect(toast).toContain('Gewicht');
    expect(toast).toContain('Wdh');
    expect((inputs()[0]).getAttribute('aria-invalid')).toBe('true');
    expect((inputs()[1]).getAttribute('aria-invalid')).toBe('true');
  });

  it('refuses 0 kg on a barbell exercise, naming the unit', async () => {
    renderCard(exerciseOf({ plannedSets: [planned(1, { weight: 0 })] }));

    logIt();
    await flush();

    expect(logSet).not.toHaveBeenCalled();
    expect(screen.getByText('0 kg ist nur bei Körpergewicht-Übungen möglich.')).not.toBeNull();
  });

  it('logs 0 kg on a Bodyweight exercise', async () => {
    renderCard(exerciseOf({ equipment: Equipment.BODYWEIGHT, plannedSets: [planned(1, { weight: 0 })] }));

    logIt();
    await flush();

    expect(logSet).toHaveBeenCalledWith('ex1', expect.objectContaining({ weight: 0, reps: 10 }));
  });

  it('clears a field error as soon as the field is filled in', async () => {
    renderCard(exerciseOf());
    fireEvent.change(inputs()[2], { target: { value: '' } });
    logIt();
    await flush();
    expect((inputs()[2]).getAttribute('aria-invalid')).toBe('true');

    fireEvent.change(inputs()[2], { target: { value: '1' } });

    expect((inputs()[2]).getAttribute('aria-invalid')).toBeNull();
    expect(screen.queryByText('Bitte gib den RIR ein.')).toBeNull();
  });
});

describe('logging a unilateral set', () => {
  const unilateral = () =>
    exerciseOf({
      isUnilateral: true,
      plannedSets: [
        planned(1, { repsLeft: 10, repsRight: 10, weightLeft: 20, weightRight: 20, rirLeft: 2, rirRight: 2 }),
      ],
    });

  it('needs every per-side field: the tick stays active and answers with a toast', async () => {
    renderCard(unilateral());
    // left: weight, reps, RIR; right: weight, reps, RIR
    fireEvent.change(inputs()[5], { target: { value: '' } });

    tick();
    await flush();

    expect(logSet).not.toHaveBeenCalled();
    expect(notify.warning.mock.calls[0][0]).toContain('RIR (R)');
    expect((inputs()[5]).getAttribute('aria-invalid')).toBe('true');
    expect((inputs()[2]).getAttribute('aria-invalid')).toBeNull();
  });

  it('swipe is held to the same rule', async () => {
    renderCard(unilateral());
    fireEvent.change(inputs()[4], { target: { value: '' } });

    swipeRight(rowOf(inputs()[0]));
    await flush();

    expect(logSet).not.toHaveBeenCalled();
    expect(notify.warning.mock.calls[0][0]).toContain('Wdh (R)');
  });

  it('logs with both sides complete, RIR on both', async () => {
    renderCard(unilateral());

    tick();
    await flush();

    expect(logSet).toHaveBeenCalledWith(
      'ex1',
      expect.objectContaining({ repsLeft: 10, repsRight: 10, rirLeft: 2, rirRight: 2 }),
    );
  });
});

describe('warm-up sets have no RIR', () => {
  const warmupExercise = () =>
    exerciseOf({ plannedSets: [planned(1, { setType: SetType.WARMUP, rir: undefined }), planned(2)] });

  it('shows no RIR field on a warm-up row, only weight and reps', () => {
    renderCard(warmupExercise());

    // warm-up: weight, reps; working: weight, reps, RIR
    expect(inputs()).toHaveLength(5);
  });

  it('logs a warm-up with weight and reps, and no RIR', async () => {
    renderCard(warmupExercise());

    tick();
    await flush();

    const payload = logSet.mock.calls[0][1];
    expect(payload).toMatchObject({ setType: SetType.WARMUP, weight: 60, reps: 10 });
    expect(payload.rir).toBeUndefined();
  });

  it('drops the RIR field when a row is switched to warm-up, and forgets the value', async () => {
    renderCard(exerciseOf());
    expect(inputs()).toHaveLength(3);

    fireEvent.click(screen.getByTitle('Arbeit'));
    expect(inputs()).toHaveLength(2);

    fireEvent.click(screen.getByTitle('Aufwärmen'));
    // Back to working: RIR is empty and is an error, not the old 2.
    expect(inputs()).toHaveLength(3);
    expect(inputs()[2].value).toBe('');
    expect((inputs()[2]).getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Bitte gib den RIR ein.')).not.toBeNull();
  });

  it('refuses to log a row switched back to working until RIR is entered', async () => {
    renderCard(exerciseOf());
    fireEvent.click(screen.getByTitle('Arbeit'));
    fireEvent.click(screen.getByTitle('Aufwärmen'));

    tick();
    await flush();
    expect(logSet).not.toHaveBeenCalled();

    fireEvent.change(inputs()[2], { target: { value: '1' } });
    tick();
    await flush();
    expect(logSet).toHaveBeenCalledWith('ex1', expect.objectContaining({ rir: 1 }));
  });

  it('clears the RIR of a logged working set switched to warm-up', () => {
    renderCard(exerciseOf({ sets: [logged(1)] }));

    fireEvent.click(screen.getByTitle('Arbeit'));

    expect(updateSet).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ setType: SetType.WARMUP, rir: undefined }),
    );
    expect(updateSet.mock.calls[0][1]).toHaveProperty('rir', undefined);
  });

  it('marks the missing RIR of a logged warm-up switched to working', () => {
    renderCard(exerciseOf({ sets: [logged(1, { setType: SetType.WARMUP, rir: undefined })] }));
    expect(inputs()).toHaveLength(2);

    // The logged row is the card's own state in the test, so render the switched set directly.
    cleanup();
    renderCard(exerciseOf({ sets: [logged(1, { setType: SetType.WORKING, rir: undefined })] }));

    expect(inputs()).toHaveLength(3);
    expect((inputs()[2]).getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Bitte gib den RIR ein.')).not.toBeNull();
  });

  it('omits RIR on both sides of a unilateral row switched to warm-up', () => {
    renderCard(
      exerciseOf({
        isUnilateral: true,
        plannedSets: [
          planned(1, { repsLeft: 10, repsRight: 10, weightLeft: 20, weightRight: 20, rirLeft: 2, rirRight: 2 }),
        ],
      }),
    );
    expect(inputs()).toHaveLength(6);

    fireEvent.click(screen.getByTitle('Arbeit'));

    expect(inputs()).toHaveLength(4);
  });
});

describe('the amber RIR hint', () => {
  it('shows from RIR 3 on a working set and does not block logging', async () => {
    renderCard(exerciseOf());

    fireEvent.change(inputs()[2], { target: { value: '3' } });

    expect(screen.getByText('Ziel: höchstens RIR 2.')).not.toBeNull();
    expect((inputs()[2]).getAttribute('data-warning')).toBe('true');
    expect((inputs()[2]).getAttribute('aria-invalid')).toBeNull();

    tick();
    await flush();
    expect(logSet).toHaveBeenCalledWith('ex1', expect.objectContaining({ rir: 3 }));
  });

  it('is silent at RIR 2', () => {
    renderCard(exerciseOf());
    fireEvent.change(inputs()[2], { target: { value: '2' } });
    expect(screen.queryByText('Ziel: höchstens RIR 2.')).toBeNull();
  });

  it('shows on an already logged set', () => {
    renderCard(exerciseOf({ sets: [logged(1, { rir: 4 })] }));
    expect(screen.getByText('Ziel: höchstens RIR 2.')).not.toBeNull();
  });

  it('shows in the plan editors too', () => {
    renderCard(exerciseOf({ plannedSets: [planned(1, { rir: 5 })] }), {
      mode: 'edit',
      allowLogging: false,
      onUpdatePlannedSet: vi.fn(),
    });
    expect(screen.getByText('Ziel: höchstens RIR 2.')).not.toBeNull();
  });
});

describe('the plan editors require RIR on a working set', () => {
  const planProps = () => ({ mode: 'edit' as const, allowLogging: false, onUpdatePlannedSet: vi.fn() });

  it('reports a cleared RIR as absent, never as 0, and shows a field error', () => {
    const props = planProps();
    renderCard(exerciseOf(), props);

    fireEvent.change(inputs()[2], { target: { value: '' } });

    const patch = props.onUpdatePlannedSet.mock.calls.at(-1)![2];
    expect(patch).toHaveProperty('rir', undefined);
    expect(patch.rir).not.toBe(0);
    expect((inputs()[2]).getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Bitte gib den RIR ein.')).not.toBeNull();
  });

  it('keeps RIR 0 as a real value', () => {
    const props = planProps();
    renderCard(exerciseOf(), props);

    fireEvent.change(inputs()[2], { target: { value: '0' } });

    expect(props.onUpdatePlannedSet).toHaveBeenLastCalledWith('ex1', 1, { rir: 0 });
    expect((inputs()[2]).getAttribute('aria-invalid')).toBeNull();
  });

  it('marks a working set that arrives without RIR', () => {
    renderCard(exerciseOf({ plannedSets: [planned(1, { rir: undefined })] }), planProps());
    expect((inputs()[2]).getAttribute('aria-invalid')).toBe('true');
  });

  it('asks nothing of a warm-up row and clears its plan RIR on the switch', () => {
    const props = planProps();
    renderCard(exerciseOf(), props);

    fireEvent.click(screen.getByTitle('Arbeit'));

    const patch = props.onUpdatePlannedSet.mock.calls.at(-1)![2];
    expect(patch).toMatchObject({ setType: SetType.WARMUP });
    expect(patch).toHaveProperty('rir', undefined);
    expect(inputs()).toHaveLength(2);
  });
});

describe('sets are logged in order in the active workout', () => {
  const twoSets = () => exerciseOf({ plannedSets: [planned(1), planned(2)] });

  it('refuses set 2 while set 1 is open, with a toast', async () => {
    renderCard(twoSets());

    fireEvent.click(screen.getAllByTitle('Satz loggen (oder Swipe LTR)')[1]);
    await flush();

    expect(logSet).not.toHaveBeenCalled();
    expect(notify.warning).toHaveBeenCalledWith('Logge zuerst Satz 1 oder wische ihn weg.');
  });

  it('refuses the same on a swipe', async () => {
    renderCard(twoSets());

    swipeRight(rowOf(inputs()[3]));
    await flush();

    expect(logSet).not.toHaveBeenCalled();
    expect(notify.warning).toHaveBeenCalledWith('Logge zuerst Satz 1 oder wische ihn weg.');
  });

  it('allows set 2 once set 1 is logged', async () => {
    renderCard(exerciseOf({ plannedSets: [planned(1), planned(2)], sets: [logged(1)] }));

    tick();
    await flush();

    expect(logSet).toHaveBeenCalledWith('ex1', expect.objectContaining({ setNumber: 2 }));
  });

  it('allows set 2 once set 1 is swiped away', async () => {
    renderCard(twoSets());

    swipeLeft(rowOf(inputs()[0]));
    tick();
    await flush();

    expect(logSet).toHaveBeenCalledWith('ex1', expect.objectContaining({ setNumber: 2 }));
    expect(notify.warning).not.toHaveBeenCalled();
  });

  it('is not enforced when tracking a past workout (no logging control)', async () => {
    workoutState.isPastWorkout = true;
    renderCard(twoSets(), { mode: 'edit', allowLogging: false });
    await flush();

    // Both rows were committed by auto-commit; nothing blocked the second.
    expect(logSet.mock.calls.map((c) => c[1].setNumber).sort()).toEqual([1, 2]);
    expect(notify.warning).not.toHaveBeenCalled();
  });
});

describe('tracking a past workout (auto-commit)', () => {
  const pastProps = { mode: 'edit' as const, allowLogging: false };

  it('commits a 0 kg Bodyweight set', async () => {
    workoutState.isPastWorkout = true;
    renderCard(
      exerciseOf({ equipment: Equipment.BODYWEIGHT, plannedSets: [planned(1, { weight: 0, reps: 8 })] }),
      pastProps,
    );
    await flush();

    expect(logSet).toHaveBeenCalledWith('ex1', expect.objectContaining({ weight: 0, reps: 8 }));
  });

  it('does not commit 0 kg on other equipment, and does not toast about it', async () => {
    workoutState.isPastWorkout = true;
    renderCard(exerciseOf({ plannedSets: [planned(1, { weight: 0 })] }), pastProps);
    await flush();

    expect(logSet).not.toHaveBeenCalled();
    expect(notify.warning).not.toHaveBeenCalled();
  });

  it('does not commit a working set without RIR', async () => {
    workoutState.isPastWorkout = true;
    renderCard(exerciseOf({ plannedSets: [planned(1, { rir: undefined })] }), pastProps);
    await flush();

    expect(logSet).not.toHaveBeenCalled();
  });
});

describe('editing an old workout in Verlauf', () => {
  const historyProps = () => ({
    mode: 'edit' as const,
    allowLogging: false,
    allowSetManagement: false,
    onUpdateSet: vi.fn(),
  });
  const oldSetWithoutRir = () => exerciseOf({ plannedSets: undefined, sets: [logged(1, { rir: undefined })] });

  it('does not flag an unchanged old working set that has no RIR', () => {
    renderCard(oldSetWithoutRir(), historyProps());

    expect((inputs()[2]).getAttribute('aria-invalid')).toBeNull();
    expect(screen.queryByText('Bitte gib den RIR ein.')).toBeNull();
  });

  it('applies the rule once the user changes that set', () => {
    renderCard(oldSetWithoutRir(), historyProps());

    fireEvent.change(inputs()[1], { target: { value: '12' } });

    expect((inputs()[2]).getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Bitte gib den RIR ein.')).not.toBeNull();
  });

  it('leaves other unchanged sets alone', () => {
    renderCard(
      exerciseOf({
        plannedSets: undefined,
        sets: [logged(1, { rir: undefined }), logged(2, { rir: undefined })],
      }),
      historyProps(),
    );

    fireEvent.change(inputs()[1], { target: { value: '12' } });

    expect((inputs()[2]).getAttribute('aria-invalid')).toBe('true');
    expect((inputs()[5]).getAttribute('aria-invalid')).toBeNull();
  });
});

describe('field errors sit under their row', () => {
  it('renders the message inside the same swipe row as the field', async () => {
    renderCard(exerciseOf());
    fireEvent.change(inputs()[2], { target: { value: '' } });
    tick();
    await flush();

    expect(within(rowOf(inputs()[2])).getByText('Bitte gib den RIR ein.')).not.toBeNull();
  });
});

describe('upper bounds on the set inputs', () => {
  const heavy = (kg: number, over: Partial<PlannedSet> = {}) => exerciseOf({ plannedSets: [planned(1, { weight: kg, ...over })] });

  it('tells the input what it may hold: reps 1-100 and RIR 0-10 in whole steps, weight up to 1000 kg', () => {
    renderCard(exerciseOf());

    const [weight, reps, rir] = inputs();
    expect([weight.min, weight.max]).toEqual(['0', '1000']);
    expect([reps.min, reps.max, reps.step]).toEqual(['1', '100', '1']);
    expect([rir.min, rir.max, rir.step]).toEqual(['0', '10', '1']);
  });

  it('states the weight limit in pounds for a pound user, and judges the typed pounds', () => {
    units.system = 'IMPERIAL';
    renderCard(exerciseOf());

    expect(inputs()[0].max).toBe('2204.6');
  });

  it.each([
    ['tick', () => tick()],
    ['swipe', () => swipeRight(rowOf(inputs()[0]))],
  ])('refuses 1000.5 kg by %s with a field error, and logs 1000 kg', async (_name, logIt) => {
    renderCard(heavy(1000.5));

    logIt();
    await flush();

    expect(logSet).not.toHaveBeenCalled();
    expect(inputs()[0].getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Das Gewicht darf höchstens 1.000 kg betragen.')).not.toBeNull();
    expect(notify.warning).toHaveBeenCalledTimes(1);

    fireEvent.change(inputs()[0], { target: { value: '1000' } });
    logIt();
    await flush();
    expect(logSet).toHaveBeenCalledWith('ex1', expect.objectContaining({ weight: 1000 }));
  });

  it('names the limit in pounds for a pound user', async () => {
    units.system = 'IMPERIAL';
    renderCard(heavy(1000.5));

    tick();
    await flush();

    expect(screen.getByText('Das Gewicht darf höchstens 2.204,6 lb betragen.')).not.toBeNull();
  });

  it('refuses 101 reps and RIR 11, accepts 100 and 10', async () => {
    renderCard(exerciseOf({ plannedSets: [planned(1, { reps: 101, rir: 11 })] }));

    tick();
    await flush();

    expect(logSet).not.toHaveBeenCalled();
    expect(inputs()[1].getAttribute('aria-invalid')).toBe('true');
    expect(inputs()[2].getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Es sind höchstens 100 Wiederholungen möglich.')).not.toBeNull();
    expect(screen.getByText('Der RIR darf höchstens 10 betragen.')).not.toBeNull();

    fireEvent.change(inputs()[1], { target: { value: '100' } });
    fireEvent.change(inputs()[2], { target: { value: '10' } });
    tick();
    await flush();
    expect(logSet).toHaveBeenCalledWith('ex1', expect.objectContaining({ reps: 100, rir: 10 }));
  });

  it('flags a logged set edited past the bound', () => {
    renderCard(exerciseOf({ plannedSets: undefined, sets: [logged(1)] }));

    fireEvent.change(inputs()[1], { target: { value: '101' } });

    expect(inputs()[1].getAttribute('aria-invalid')).toBe('true');
  });
});

describe('at most 20 sets per Uebung', () => {
  const addSetButton = () => screen.getByRole('button', { name: /Satz hinzufügen/ });
  const withSets = (count: number) =>
    exerciseOf({ plannedSets: Array.from({ length: count }, (_, i) => planned(i + 1)) });

  it('adds the 20th set, and answers the 21st with a toast', () => {
    const onAddSet = vi.fn();
    renderCard(withSets(19), { allowSetManagement: true, onAddSet });
    fireEvent.click(addSetButton());
    expect(onAddSet).toHaveBeenCalledTimes(1);
    cleanup();

    const refused = vi.fn();
    renderCard(withSets(20), { allowSetManagement: true, onAddSet: refused });
    fireEvent.click(addSetButton());
    expect(refused).not.toHaveBeenCalled();
    expect(notify.warning).toHaveBeenCalledWith('Eine Übung kann höchstens 20 Sätze enthalten.');
  });

  it('counts added rows in the live workout too', () => {
    renderCard(withSets(20));
    fireEvent.click(addSetButton());

    expect(notify.warning).toHaveBeenCalledWith('Eine Übung kann höchstens 20 Sätze enthalten.');
    expect(inputs()).toHaveLength(60);
  });
});
