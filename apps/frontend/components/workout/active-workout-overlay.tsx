'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useWorkout } from '@/lib/workout-context';
import { Workout, PersonalRecord } from '@/types';
import ActiveWorkoutScreen from '@/components/workout/active-workout-screen';
import { MinimizedWorkoutBar } from '@/components/workout/minimized-workout-bar';
import { WorkoutCompletionModal } from '@/components/WorkoutCompletionModal';

/** Resting height of the minimized bar; the collapsed transform is anchored to it. */
const BAR_HEIGHT = 72;

/**
 * The persistent home of a live workout (ADR-0001, issue #129). Mounted in the root
 * layout, it renders the active session in an overlay that collapses to a bottom bar
 * rather than unmounting, and keeps the completion modal alive after the session --
 * and the overlay -- are gone.
 *
 * Live sessions only: past-workout tracking and history editing render on their own
 * routes and never reach this.
 */
export function ActiveWorkoutOverlay() {
  const { activeWorkout, isPastWorkout, isMinimized, expandWorkout } = useWorkout();
  const pathname = usePathname();
  const router = useRouter();

  const [completed, setCompleted] = useState<{ workout: Workout; prs: PersonalRecord[] } | null>(
    null,
  );

  const isLiveSession = !!activeWorkout && !isPastWorkout;

  // Where a minimize from the /workout route should drop the user. Tracks the last
  // real page they were reading; defaults to the dashboard on the very first minimize.
  const lastNonWorkoutRoute = useRef('/dashboard');
  useEffect(() => {
    if (!pathname) return;
    if (pathname.startsWith('/workout')) return;
    if (['/', '/login', '/register'].includes(pathname)) return;
    lastNonWorkoutRoute.current = pathname;
  }, [pathname]);

  // Minimizing while the /workout route is showing would leave the guard screen
  // behind the bar -- send the user back to where they were instead.
  const wasMinimized = useRef(isMinimized);
  useEffect(() => {
    if (isMinimized && !wasMinimized.current && pathname?.startsWith('/workout')) {
      router.push(lastNonWorkoutRoute.current);
    }
    wasMinimized.current = isMinimized;
  }, [isMinimized, pathname, router]);

  // Every page needs room under the bar so its last card clears it. Toggling a body
  // style keeps this in one place instead of touching every scroll container.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const show = isLiveSession && isMinimized;
    document.body.style.paddingBottom = show ? `${BAR_HEIGHT + 24}px` : '';
    return () => {
      document.body.style.paddingBottom = '';
    };
  }, [isLiveSession, isMinimized]);

  return (
    <>
      {isLiveSession && (
        <div
          className="fixed inset-x-0 top-0 z-40 flex flex-col overflow-hidden bg-background transition-transform duration-[320ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
          style={{
            height: `calc(100dvh + ${BAR_HEIGHT}px)`,
            transform: isMinimized
              ? `translateY(calc(100dvh - ${BAR_HEIGHT}px))`
              : `translateY(-${BAR_HEIGHT}px)`,
          }}
        >
          <MinimizedWorkoutBar workout={activeWorkout} onExpand={expandWorkout} />
          <div className="h-[100dvh] shrink-0 overflow-y-auto">
            <ActiveWorkoutScreen
              mode="active"
              onWorkoutComplete={(workout, prs) => setCompleted({ workout, prs })}
            />
          </div>
        </div>
      )}

      {/* Mounted only while there is a result to show: the modal attaches
          document-level swipe listeners, so it must not live in the layout at
          all times. */}
      {completed && (
        <WorkoutCompletionModal
          open
          workout={completed.workout}
          personalRecords={completed.prs}
          onOpenChange={(open) => {
            if (!open) setCompleted(null);
          }}
        />
      )}
    </>
  );
}
