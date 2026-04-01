'use client';

import { ProtectedRoute } from '@/components/protected-route';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { Workout, SetType } from '@/types';

export default function WorkoutDetailPage() {
  const params = useParams();
  const workoutId = params?.id as string;
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (workoutId) {
      loadWorkout();
    }
  }, [workoutId]);

  const loadWorkout = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getWorkout(workoutId);
      setWorkout(data);
    } catch (error) {
      console.error('Failed to load workout:', error);
    } finally {
      setLoading(false);
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

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')} h`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')} min`;
  };

  const calculateTotalVolume = () => {
    if (!workout) return 0;
    let total = 0;
    for (const exercise of workout.exercises) {
      for (const set of exercise.sets) {
        if (set.setType === SetType.WORKING) {
          const unilateralMultiplier = exercise.isUnilateral ? 2 : 1;
          const doubleWeightMultiplier = exercise.isDoubleWeight ? 2 : 1;
          total += set.weight * set.reps * unilateralMultiplier * doubleWeightMultiplier;
        }
      }
    }
    return total;
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('de-DE').format(Math.round(num));
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-lg text-gray-600">Lädt Workout...</div>
              </div>
            ) : workout ? (
              <div className="space-y-6">
                {/* Back Button */}
                <Link
                  href="/history"
                  className="inline-flex items-center text-blue-600 hover:text-blue-800"
                >
                  <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Zurück zum Verlauf
                </Link>

                {/* Header */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">
                        {workout.isFreeWorkout
                          ? 'Freies Workout'
                          : workout.workoutDayName || 'Workout'}
                      </h2>
                      {workout.cycleName && (
                        <p className="text-sm text-gray-600 mt-1">
                          {workout.cycleName}
                        </p>
                      )}
                    </div>
                    <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                      Abgeschlossen
                    </span>
                  </div>
                  <p className="text-gray-600">{formatDate(workout.date)}</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-sm font-medium text-gray-600 mb-1">
                      Dauer
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {formatDuration(workout.totalDuration || 0)}
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-sm font-medium text-gray-600 mb-1">
                      Gesamtvolumen
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {formatNumber(calculateTotalVolume())}{' '}
                      <span className="text-lg text-gray-600">kg</span>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-sm font-medium text-gray-600 mb-1">
                      Übungen
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {workout.exercises.length}
                    </div>
                  </div>
                </div>

                {/* Exercises */}
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-gray-900">Übungen</h3>
                  {workout.exercises.map((exercise, idx) => (
                    <div key={exercise.id} className="bg-white rounded-lg shadow p-6">
                      <div className="mb-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-500">
                            #{idx + 1}
                          </span>
                          <h4 className="text-lg font-semibold text-gray-900">
                            {exercise.exerciseName}
                          </h4>
                        </div>
                      </div>

                      {/* Sets */}
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-gray-700 mb-2">
                          Sätze ({exercise.sets.length})
                        </div>
                        {exercise.sets
                          .sort((a, b) => a.setNumber - b.setNumber)
                          .map((set) => (
                            <div
                              key={set.id}
                              className={`flex items-center justify-between p-3 rounded-lg border ${
                                set.setType === SetType.WARMUP
                                  ? 'bg-orange-50 border-orange-200'
                                  : 'bg-blue-50 border-blue-200'
                              }`}
                            >
                              <div className="flex items-center gap-4">
                                <span className="text-sm font-medium text-gray-700">
                                  Satz {set.setNumber}
                                </span>
                                <span
                                  className={`text-xs px-2 py-0.5 rounded ${
                                    set.setType === SetType.WARMUP
                                      ? 'bg-orange-100 text-orange-700'
                                      : 'bg-blue-100 text-blue-700'
                                  }`}
                                >
                                  {set.setType === SetType.WARMUP
                                    ? 'Aufwärmen'
                                    : 'Arbeit'}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-sm">
                                <span className="font-semibold text-gray-900">
                                  {set.weight}kg × {set.reps} Wdh
                                </span>
                                {set.rir !== undefined && set.rir !== null && (
                                  <span className="text-gray-600">
                                    RIR {set.rir}
                                  </span>
                                )}
                                {set.actualRestDuration && (
                                  <span className="text-gray-500 text-xs">
                                    Pause: {set.actualRestDuration}s
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <p className="text-gray-600">Workout nicht gefunden</p>
                <Link
                  href="/history"
                  className="mt-4 inline-block text-blue-600 hover:text-blue-800"
                >
                  Zurück zum Verlauf
                </Link>
              </div>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
