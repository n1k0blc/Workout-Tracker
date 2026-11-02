// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useEffect } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/messages/de.json';

const { createWorkout, notify } = vi.hoisted(() => ({
  createWorkout: vi.fn(),
  notify: { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

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
vi.mock('@/lib/toast', () => ({ notify }));

import { WorkoutProvider, useWorkout } from '@/lib/workout-context';
import { SetType, type PlannedSet, type Workout } from '@/types';

const HOUR = 3_600_000;
const MINUTE = 60_000;
const T0 = Date.parse('2026-11-02T08:00:00.000Z');
const DRAFT = 'activeWorkoutDraft::u1';
const META = 'activeWorkoutDraftMeta::u1';
const OUTCOME = 'forgottenWorkoutOutcome::u1';

const planned = (order: number): PlannedSet => ({
  id: `p${order}`,
  order,
  setType: SetType.WORKING,
  reps: 10,
  weight: 60,
  rir: 2,
  rest: 90,
});

/** One Uebung with one logged set (30 minutes in) and `plannedCount` planned sets. */
const workout = (plannedCount = 1, startedAt = T0): Workout =>
  ({
    id: 'local-workout-1',
    date: new Date(startedAt).toISOString(),
    localDate: '2026-11-02',
    isFreeWorkout: true,
    createdAt: new Date(startedAt).toISOString(),
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
            completedAt: new Date(startedAt + 30 * MINUTE).toISOString(),
          },
        ],
      },
    ],
  }) as unknown as Workout;

function seedDraft(wk: Workout, meta: Record<string, unknown> = {}) {
  localStorage.setItem(DRAFT, JSON.stringify(wk));
  localStorage.setItem(META, JSON.stringify({ isPastWorkout: false, pastWorkoutDuration: 0, ...meta }));
}

const storedMeta = () => JSON.parse(localStorage.getItem(META) ?? 'null');

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

/** What a tab exposes to the test. */
type Tab = { api: () => ReturnType<typeof useWorkout> };

function mountTab(): Tab {
  let latest: ReturnType<typeof useWorkout>;
  function Probe() {
    const ctx = useWorkout();
    useEffect(() => {
      latest = ctx;
    });
    return null;
  }
  render(
    <NextIntlClientProvider locale="de" messages={messages}>
      <WorkoutProvider>
        <Probe />
      </WorkoutProvider>
    </NextIntlClientProvider>,
  );
  return { api: () => latest };
}

/** Move the clock without running timers (a closed laptop, a backgrounded phone), then let one tick fire. */
async function jump(ms: number) {
  await act(async () => {
    vi.setSystemTime(Date.now() + ms);
    await vi.advanceTimersByTimeAsync(1000);
  });
}

/** Let time pass the normal way, firing every timer on the way. */
async function pass(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function startLive(tab: Tab, wk: Workout = workout()) {
  await act(async () => {
    tab.api().setActiveWorkoutDirectly(wk);
  });
}

describe('the 5-hour prompt in workout-context', () => {
  const originalTz = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = 'UTC';
    localStorage.clear();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    createWorkout.mockReset();
    createWorkout.mockResolvedValue({ id: 'saved-1' });
    Object.values(notify).forEach((fn) => fn.mockReset());
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    process.env.TZ = originalTz;
    delete (navigator as { locks?: unknown }).locks;
  });

  describe('when it appears', () => {
    it('stays quiet before 5 hours and asks at 5 hours', async () => {
      const tab = mountTab();
      await startLive(tab);

      await jump(5 * HOUR - 2 * MINUTE);
      expect(tab.api().forgottenPrompt).toBeNull();

      await jump(2 * MINUTE);
      expect(tab.api().forgottenPrompt).toEqual({ secondsLeft: 300 });
    });

    it('counts paused time towards the 5 hours', async () => {
      const tab = mountTab();
      await startLive(tab);
      await pass(10 * MINUTE);
      await act(async () => tab.api().togglePause());

      await jump(5 * HOUR);

      expect(tab.api().isPaused).toBe(true);
      expect(tab.api().forgottenPrompt).not.toBeNull();
    });

    it('counts paused time that was resumed again, which shifts the timer start', async () => {
      const tab = mountTab();
      await startLive(tab);
      await pass(10 * MINUTE);
      await act(async () => tab.api().togglePause());
      await jump(4 * HOUR + 30 * MINUTE);
      await act(async () => tab.api().togglePause());
      // The timer reads about 10 minutes; the workout has been open for 4h40.
      expect(tab.api().workoutDuration).toBeLessThan(15 * 60);

      await jump(25 * MINUTE);

      expect(tab.api().forgottenPrompt).not.toBeNull();
    });

    it('asks as soon as the app is opened later than 5 hours', async () => {
      seedDraft(workout(), { startedAt: T0 });
      vi.setSystemTime(T0 + 9 * HOUR);

      const tab = mountTab();
      await pass(1000);

      expect(tab.api().activeWorkout).not.toBeNull();
      expect(tab.api().forgottenPrompt).toEqual({ secondsLeft: 300 });
    });

    it('works for a draft saved before the start timestamp existed', async () => {
      seedDraft(workout()); // no startedAt in the meta; createdAt is T0
      vi.setSystemTime(T0 + 6 * HOUR);

      const tab = mountTab();
      await pass(1000);

      expect(tab.api().forgottenPrompt).not.toBeNull();
    });

    it('never asks while tracking a past workout', async () => {
      const tab = mountTab();
      await act(async () => {
        tab.api().setActiveWorkoutDirectly(workout(), true, 3600);
      });

      await jump(20 * HOUR);
      await pass(10 * MINUTE);

      expect(tab.api().forgottenPrompt).toBeNull();
      expect(createWorkout).not.toHaveBeenCalled();
      expect(tab.api().activeWorkout).not.toBeNull();
    });

    it('stores the start of a live session with its draft, where pausing cannot reach it', async () => {
      const tab = mountTab();
      await startLive(tab);
      expect(storedMeta().startedAt).toBe(T0);
    });
  });

  describe('Weiter trainieren', () => {
    it('closes the prompt and asks again after 1 hour', async () => {
      const tab = mountTab();
      await startLive(tab);
      await jump(5 * HOUR);
      const answeredAt = Date.now();

      await act(async () => tab.api().keepTraining());
      expect(tab.api().forgottenPrompt).toBeNull();

      await jump(59 * MINUTE);
      expect(tab.api().forgottenPrompt).toBeNull();

      await jump(2 * MINUTE);
      expect(tab.api().forgottenPrompt).not.toBeNull();
      expect(answeredAt + HOUR).toBeLessThanOrEqual(Date.now());
    });

    it('stores the re-ask time with the draft so a reload still waits', async () => {
      const tab = mountTab();
      await startLive(tab);
      await jump(5 * HOUR);
      const answeredAt = Date.now();
      await act(async () => tab.api().keepTraining());
      expect(storedMeta().askAgainAt).toBe(answeredAt + HOUR);

      cleanup();
      const reopened = mountTab();
      await pass(1000);
      expect(reopened.api().activeWorkout).not.toBeNull();
      expect(reopened.api().forgottenPrompt).toBeNull();

      await jump(HOUR);
      expect(reopened.api().forgottenPrompt).not.toBeNull();
    });
  });

  describe('the countdown', () => {
    it('runs down while the app is on screen', async () => {
      const tab = mountTab();
      await startLive(tab);
      await jump(5 * HOUR);

      await pass(4 * MINUTE);

      expect(tab.api().forgottenPrompt?.secondsLeft).toBeLessThanOrEqual(60);
      expect(tab.api().forgottenPrompt?.secondsLeft).toBeGreaterThan(55);
      expect(createWorkout).not.toHaveBeenCalled();
    });

    it('stops while the app is hidden and restarts at a full 5 minutes when it returns', async () => {
      const tab = mountTab();
      await startLive(tab);
      await jump(5 * HOUR);
      await pass(4 * MINUTE);

      await act(async () => setVisibility('hidden'));
      await pass(30 * MINUTE);
      expect(createWorkout).not.toHaveBeenCalled();
      expect(tab.api().activeWorkout).not.toBeNull();

      await act(async () => setVisibility('visible'));
      expect(tab.api().forgottenPrompt).toEqual({ secondsLeft: 300 });
      await pass(4 * MINUTE);
      expect(createWorkout).not.toHaveBeenCalled();
    });

    it('restarts at a full 5 minutes after the device was asleep with the app on screen', async () => {
      const tab = mountTab();
      await startLive(tab);
      await jump(5 * HOUR);
      await pass(4 * MINUTE);

      await jump(3 * HOUR); // the laptop was closed, no visibility event fired

      expect(createWorkout).not.toHaveBeenCalled();
      expect(tab.api().forgottenPrompt).toEqual({ secondsLeft: 300 });
    });

    it('does not run for an app that is opened while hidden', async () => {
      seedDraft(workout(), { startedAt: T0 });
      vi.setSystemTime(T0 + 9 * HOUR);
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });

      const tab = mountTab();
      await pass(20 * MINUTE);
      expect(tab.api().forgottenPrompt).toBeNull();
      expect(createWorkout).not.toHaveBeenCalled();

      await act(async () => setVisibility('visible'));
      expect(tab.api().forgottenPrompt).toEqual({ secondsLeft: 300 });
    });
  });

  describe('with no answer', () => {
    it('saves a complete workout, ending at its last logged set', async () => {
      const tab = mountTab();
      await startLive(tab);
      await jump(9 * HOUR);

      await pass(5 * MINUTE + 2000);

      expect(createWorkout).toHaveBeenCalledTimes(1);
      const payload = createWorkout.mock.calls[0][0];
      expect(payload.totalDuration).toBe(30 * 60);
      expect(payload.localDate).toBe('2026-11-02');
      expect(payload.overwriteBlueprint).toBeUndefined();
      expect(payload.saveAsTemplateMode).toBeUndefined();
      expect(payload.saveAsTemplateName).toBeUndefined();
      expect(payload.overwriteTemplateId).toBeUndefined();
      expect(tab.api().activeWorkout).toBeNull();
      expect(tab.api().forgottenPrompt).toBeNull();
      expect(localStorage.getItem(DRAFT)).toBeNull();
      expect(notify.success).toHaveBeenCalledWith(messages.ForgottenWorkout.saved);
    });

    it('dates the saved workout by its last set, not by the day it is saved', async () => {
      const lastNight = Date.parse('2026-11-01T22:00:00.000Z');
      seedDraft(workout(1, lastNight), { startedAt: lastNight });
      vi.setSystemTime(T0 + 2 * HOUR); // the app is opened the next morning

      mountTab();
      await pass(MINUTE);
      await pass(5 * MINUTE);

      const payload = createWorkout.mock.calls[0][0];
      expect(payload.localDate).toBe('2026-11-01');
      expect(payload.totalDuration).toBe(30 * 60);
    });

    it('discards an incomplete workout and says so', async () => {
      const tab = mountTab();
      await startLive(tab, workout(2)); // set 2 is planned but never logged
      await jump(9 * HOUR);

      await pass(5 * MINUTE + 2000);

      expect(createWorkout).not.toHaveBeenCalled();
      expect(tab.api().activeWorkout).toBeNull();
      expect(localStorage.getItem(DRAFT)).toBeNull();
      expect(notify.warning).toHaveBeenCalledWith(messages.ForgottenWorkout.discarded);
    });

    it('treats a swiped-away set as done', async () => {
      const tab = mountTab();
      await startLive(tab, workout(2));
      await act(async () => tab.api().skipPlannedSet('ex1', 2));
      await jump(9 * HOUR);

      await pass(5 * MINUTE + 2000);

      expect(createWorkout).toHaveBeenCalledTimes(1);
    });

    it('judges a reopened draft by the swipes saved with it', async () => {
      seedDraft(workout(2), { startedAt: T0, skippedSets: { ex1: [2] } });
      vi.setSystemTime(T0 + 9 * HOUR);

      mountTab();
      await pass(MINUTE);
      await pass(5 * MINUTE);

      expect(createWorkout).toHaveBeenCalledTimes(1);
    });

    it('keeps the draft when the automatic save fails, and does not nag at once', async () => {
      createWorkout.mockRejectedValue(new Error('offline'));
      const tab = mountTab();
      await startLive(tab);
      await jump(9 * HOUR);

      await pass(5 * MINUTE + 2000);

      expect(createWorkout).toHaveBeenCalledTimes(1);
      expect(tab.api().activeWorkout).not.toBeNull();
      expect(localStorage.getItem(DRAFT)).not.toBeNull();
      expect(notify.error).toHaveBeenCalledWith(messages.ForgottenWorkout.saveFailed);
      expect(tab.api().forgottenPrompt).toBeNull();

      await pass(10 * MINUTE);
      expect(createWorkout).toHaveBeenCalledTimes(1);

      // After the hour it asks again, and this time the save works.
      createWorkout.mockResolvedValue({ id: 'saved-2' });
      await jump(HOUR);
      expect(tab.api().forgottenPrompt).not.toBeNull();
    });
  });

  describe('the notice', () => {
    it('is shown the next time a visible tab sees the app, once', async () => {
      localStorage.setItem(OUTCOME, JSON.stringify({ kind: 'saved' }));
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });

      mountTab();
      await pass(5000);
      expect(notify.success).not.toHaveBeenCalled();

      await act(async () => setVisibility('visible'));
      await pass(5000);

      expect(notify.success).toHaveBeenCalledTimes(1);
      expect(notify.success).toHaveBeenCalledWith(messages.ForgottenWorkout.saved);
      expect(localStorage.getItem(OUTCOME)).toBeNull();
    });
  });

  describe('with two tabs open on one draft', () => {
    const lockCases: [string, boolean][] = [
      ['Web Locks', true],
      ['the localStorage claim', false],
    ];

    describe.each(lockCases)('using %s', (_label, withLocks) => {
      beforeEach(() => {
        if (!withLocks) return;
        const held = new Set<string>();
        Object.defineProperty(navigator, 'locks', {
          configurable: true,
          value: {
            request: async (name: string, _o: unknown, cb: (lock: object | null) => Promise<unknown>) => {
              if (held.has(name)) return cb(null);
              held.add(name);
              try {
                return await cb({});
              } finally {
                held.delete(name);
              }
            },
          },
        });
      });

      it('saves once, while the first save is still in flight', async () => {
        let finishSave!: (w: object) => void;
        createWorkout.mockReturnValue(new Promise((resolve) => (finishSave = resolve)));
        seedDraft(workout(), { startedAt: T0 });
        vi.setSystemTime(T0 + 9 * HOUR);
        const a = mountTab();
        const b = mountTab();
        await pass(1000);

        await pass(5 * MINUTE + 3000);
        expect(createWorkout).toHaveBeenCalledTimes(1);

        await act(async () => finishSave({ id: 'saved-1' }));
        await pass(3000);

        expect(createWorkout).toHaveBeenCalledTimes(1);
        // The other tab let go of the session it no longer owns.
        expect(a.api().activeWorkout).toBeNull();
        expect(b.api().activeWorkout).toBeNull();
        expect(b.api().forgottenPrompt).toBeNull();
      });

      it('discards once and tells the user once', async () => {
        seedDraft(workout(2), { startedAt: T0 });
        vi.setSystemTime(T0 + 9 * HOUR);
        mountTab();
        mountTab();
        await pass(1000);

        await pass(5 * MINUTE + 3000);

        expect(createWorkout).not.toHaveBeenCalled();
        expect(notify.warning).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Workout beenden', () => {
    it('opens the workout and asks the screen to run the usual finish flow, without saving', async () => {
      const tab = mountTab();
      await startLive(tab);
      await jump(5 * HOUR);
      const before = tab.api().finishRequest;

      await act(async () => tab.api().endFromPrompt());

      expect(tab.api().forgottenPrompt).toBeNull();
      expect(tab.api().isMinimized).toBe(false);
      expect(tab.api().finishRequest).toBe(before + 1);
      expect(createWorkout).not.toHaveBeenCalled();
      expect(tab.api().activeWorkout).not.toBeNull();

      // It does not nag while the finish dialog is open.
      await pass(10 * MINUTE);
      expect(tab.api().forgottenPrompt).toBeNull();
    });
  });

  describe('Verwerfen', () => {
    it('discards the workout and closes the prompt', async () => {
      const tab = mountTab();
      await startLive(tab);
      await jump(5 * HOUR);

      await act(async () => tab.api().discardWorkout());
      await pass(1000);

      expect(tab.api().forgottenPrompt).toBeNull();
      expect(tab.api().activeWorkout).toBeNull();
      expect(createWorkout).not.toHaveBeenCalled();
    });
  });
});
