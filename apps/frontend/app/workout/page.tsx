'use client';

import { ProtectedRoute } from '@/components/protected-route';
import { useWorkout } from '@/lib/workout-context';
import WorkoutStartScreen from '@/components/workout/start-screen';
import ActiveWorkoutScreen from '@/components/workout/active-workout-screen';
import { RestAlertModal } from '@/components/workout/rest-alert-modal';

export default function WorkoutPage() {
  const { activeWorkout, loading } = useWorkout();

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        {loading && !activeWorkout ? (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-lg text-gray-600">Lädt...</div>
          </div>
        ) : activeWorkout?.status === 'IN_PROGRESS' ? (
          <>
            <ActiveWorkoutScreen />
            <RestAlertModal />
          </>
        ) : (
          <WorkoutStartScreen />
        )}
      </div>
    </ProtectedRoute>
  );
}
