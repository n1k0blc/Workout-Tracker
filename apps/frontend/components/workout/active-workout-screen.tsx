'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkout } from '@/lib/workout-context';
import ExerciseCard from '@/components/workout/exercise-card';
import ExerciseSelectionModal from '@/components/workout/exercise-selection-modal';
import WorkoutTimer from '@/components/workout/workout-timer';
import { RestTimerDisplay } from '@/components/workout/rest-timer-display';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

export default function ActiveWorkoutScreen() {
  const router = useRouter();
  const {
    activeWorkout,
    completeWorkout,
    discardWorkout,
    addExercise,
    reorderExercises,
    loading,
    workoutDuration,
    isPaused,
    togglePause,
    removedPlannedSets,
  } = useWorkout();

  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [updateBlueprint, setUpdateBlueprint] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  if (!activeWorkout) {
    return null;
  }

  const hasBlueprint = !activeWorkout.isFreeWorkout && activeWorkout.workoutDayId;

  // Check if all planned sets are either logged or removed
  const areAllSetsLogged = (): boolean => {
    if (activeWorkout.exercises.length === 0) return false;

    return activeWorkout.exercises.every((exercise) => {
      // If exercise has planned sets, check if all are either logged or removed
      if (exercise.plannedSets && exercise.plannedSets.length > 0) {
        const removedSets = removedPlannedSets.get(exercise.id) || new Set();
        
        return exercise.plannedSets.every((plannedSet) => {
          // Set is okay if it's either logged or removed
          const isLogged = exercise.sets.some(s => s.setNumber === plannedSet.order);
          const isRemoved = removedSets.has(plannedSet.order);
          return isLogged || isRemoved;
        });
      }
      // For free workouts or unplanned exercises, require at least one set
      return exercise.sets.length > 0;
    });
  };

  const handleAddExercise = async (exerciseId: string) => {
    try {
      await addExercise(exerciseId);
      setShowExerciseModal(false);
    } catch (error) {
      console.error('Failed to add exercise:', error);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = activeWorkout.exercises.findIndex((ex) => ex.id === active.id);
    const newIndex = activeWorkout.exercises.findIndex((ex) => ex.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const newExercises = [...activeWorkout.exercises];
    const [movedExercise] = newExercises.splice(oldIndex, 1);
    newExercises.splice(newIndex, 0, movedExercise);

    try {
      await reorderExercises(newExercises.map((ex) => ex.id));
    } catch (error) {
      console.error('Failed to reorder exercises:', error);
    }
  };

  const handleComplete = async () => {
    try {
      await completeWorkout({
        totalDuration: workoutDuration,
        updateBlueprint: updateBlueprint,
      });
      router.push('/dashboard');
    } catch (error) {
      console.error('Failed to complete workout:', error);
    }
  };

  const handleDiscard = async () => {
    try {
      await discardWorkout();
      router.push('/dashboard');
    } catch (error) {
      console.error('Failed to discard workout:', error);
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs
        .toString()
        .padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50 pb-32">
        {/* Header */}
        <div className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Pause/Play Button */}
                <button
                  onClick={togglePause}
                  className={`p-2 rounded-lg transition-colors ${
                    isPaused
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title={isPaused ? 'Training fortsetzen' : 'Training pausieren'}
                >
                  {isPaused ? (
                    // Play Icon
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  ) : (
                    // Pause Icon
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                    </svg>
                  )}
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {activeWorkout.isFreeWorkout
                      ? 'Freies Workout'
                      : activeWorkout.workoutDayName || 'Workout'}
                  </h1>
                  {activeWorkout.cycleName && (
                    <p className="text-sm text-gray-600 mt-1">
                      {activeWorkout.cycleName}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <WorkoutTimer workoutDuration={workoutDuration} />
                <RestTimerDisplay />
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
          {/* Exercises */}
          {activeWorkout.exercises.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={activeWorkout.exercises.map((ex) => ex.id)}
                strategy={verticalListSortingStrategy}
              >
                {activeWorkout.exercises.map((exercise, idx) => (
                  <ExerciseCard
                    key={exercise.id}
                    exercise={exercise}
                    exerciseNumber={idx + 1}
                  />
                ))}
              </SortableContext>
            </DndContext>
          ) : (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <p className="text-gray-600 mb-4">
                Noch keine Übungen hinzugefügt
              </p>
              <button
                onClick={() => setShowExerciseModal(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
              >
                Erste Übung hinzufügen
              </button>
            </div>
          )}

          {/* Add Exercise Button */}
          {activeWorkout.exercises.length > 0 && (
            <button
              onClick={() => setShowExerciseModal(true)}
              className="w-full py-3 px-4 border-2 border-dashed border-gray-300 text-gray-600 font-medium rounded-lg hover:border-blue-500 hover:text-blue-600 transition-colors"
            >
              + Übung hinzufügen
            </button>
          )}
        </div>
      </div>

      {/* Bottom Actions Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-4 flex gap-3">
          <button
            onClick={() => setShowDiscardConfirm(true)}
            disabled={loading}
            className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Verwerfen
          </button>
          <button
            onClick={() => setShowCompleteConfirm(true)}
            disabled={loading || !areAllSetsLogged()}
            className="flex-1 py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Workout beenden
          </button>
        </div>
      </div>

      {/* Exercise Selection Modal */}
      {showExerciseModal && (
        <ExerciseSelectionModal
          onClose={() => setShowExerciseModal(false)}
          onSelect={handleAddExercise}
        />
      )}

      {/* Complete Confirmation Modal */}
      {showCompleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Workout beenden?
            </h3>
            <p className="text-gray-600 mb-4">
              Dein Workout wird mit {formatTime(workoutDuration)} Dauer gespeichert.
            </p>

            {/* Blueprint Update Checkbox */}
            {hasBlueprint && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={updateBlueprint}
                    onChange={(e) => setUpdateBlueprint(e.target.checked)}
                    className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-medium text-gray-900">
                      Blueprint aktualisieren
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Überschreibe den Blueprint mit den heutigen Werten (Gewicht, Wiederholungen, RIR).
                      Diese werden beim nächsten Training vorgeschlagen.
                    </div>
                  </div>
                </label>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCompleteConfirm(false);
                  setUpdateBlueprint(false);
                }}
                className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                onClick={handleComplete}
                disabled={loading}
                className="flex-1 py-2 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Wird gespeichert...' : 'Beenden'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discard Confirmation Modal */}
      {showDiscardConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Workout verwerfen?
            </h3>
            <p className="text-gray-600 mb-6">
              Alle nicht gespeicherten Daten gehen verloren. Dies kann nicht
              rückgängig gemacht werden.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDiscardConfirm(false)}
                className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                onClick={handleDiscard}
                disabled={loading}
                className="flex-1 py-2 px-4 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Wird verworfen...' : 'Verwerfen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
