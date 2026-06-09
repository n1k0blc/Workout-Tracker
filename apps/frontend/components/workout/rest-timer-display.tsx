'use client';

import { useWorkout } from '@/lib/workout-context';

export function RestTimerDisplay() {
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

  return (
    <button
      onClick={toggleRestTimerPause}
      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer hover:opacity-90 ${
        isRestTimerPaused
          ? 'bg-muted text-muted-foreground'
          : isOvertime
          ? 'bg-destructive text-destructive-foreground'
          : 'bg-primary text-primary-foreground'
      }`}
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
