import type { Workout } from '@/types';
import { checkWorkoutCompleteness, type SetRowState } from '@/lib/workout-completeness';
import { toLocalDateString } from '@/lib/local-date';

/**
 * The time and decision rules behind the "still training?" prompt (#229, parent #221).
 *
 * A live workout exists only in localStorage until it is finished, and there is no service worker
 * or push, so nothing can run while the app is closed. Timestamps decide instead: whenever the app
 * is open, on screen, or returns to the screen, it asks whether the workout is due.
 */

/** A live workout is forgotten after this long, paused time included. */
export const FORGOTTEN_AFTER_MS = 5 * 60 * 60 * 1000;
/** "Weiter trainieren" asks again after this long. */
export const ASK_AGAIN_AFTER_MS = 60 * 60 * 1000;
/** How long the prompt waits for an answer, counted only while the app is on screen. */
export const COUNTDOWN_MS = 5 * 60 * 1000;

/**
 * Is it time to ask? `startedAt` is the dedicated start timestamp -- not the timer's start, which
 * pausing shifts forward -- so paused time counts. `askAgainAt` is the "Weiter trainieren" answer.
 */
export function isPromptDue({
  startedAt,
  askAgainAt,
  now,
}: {
  startedAt: number | null;
  askAgainAt: number | null;
  now: number;
}): boolean {
  if (startedAt === null) return false;
  if (now < startedAt + FORGOTTEN_AFTER_MS) return false;
  return askAgainAt === null || now >= askAgainAt;
}

/** Whole seconds until `deadline`, rounded up so the last second still reads 1; never below 0. */
export function secondsLeft(deadline: number, now: number): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

const isTimestamp = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/**
 * When the live session started. A draft written before the dedicated timestamp existed has none;
 * the workout's own creation time is the same instant (pausing never touched it), and `now` is the
 * last resort so a draft that is somehow undated gets 5 fresh hours instead of an instant prompt.
 */
export function resolveStartedAt(
  meta: { startedAt?: number },
  workout: Pick<Workout, 'date'> & { createdAt?: string },
  now: number,
): number {
  if (isTimestamp(meta.startedAt)) return meta.startedAt;
  for (const iso of [workout.createdAt, workout.date]) {
    const parsed = iso ? Date.parse(iso) : NaN;
    if (Number.isFinite(parsed)) return parsed;
  }
  return now;
}

/**
 * Where an automatic save ends: at the last logged set, not at the moment the prompt gave up.
 * `totalDuration` runs from the start to that set, and `localDate` is that set's day -- the day the
 * server's "today is done" rule reads -- so a workout forgotten on Saturday and saved on Monday
 * does not mark Monday as done. Null when no set carries a usable time; the caller then saves the
 * way "Beenden" does.
 *
 * Paused time before the last set is part of the duration: the dedicated start timestamp does not
 * record pauses, and an automatic save is a best estimate of a workout nobody ended.
 */
export function autoSaveEnd(
  workout: Pick<Workout, 'exercises'>,
  startedAt: number,
): { totalDuration: number; localDate: string } | null {
  let lastSetAt: number | null = null;
  for (const exercise of workout.exercises) {
    for (const set of exercise.sets) {
      const at = Date.parse(set.completedAt);
      if (Number.isFinite(at) && (lastSetAt === null || at > lastSetAt)) lastSetAt = at;
    }
  }
  if (lastSetAt === null) return null;
  return {
    totalDuration: Math.max(0, Math.floor((lastSetAt - startedAt) / 1000)),
    localDate: toLocalDateString(new Date(lastSetAt)),
  };
}

/** What an unanswered prompt does: a complete workout is saved, anything else is discarded. */
export function decideOutcome(
  workout: Pick<Workout, 'exercises'>,
  rows: SetRowState,
): 'save' | 'discard' {
  return checkWorkoutCompleteness(workout, rows).complete ? 'save' : 'discard';
}
