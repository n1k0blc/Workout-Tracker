'use client';

import { useWorkout } from '@/lib/workout-context';

export function RestTimerDisplay() {
  const { restTimer, restTimerTarget } = useWorkout();

  if (restTimer === 0 && restTimerTarget === 0) {
    return null;
  }

  const isOvertime = restTimer > restTimerTarget;
  const minutes = Math.floor(restTimer / 60);
  const seconds = restTimer % 60;
  const targetMinutes = Math.floor(restTimerTarget / 60);
  const targetSeconds = restTimerTarget % 60;

  return (
    <div
      className={`px-3 py-1.5 rounded-lg ${
        isOvertime
          ? 'bg-red-600 text-white'
          : 'bg-blue-600 text-white'
      }`}
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
    </div>
  );
}
