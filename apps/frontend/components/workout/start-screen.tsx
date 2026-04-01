'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkout } from '@/lib/workout-context';
import { apiClient } from '@/lib/api';
import { Workout, GymLocation } from '@/types';
import CycleWorkoutSelectionModal from './cycle-workout-selection-modal';
import GymLocationModal from './gym-location-modal';
import PastWorkoutSetupModal from './past-workout-setup-modal';

export default function WorkoutStartScreen() {
  const router = useRouter();
  const { startWorkout, loading } = useWorkout();
  const [suggestedWorkout, setSuggestedWorkout] = useState<Workout | null>(
    null
  );
  const [loadingSuggestion, setLoadingSuggestion] = useState(true);
  const [error, setError] = useState('');
  const [showCycleWorkoutModal, setShowCycleWorkoutModal] = useState(false);
  const [showGymLocationModal, setShowGymLocationModal] = useState(false);
  const [showPastWorkoutModal, setShowPastWorkoutModal] = useState(false);
  const [hasActiveCycle, setHasActiveCycle] = useState(false);
  const [pendingWorkoutData, setPendingWorkoutData] = useState<{
    cycleId?: string;
    workoutDayId?: string;
    isFreeWorkout: boolean;
    isPastWorkout?: boolean;
    pastWorkoutDate?: string;
    pastWorkoutDuration?: number;
  } | null>(null);

  useEffect(() => {
    const loadSuggestion = async () => {
      try {
        const workout = await apiClient.getSuggestedWorkout();
        setSuggestedWorkout(workout);
      } catch (err) {
        console.error('Failed to load suggested workout:', err);
        setError(
          'Kein vorgeschlagenes Workout verfügbar. Starte ein freies Workout.'
        );
      } finally {
        setLoadingSuggestion(false);
      }
    };

    const checkActiveCycle = async () => {
      try {
        const cycleWorkouts = await apiClient.getCurrentCycleWorkouts();
        setHasActiveCycle(cycleWorkouts !== null);
      } catch (err) {
        console.error('Failed to check active cycle:', err);
      }
    };

    loadSuggestion();
    checkActiveCycle();
  }, []);

  const handleStartSuggested = () => {
    if (!suggestedWorkout) return;

    setPendingWorkoutData({
      cycleId: suggestedWorkout.cycleId,
      workoutDayId: suggestedWorkout.workoutDayId,
      isFreeWorkout: false,
    });
    setShowGymLocationModal(true);
  };

  const handleStartFree = () => {
    setPendingWorkoutData({
      isFreeWorkout: true,
    });
    setShowGymLocationModal(true);
  };

  const handleStartCycleWorkout = (cycleId: string, workoutDayId: string) => {
    setPendingWorkoutData((prev) => ({
      ...prev,
      cycleId,
      workoutDayId,
      isFreeWorkout: false,
      isPastWorkout: prev?.isPastWorkout,
      pastWorkoutDate: prev?.pastWorkoutDate,
      pastWorkoutDuration: prev?.pastWorkoutDuration,
    }));
    setShowCycleWorkoutModal(false);
    setShowGymLocationModal(true);
  };

  const handleGymLocationSelected = async (gymLocation: GymLocation) => {
    if (!pendingWorkoutData) return;

    setShowGymLocationModal(false);
    
    try {
      await startWorkout({
        ...pendingWorkoutData,
        gymLocation,
      });
      setPendingWorkoutData(null);
    } catch (err) {
      setError('Fehler beim Starten des Workouts');
      console.error('Failed to start workout:', err);
    }
  };

  const handleStartPastWorkout = () => {
    setShowPastWorkoutModal(true);
  };

  const handlePastWorkoutFree = (date: string, durationMinutes: number) => {
    setPendingWorkoutData({
      isFreeWorkout: true,
      isPastWorkout: true,
      pastWorkoutDate: date,
      pastWorkoutDuration: durationMinutes * 60,
    });
    setShowPastWorkoutModal(false);
    setShowGymLocationModal(true);
  };

  const handlePastWorkoutCycle = (date: string, durationMinutes: number) => {
    // Store date and duration temporarily and show cycle selection
    setPendingWorkoutData({
      isFreeWorkout: false,
      isPastWorkout: true,
      pastWorkoutDate: date,
      pastWorkoutDuration: durationMinutes * 60,
    });
    setShowPastWorkoutModal(false);
    setShowCycleWorkoutModal(true);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loadingSuggestion) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">
          Lade Workout-Vorschlag...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              Neues Workout
            </h1>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-600 hover:text-gray-900"
            >
              Abbrechen
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">{error}</p>
          </div>
        )}

        {/* Suggested Workout */}
        {suggestedWorkout && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="bg-blue-600 px-6 py-4">
              <h2 className="text-xl font-semibold text-white">
                Vorgeschlagenes Workout
              </h2>
              {suggestedWorkout.cycleName && (
                <p className="text-blue-100 text-sm mt-1">
                  {suggestedWorkout.cycleName} •{' '}
                  {suggestedWorkout.workoutDayName}
                </p>
              )}
            </div>

            <div className="p-6 space-y-4">
              {suggestedWorkout.exercises.length > 0 ? (
                <>
                  <div className="space-y-3">
                    {suggestedWorkout.exercises.map((exercise, idx) => (
                      <div
                        key={exercise.exerciseId}
                        className="border border-gray-200 rounded-lg p-4"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-500">
                                #{exercise.order}
                              </span>
                              <h3 className="font-semibold text-gray-900">
                                {exercise.exerciseName}
                              </h3>
                            </div>
                            {exercise.plannedSets && exercise.plannedSets.length > 0 && (
                              <div className="mt-2 space-y-1">
                                <div className="text-sm font-medium text-gray-700">
                                  {exercise.plannedSets.length} geplante Sätze:
                                </div>
                                {exercise.plannedSets.map((set, setIdx) => (
                                  <div key={setIdx} className="text-sm text-gray-600">
                                    Satz {set.order}: {set.setType === 'WARMUP' ? '🔥 Aufwärmen' : '💪 Arbeit'} - {set.reps} Wdh × {set.weight}kg @ RIR {set.rir}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleStartSuggested}
                    disabled={loading}
                    className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading
                      ? 'Wird gestartet...'
                      : 'Vorgeschlagenes Workout starten'}
                  </button>
                </>
              ) : (
                <p className="text-gray-600">
                  Keine Übungen im vorgeschlagenen Workout.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Free Workout Option */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Freies Workout
            </h2>
            <p className="text-gray-600 text-sm mb-4">
              Starte ein Workout ohne Vorlage und füge Übungen nach Belieben
              hinzu.
            </p>
            <button
              onClick={handleStartFree}
              disabled={loading}
              className="w-full py-3 px-4 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Wird gestartet...' : 'Freies Workout starten'}
            </button>
          </div>
        </div>

        {/* Cycle Workout Selection */}
        {hasActiveCycle && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Andere Workouts aus dem Zyklus
              </h2>
              <p className="text-gray-600 text-sm mb-4">
                Wähle ein beliebiges Workout aus deinem aktuellen Trainingszyklus.
              </p>
              <button
                onClick={() => setShowCycleWorkoutModal(true)}
                disabled={loading}
                className="w-full py-3 px-4 border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Workout aus Zyklus wählen
              </button>
            </div>
          </div>
        )}

        {/* Past Workout Tracking */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Vergangenes Workout tracken
            </h2>
            <p className="text-gray-600 text-sm mb-4">
              Trage ein bereits durchgeführtes Workout nachträglich ein.
            </p>
            <button
              onClick={handleStartPastWorkout}
              disabled={loading}
              className="w-full py-3 px-4 border-2 border-purple-300 text-purple-700 font-medium rounded-lg hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Vergangenes Workout tracken
            </button>
          </div>
        </div>

        {/* Info Box */}
        {suggestedWorkout && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              💡 <strong>Tipp:</strong> Das vorgeschlagene Workout basiert auf
              deinem aktiven Trainingszyklus. Du kannst während des Workouts
              jederzeit Übungen hinzufügen, entfernen oder anpassen.
            </p>
          </div>
        )}
      </div>

      {/* Cycle Workout Selection Modal */}
      {showCycleWorkoutModal && (
        <CycleWorkoutSelectionModal
          onClose={() => setShowCycleWorkoutModal(false)}
          onSelect={handleStartCycleWorkout}
        />
      )}

      {/* Gym Location Modal */}
      <GymLocationModal
        isOpen={showGymLocationModal}
        onClose={() => {
          setShowGymLocationModal(false);
          setPendingWorkoutData(null);
        }}
        onSelectGym={handleGymLocationSelected}
      />

      {/* Past Workout Setup Modal */}
      <PastWorkoutSetupModal
        isOpen={showPastWorkoutModal}
        onClose={() => setShowPastWorkoutModal(false)}
        onStartFree={handlePastWorkoutFree}
        onStartCycle={handlePastWorkoutCycle}
      />
    </div>
  );
}
