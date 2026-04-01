'use client';

import { ProtectedRoute } from '@/components/protected-route';
import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { Workout } from '@/types';

export default function EditWorkoutPage() {
  const router = useRouter();
  const params = useParams();
  const workoutId = params.id as string;

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [workoutDate, setWorkoutDate] = useState('');
  const [editedSets, setEditedSets] = useState<{
    [exerciseId: string]: {
      [setId: string]: { reps: string; weight: string; rir: string };
    };
  }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadWorkout();
  }, [workoutId]);

  const loadWorkout = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getWorkout(workoutId);
      setWorkout(data);
      
      // Format date for input (YYYY-MM-DD)
      const date = new Date(data.date);
      const formattedDate = date.toISOString().split('T')[0];
      setWorkoutDate(formattedDate);
      
      // Initialize edited sets with current values
      const initialSets: typeof editedSets = {};
      data.exercises.forEach((exercise) => {
        initialSets[exercise.id] = {};
        exercise.sets.forEach((set) => {
          initialSets[exercise.id][set.id] = {
            reps: set.reps.toString(),
            weight: set.weight.toString(),
            rir: set.rir !== undefined && set.rir !== null ? set.rir.toString() : '',
          };
        });
      });
      setEditedSets(initialSets);
    } catch (error) {
      console.error('Failed to load workout:', error);
      alert('Fehler beim Laden des Workouts');
      router.push('/history');
    } finally {
      setLoading(false);
    }
  };

  const handleSetValueChange = (
    exerciseId: string,
    setId: string,
    field: 'reps' | 'weight' | 'rir',
    value: string
  ) => {
    setEditedSets((prev) => ({
      ...prev,
      [exerciseId]: {
        ...prev[exerciseId],
        [setId]: {
          ...prev[exerciseId][setId],
          [field]: value,
        },
      },
    }));
  };

  const handleSave = async () => {
    if (!workout) return;

    setSaving(true);
    try {
      // Build update payload
      const exercises = workout.exercises.map((exercise) => ({
        id: exercise.id,
        sets: exercise.sets.map((set) => {
          const editedSet = editedSets[exercise.id]?.[set.id];
          return {
            id: set.id,
            reps: parseInt(editedSet?.reps || '0'),
            weight: parseFloat(editedSet?.weight || '0'),
            rir: editedSet?.rir ? parseInt(editedSet.rir) : undefined,
          };
        }),
      }));

      await apiClient.updateCompletedWorkout(workoutId, {
        completedAt: new Date(workoutDate + 'T12:00:00').toISOString(),
        exercises,
      });

      router.push('/history');
    } catch (error) {
      console.error('Failed to save workout:', error);
      alert('Fehler beim Speichern des Workouts');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(date);
  };

  if (loading || !workout) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-lg text-gray-600">Lädt Workout...</div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0 space-y-6">
            {/* Header */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Workout bearbeiten
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                {workout.isFreeWorkout
                  ? 'Freies Workout'
                  : workout.workoutDayName || 'Workout'}
                {workout.cycleName && ` - ${workout.cycleName}`}
              </p>
            </div>

            {/* Workout Date */}
            <div className="bg-white rounded-lg shadow p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Workout-Datum
              </label>
              <input
                type="date"
                value={workoutDate}
                onChange={(e) => setWorkoutDate(e.target.value)}
                className="w-full md:w-auto px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-2 text-sm text-gray-500">
                Ursprünglich: {formatDate(workout.date)}
              </p>
            </div>

            {/* Exercises */}
            <div className="space-y-4">
              {workout.exercises.map((exercise, idx) => (
                <div key={exercise.id} className="bg-white rounded-lg shadow p-6">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      #{idx + 1} {exercise.exerciseName}
                    </h3>
                  </div>

                  {/* Sets */}
                  <div className="space-y-3">
                    {exercise.sets.map((set) => {
                      const editedSet = editedSets[exercise.id]?.[set.id];
                      return (
                        <div
                          key={set.id}
                          className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-gray-600">
                              Satz {set.setNumber}
                            </span>
                            <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                              {set.setType === 'WARMUP' ? 'Aufwärmen' : 'Arbeitssatz'}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">
                                Wiederholungen{exercise.isUnilateral ? ' (2x)' : ''}
                              </label>
                              <input
                                type="number"
                                value={editedSet?.reps || ''}
                                onChange={(e) =>
                                  handleSetValueChange(
                                    exercise.id,
                                    set.id,
                                    'reps',
                                    e.target.value
                                  )
                                }
                                min="1"
                                className="w-full px-2 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">
                                Gewicht (kg){exercise.isDoubleWeight ? ' (2x)' : ''}
                              </label>
                              <input
                                type="number"
                                step="0.5"
                                value={editedSet?.weight || ''}
                                onChange={(e) =>
                                  handleSetValueChange(
                                    exercise.id,
                                    set.id,
                                    'weight',
                                    e.target.value
                                  )
                                }
                                min="0"
                                className="w-full px-2 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">
                                RIR
                              </label>
                              <input
                                type="number"
                                value={editedSet?.rir || ''}
                                onChange={(e) =>
                                  handleSetValueChange(
                                    exercise.id,
                                    set.id,
                                    'rir',
                                    e.target.value
                                  )
                                }
                                min="0"
                                max="10"
                                placeholder="-"
                                className="w-full px-2 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/history')}
                disabled={saving}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Speichert...' : 'Speichern'}
              </button>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
