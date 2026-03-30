'use client';

import { useWorkout } from '@/lib/workout-context';

export function RestAlertModal() {
  const { showRestAlert, dismissRestAlert, restTimerTarget } = useWorkout();

  if (!showRestAlert) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-red-600 text-white rounded-lg shadow-2xl p-8 max-w-sm mx-4">
        <div className="flex flex-col items-center text-center">
          {/* Bell Icon */}
          <svg
            className="w-16 h-16 mb-4"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z" />
          </svg>

          <h3 className="text-2xl font-bold mb-2">
            Pause beendet!
          </h3>
          <p className="text-lg mb-6">
            {restTimerTarget} Sekunden sind vergangen
          </p>

          <button
            onClick={dismissRestAlert}
            className="w-full py-3 px-6 bg-white text-red-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
