'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { useWorkout } from '@/lib/workout-context';
import WorkoutStartScreen from '@/components/workout/start-screen';
import ActiveWorkoutScreen from '@/components/workout/active-workout-screen';
import { WorkoutCompletionModal } from '@/components/WorkoutCompletionModal';
import { Button } from '@/components/ui/button';
import { Workout, PersonalRecord } from '@/types';

export default function WorkoutPage() {
  const router = useRouter();
  const { activeWorkout, loading, isPastWorkout, expandWorkout } = useWorkout();

  // Completion modal state — past-workout tracking only. A live session finishes
  // inside the overlay, and its completion modal lives in ActiveWorkoutOverlay so it
  // outlives the unmount (issue #129).
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completedWorkout, setCompletedWorkout] = useState<Workout | null>(null);
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([]);

  const handleWorkoutComplete = (workout: Workout, prs: PersonalRecord[]) => {
    setCompletedWorkout(workout);
    setPersonalRecords(prs);
    setShowCompletionModal(true);
  };

  const handleCompletionModalClose = () => {
    setShowCompletionModal(false);
    router.push('/dashboard');
  };

  const liveSession = activeWorkout && !isPastWorkout;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        {loading && !activeWorkout ? (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-lg text-muted-foreground">Lädt...</div>
          </div>
        ) : isPastWorkout && activeWorkout ? (
          <ActiveWorkoutScreen mode="edit" onWorkoutComplete={handleWorkoutComplete} />
        ) : liveSession ? (
          // A live session is running in the overlay. This route no longer decides
          // what the user sees, so it must not offer the start screen — that would
          // let a second workout start straight over the running one (ADR-0001).
          <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
            <h1 className="text-2xl font-bold text-foreground">Ein Workout läuft bereits</h1>
            <p className="max-w-sm text-sm text-muted-foreground">
              Du hast eine laufende Trainingseinheit. Öffne sie, um weiterzumachen oder sie zu
              beenden.
            </p>
            <Button onClick={() => expandWorkout()}>Workout öffnen</Button>
          </div>
        ) : (
          <WorkoutStartScreen />
        )}

        {/* Completion modal for past-workout tracking (see note above). */}
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
