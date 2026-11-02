'use client';

import { useTranslations } from 'next-intl';
import { useWorkout } from '@/lib/workout-context';
import { decideOutcome } from '@/lib/forgotten-workout';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const formatCountdown = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/**
 * "Trainierst du noch?" for a live workout that has run 5 hours (#229). It is an AlertDialog, so a
 * tap outside or Escape does not dismiss it: every way out is one of the three answers, or the
 * countdown. It says what the countdown will do -- save a complete workout, discard an incomplete
 * one -- because discarding cannot be undone (ADR-0010).
 *
 * Mounted in the root layout with the overlay: a minimized workout is asked too.
 */
export function ForgottenWorkoutPrompt() {
  const t = useTranslations('ForgottenWorkout');
  const { activeWorkout, setRowState, forgottenPrompt, keepTraining, endFromPrompt, discardWorkout } = useWorkout();

  if (!activeWorkout || !forgottenPrompt) return null;

  const outcome = decideOutcome(activeWorkout, setRowState);
  const time = formatCountdown(forgottenPrompt.secondsLeft);

  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('description')} {t(outcome === 'save' ? 'willSave' : 'willDiscard', { time })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button onClick={keepTraining}>{t('keepTraining')}</Button>
          <Button variant="outline" onClick={endFromPrompt}>
            {t('finish')}
          </Button>
          <Button
            variant="outline"
            onClick={discardWorkout}
            className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            {t('discard')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
