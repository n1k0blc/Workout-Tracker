'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Workout } from '@/types';
import type { SetRowState } from '@/lib/workout-completeness';
import {
  ASK_AGAIN_AFTER_MS,
  COUNTDOWN_MS,
  autoSaveEnd,
  decideOutcome,
  isPromptDue,
  secondsLeft,
} from '@/lib/forgotten-workout';
import { runExclusively } from '@/lib/exclusive-run';
import {
  forgottenClaimKey,
  forgottenOutcomeKey,
  readAskAgainAt,
  type DraftStorageKeys,
} from '@/lib/workout-draft-storage';
import { notify } from '@/lib/toast';

/** How often the app asks itself whether the workout is due, and how the countdown moves. */
const TICK_MS = 1000;
/** A tick this long after the last one means the device slept: the user did not see the countdown. */
const SLEPT_AFTER_MS = 15_000;

type OutcomeKind = 'saved' | 'discarded' | 'failed';

/** What the hook needs from the provider, read fresh whenever it acts. */
export interface ForgottenWorkoutSession {
  snapshot: () => { workout: Workout | null; isPast: boolean; rows: SetRowState; startedAt: number | null };
  /** Mirror the re-ask time found in storage (another tab may have written it). */
  syncAskAgainAt: (at: number | null) => void;
  /** Store a new re-ask time with the draft. */
  setAskAgainAt: (at: number) => void;
  /** Save the workout the way "Beenden" does, but ending where `end` says. Rejects when the save fails. */
  save: (end?: { totalDuration: number; localDate: string }) => Promise<unknown>;
  /** Drop the session and its draft. */
  discard: () => void;
}

/**
 * The "still training?" prompt for a forgotten live workout (#229, parent #221).
 *
 * One tick a second decides everything from timestamps, because nothing can run while the app is
 * closed: is the workout 5 hours old and not snoozed, is the app on screen, has the countdown run
 * out. The countdown exists only while the app is on screen -- hiding it, or coming back from a
 * sleeping device, restarts it at a full 5 minutes -- so nobody loses a workout they never saw the
 * question for. An unanswered prompt saves a complete workout and discards an incomplete one; two
 * tabs share the draft, so only the tab that wins the claim does either.
 */
export function useForgottenWorkout(
  userId: string | null,
  keys: DraftStorageKeys,
  session: React.RefObject<ForgottenWorkoutSession | null>,
) {
  const t = useTranslations('ForgottenWorkout');
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });

  const [prompt, setPrompt] = useState<{ secondsLeft: number } | null>(null);
  // `open`: the question is up. `deadline`: when the countdown ends -- null while it is not running.
  const state = useRef({ open: false, deadline: null as number | null, lastTick: 0, running: false });

  const close = useCallback(() => {
    state.current.open = false;
    state.current.deadline = null;
    setPrompt(null);
  }, []);

  /** "Weiter trainieren": ask again in an hour. Also what "Workout beenden" does, so the question
   *  does not return while the finish dialog is open. */
  const keepTraining = useCallback(() => {
    session.current?.setAskAgainAt(Date.now() + ASK_AGAIN_AFTER_MS);
    close();
  }, [session, close]);

  useEffect(() => {
    if (!userId) return;

    const showCountdown = (now: number) => {
      const next = secondsLeft(state.current.deadline ?? now, now);
      setPrompt((prev) => (prev?.secondsLeft === next ? prev : { secondsLeft: next }));
    };

    /** The outcome is parked in storage until a tab on screen shows it, so it is never lost on a hidden tab. */
    const showNotice = () => {
      const raw = localStorage.getItem(forgottenOutcomeKey(userId));
      if (!raw) return;
      localStorage.removeItem(forgottenOutcomeKey(userId));
      try {
        const kind = (JSON.parse(raw) as { kind?: OutcomeKind }).kind;
        if (kind === 'saved') notify.success(tRef.current('saved'));
        else if (kind === 'discarded') notify.warning(tRef.current('discarded'));
        else if (kind === 'failed') notify.error(tRef.current('saveFailed'));
      } catch {
        // An unreadable notice is dropped, not shown.
      }
    };

    const runOutcome = async () => {
      const s = state.current;
      if (s.running) return;
      s.running = true;
      s.deadline = null;
      try {
        const result = await runExclusively<OutcomeKind | null>(forgottenClaimKey(userId), async () => {
          const ctrl = session.current;
          const snap = ctrl?.snapshot();
          // Another tab may have saved or discarded the draft a moment ago.
          if (!ctrl || !snap?.workout || snap.isPast || !localStorage.getItem(keys.draft)) return null;

          if (decideOutcome(snap.workout, snap.rows) === 'discard') {
            ctrl.discard();
            return 'discarded';
          }
          const end = snap.startedAt === null ? null : autoSaveEnd(snap.workout, snap.startedAt);
          try {
            await ctrl.save(end ?? undefined);
            return 'saved';
          } catch (error) {
            console.error('Automatic save of a forgotten workout failed:', error);
            // The draft stays. Ask again later rather than retrying every five minutes.
            ctrl.setAskAgainAt(Date.now() + ASK_AGAIN_AFTER_MS);
            return 'failed';
          }
        });
        if (result.ran && result.value) {
          localStorage.setItem(forgottenOutcomeKey(userId), JSON.stringify({ kind: result.value }));
          if (document.visibilityState === 'visible') showNotice();
        }
      } finally {
        s.running = false;
        close();
      }
    };

    const tick = () => {
      const now = Date.now();
      const s = state.current;
      const slept = s.lastTick !== 0 && now - s.lastTick > SLEPT_AFTER_MS;
      s.lastTick = now;
      const visible = document.visibilityState === 'visible';

      if (visible) showNotice();

      const ctrl = session.current;
      const snap = ctrl?.snapshot();
      if (!ctrl || !snap?.workout || snap.isPast) {
        if (s.open && !s.running) close();
        return;
      }

      // The draft is shared with other tabs: one may have ended it, or answered "Weiter trainieren".
      if (!localStorage.getItem(keys.draft)) {
        if (!s.running) {
          ctrl.discard();
          close();
        }
        return;
      }
      let askAgainAt: number | null = null;
      try {
        askAgainAt = readAskAgainAt(JSON.parse(localStorage.getItem(keys.meta) ?? '{}'));
      } catch {
        // A damaged meta has no re-ask time.
      }
      ctrl.syncAskAgainAt(askAgainAt);

      if (s.running) return;
      if (!visible) {
        // Nobody is looking: the countdown stops, and starts over when the app comes back.
        s.deadline = null;
        return;
      }

      if (!isPromptDue({ startedAt: snap.startedAt, askAgainAt, now })) {
        if (s.open) close();
        return;
      }
      if (!s.open) {
        s.open = true;
        s.deadline = now + COUNTDOWN_MS;
        showCountdown(now);
        return;
      }
      if (s.deadline === null || slept) {
        s.deadline = now + COUNTDOWN_MS;
        showCountdown(now);
        return;
      }
      if (now < s.deadline) {
        showCountdown(now);
        return;
      }
      void runOutcome();
    };

    const interval = setInterval(tick, TICK_MS);
    // The app coming back to the screen is a check of its own, not something to wait a second for.
    document.addEventListener('visibilitychange', tick);
    tick();
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [userId, keys, session, close]);

  return { prompt, keepTraining };
}
