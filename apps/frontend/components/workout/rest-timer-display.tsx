'use client';

import { useWorkout } from '@/lib/workout-context';
import { cn } from '@/lib/utils';

interface RestTimerDisplayProps {
  /**
   * `bar` inverts the resting colours for use on the primary-coloured minimized
   * bar (issue #130); overtime keeps the same destructive treatment either way,
   * so it reads consistently with the workout screen.
   */
  variant?: 'default' | 'bar';
  className?: string;
}

export function RestTimerDisplay({ variant = 'default', className }: RestTimerDisplayProps) {
  const { restTimer, restTimerTarget, isRestTimerPaused, toggleRestTimerPause, isPastWorkout } = useWorkout();

  // Never show live rest timer during past workout tracking (historical data entry only).
  if (isPastWorkout || (restTimer === 0 && restTimerTarget === 0)) {
    return null;
  }

  const isOvertime = restTimer > restTimerTarget;
  const minutes = Math.floor(restTimer / 60);
  const seconds = restTimer % 60;
  const targetMinutes = Math.floor(restTimerTarget / 60);
  const targetSeconds = restTimerTarget % 60;

  // Paused wins over overtime, matching the original ordering.
  const tone = isRestTimerPaused ? 'paused' : isOvertime ? 'overtime' : 'resting';
  const toneClass = {
    default: {
      paused: 'bg-muted text-muted-foreground',
      overtime: 'bg-destructive text-destructive-foreground',
      resting: 'bg-primary text-primary-foreground',
    },
    // Inverted for the primary-coloured minimized bar (issue #130); overtime keeps
    // the same destructive red so it reads consistently with the workout screen.
    bar: {
      paused: 'bg-primary-foreground/20 text-primary-foreground',
      overtime: 'bg-destructive text-destructive-foreground',
      resting: 'bg-primary-foreground text-primary',
    },
  }[variant][tone];

  return (
    <button
      onClick={(e) => {
        // On the minimized bar the chip sits inside the bar's own tap target;
        // pausing the rest must not also expand the workout (issue #130).
        e.stopPropagation();
        toggleRestTimerPause();
      }}
      className={cn(
        'px-3 py-1.5 rounded-lg transition-all cursor-pointer hover:opacity-90',
        toneClass,
        className,
      )}
      title={isRestTimerPaused ? 'Satzpause fortsetzen' : 'Satzpause anhalten'}
    >
      <div className="flex items-center gap-2">
        <div className="text-xs font-medium">
          Pause
        </div>
        <div className="text-lg font-bold tabular-nums">
          {minutes}:{seconds.toString().padStart(2, '0')}
        </div>
        {restTimerTarget > 0 && (
          <div className="text-xs opacity-80">
            / {targetMinutes}:{targetSeconds.toString().padStart(2, '0')}
          </div>
        )}
      </div>
    </button>
  );
}
