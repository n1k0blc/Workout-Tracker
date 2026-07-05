'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { useWorkout } from '@/lib/workout-context';
import WorkoutStartScreen from '@/components/workout/start-screen';
import ActiveWorkoutScreen from '@/components/workout/active-workout-screen';
import { WorkoutCompletionModal } from '@/components/WorkoutCompletionModal';
import { Workout, PersonalRecord } from '@/types';

export default function WorkoutPage() {
  const router = useRouter();
  const { activeWorkout, loading, isPastWorkout, isHistoryEdit } = useWorkout();

  // Completion modal state
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completedWorkout, setCompletedWorkout] = useState<Workout | null>(null);
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([]);

  // Handler for when workout is completed - called from ActiveWorkoutScreen. The template
  // save/overwrite decision already happened atomically as part of the save itself (§3.4) --
  // no separate post-completion step needed anymore.
  const handleWorkoutComplete = (workout: Workout, prs: PersonalRecord[]) => {
    setCompletedWorkout(workout);
    setPersonalRecords(prs);
    setShowCompletionModal(true);
  };

  const handleCompletionModalClose = () => {
    setShowCompletionModal(false);
    router.push('/dashboard');
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        {loading && !activeWorkout ? (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-lg text-muted-foreground">Lädt...</div>
          </div>
        ) : activeWorkout ? (
          <ActiveWorkoutScreen
            mode={isPastWorkout || isHistoryEdit ? 'edit' : 'active'}
            onWorkoutComplete={handleWorkoutComplete}
          />
        ) : (
          <WorkoutStartScreen />
        )}

        {/* Workout Completion Modal (shadcn Dialog, controlled) */}
        <WorkoutCompletionModal
          open={showCompletionModal}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              handleCompletionModalClose();
            }
          }}
          workout={completedWorkout ?? undefined}
          personalRecords={personalRecords}
        />
      </div>
    </ProtectedRoute>
  );
}
