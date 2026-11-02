import { afterEach, describe, expect, it } from 'vitest';
import {
  ASK_AGAIN_AFTER_MS,
  COUNTDOWN_MS,
  FORGOTTEN_AFTER_MS,
  autoSaveEnd,
  decideOutcome,
  isPromptDue,
  resolveStartedAt,
  secondsLeft,
} from '@/lib/forgotten-workout';
import { SetType, type Workout } from '@/types';

const HOUR = 3_600_000;
const T0 = Date.parse('2026-11-02T08:00:00.000Z');

describe('constants', () => {
  it('asks after 5 hours, again after 1 hour, and counts down 5 minutes', () => {
    expect(FORGOTTEN_AFTER_MS).toBe(5 * HOUR);
    expect(ASK_AGAIN_AFTER_MS).toBe(HOUR);
    expect(COUNTDOWN_MS).toBe(5 * 60_000);
  });
});

describe('isPromptDue', () => {
  it('is not due just before 5 hours and is due from 5 hours on', () => {
    expect(isPromptDue({ startedAt: T0, askAgainAt: null, now: T0 + 5 * HOUR - 1 })).toBe(false);
    expect(isPromptDue({ startedAt: T0, askAgainAt: null, now: T0 + 5 * HOUR })).toBe(true);
  });

  it('is due when the app is opened much later than 5 hours', () => {
    expect(isPromptDue({ startedAt: T0, askAgainAt: null, now: T0 + 30 * HOUR })).toBe(true);
  });

  it('waits for the re-ask time once it is set', () => {
    const askAgainAt = T0 + 6 * HOUR;
    expect(isPromptDue({ startedAt: T0, askAgainAt, now: askAgainAt - 1 })).toBe(false);
    expect(isPromptDue({ startedAt: T0, askAgainAt, now: askAgainAt })).toBe(true);
  });

  it('is never due without a start', () => {
    expect(isPromptDue({ startedAt: null, askAgainAt: null, now: T0 + 99 * HOUR })).toBe(false);
  });
});

describe('secondsLeft', () => {
  it('rounds up so the last second still shows 1, and never goes below 0', () => {
    expect(secondsLeft(T0 + 300_000, T0)).toBe(300);
    expect(secondsLeft(T0 + 1_001, T0)).toBe(2);
    expect(secondsLeft(T0 + 1, T0)).toBe(1);
    expect(secondsLeft(T0, T0)).toBe(0);
    expect(secondsLeft(T0 - 5_000, T0)).toBe(0);
  });
});

describe('resolveStartedAt', () => {
  const workout = { date: '2026-11-02T07:00:00.000Z', createdAt: '2026-11-02T07:00:01.000Z' };

  it('prefers the timestamp stored with the draft', () => {
    expect(resolveStartedAt({ startedAt: T0 }, workout, T0 + HOUR)).toBe(T0);
  });

  it('falls back to when the workout was created for a draft that predates the timestamp', () => {
    expect(resolveStartedAt({}, workout, T0 + HOUR)).toBe(Date.parse(workout.createdAt));
  });

  it('falls back to the workout date, then to now', () => {
    expect(resolveStartedAt({}, { date: workout.date }, T0 + HOUR)).toBe(Date.parse(workout.date));
    expect(resolveStartedAt({}, { date: 'garbage' }, T0 + HOUR)).toBe(T0 + HOUR);
  });

  it('ignores a stored value that is not a finite number', () => {
    expect(resolveStartedAt({ startedAt: 'x' as unknown as number }, workout, T0)).toBe(Date.parse(workout.createdAt));
  });
});

const set = (id: string, setNumber: number, completedAt: string, rir: number | null = 2) => ({
  id,
  setNumber,
  setType: SetType.WORKING,
  reps: 10,
  weight: 50,
  rir: rir ?? undefined,
  completedAt,
});

const exercise = (id: string, sets: ReturnType<typeof set>[], plannedCount = sets.length) => ({
  id,
  exerciseId: `e-${id}`,
  exerciseName: `Uebung ${id}`,
  order: 1,
  sets,
  plannedSets: Array.from({ length: plannedCount }, (_, i) => ({
    id: `p${id}${i}`,
    order: i + 1,
    setType: SetType.WORKING,
    reps: 10,
    weight: 50,
    rest: 90,
  })),
});

const workoutOf = (...exercises: ReturnType<typeof exercise>[]) => ({ exercises }) as unknown as Workout;

describe('autoSaveEnd', () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTz;
  });

  // The first cases read the date in UTC so they do not depend on the machine's zone.
  it('ends at the last logged set, whichever Uebung it belongs to', () => {
    process.env.TZ = 'UTC';
    const w = workoutOf(
      exercise('a', [set('s1', 1, '2026-11-02T08:30:00.000Z'), set('s2', 2, '2026-11-02T09:15:30.000Z')]),
      exercise('b', [set('s3', 1, '2026-11-02T08:50:00.000Z')]),
    );
    const end = autoSaveEnd(w, T0);
    expect(end).toEqual({ totalDuration: 75 * 60 + 30, localDate: '2026-11-02' });
  });

  it('takes the date of that set, not of the day it is saved on', () => {
    process.env.TZ = 'UTC';
    const w = workoutOf(exercise('a', [set('s1', 1, '2026-11-02T22:30:00.000Z')]));
    // Saved the next morning, but the last set was logged on the 2nd.
    expect(autoSaveEnd(w, T0)?.localDate).toBe('2026-11-02');
  });

  it("reads the date in the user's zone, not UTC", () => {
    process.env.TZ = 'Europe/Berlin';
    const w = workoutOf(exercise('a', [set('s1', 1, '2026-11-02T23:30:00.000Z')]));
    expect(autoSaveEnd(w, T0)?.localDate).toBe('2026-11-03');
  });

  it('never reports a negative duration', () => {
    const w = workoutOf(exercise('a', [set('s1', 1, '2026-11-02T07:00:00.000Z')]));
    expect(autoSaveEnd(w, T0)?.totalDuration).toBe(0);
  });

  it('is null when no set carries a usable time', () => {
    expect(autoSaveEnd(workoutOf(exercise('a', [])), T0)).toBeNull();
    const w = workoutOf(exercise('a', [set('s1', 1, 'garbage')]));
    expect(autoSaveEnd(w, T0)).toBeNull();
  });
});

describe('decideOutcome', () => {
  it('saves a complete workout', () => {
    const w = workoutOf(exercise('a', [set('s1', 1, '2026-11-02T08:30:00.000Z')]));
    expect(decideOutcome(w, { skipped: {}, added: {} })).toBe('save');
  });

  it('discards a workout with a planned set still open', () => {
    const w = workoutOf(exercise('a', [set('s1', 1, '2026-11-02T08:30:00.000Z')], 2));
    expect(decideOutcome(w, { skipped: {}, added: {} })).toBe('discard');
  });

  it('saves it once the open set has been swiped away', () => {
    const w = workoutOf(exercise('a', [set('s1', 1, '2026-11-02T08:30:00.000Z')], 2));
    expect(decideOutcome(w, { skipped: { a: [2] }, added: {} })).toBe('save');
  });

  it('discards a working set without RIR', () => {
    const w = workoutOf(exercise('a', [set('s1', 1, '2026-11-02T08:30:00.000Z', null)]));
    expect(decideOutcome(w, { skipped: {}, added: {} })).toBe('discard');
  });

  it('discards a workout in which nothing was logged', () => {
    expect(decideOutcome(workoutOf(), { skipped: {}, added: {} })).toBe('discard');
  });
});
