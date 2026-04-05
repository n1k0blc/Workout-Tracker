'use client';

import { ProtectedRoute } from '@/components/protected-route';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { WorkoutListItem } from '@/types';

type FilterType = '7days' | '30days' | '90days' | 'currentMonth' | 'currentYear' | 'custom';

export default function HistoryPage() {
  const [workouts, setWorkouts] = useState<WorkoutListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<FilterType>('30days');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  useEffect(() => {
    loadWorkouts();
  }, [filterType, customStartDate, customEndDate]);

  const getDateRange = (): { startDate: string; endDate: string } => {
    const now = new Date();
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    let startDate: Date;

    switch (filterType) {
      case '7days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90days':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'currentMonth':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        break;
      case 'currentYear':
        startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          return {
            startDate: new Date(customStartDate).toISOString(),
            endDate: new Date(customEndDate + 'T23:59:59').toISOString(),
          };
        }
        // Fallback to 30 days if custom dates not set
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    startDate.setHours(0, 0, 0, 0);

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
  };

  const loadWorkouts = async () => {
    if (filterType === 'custom' && (!customStartDate || !customEndDate)) {
      return;
    }

    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange();
      const data = await apiClient.getWorkoutHistory({ 
        startDate, 
        endDate,
        status: 'COMPLETED'
      });
      setWorkouts(data);
    } catch (error) {
      console.error('Failed to load workouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')} min`;
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="space-y-6">
              {/* Header */}
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Trainingsverlauf
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Übersicht deiner abgeschlossenen Workouts
                </p>
              </div>

              {/* Filters */}
              <div className="bg-white rounded-lg shadow p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Zeitraum
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setFilterType('7days')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        filterType === '7days'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Letzte 7 Tage
                    </button>
                    <button
                      onClick={() => setFilterType('30days')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        filterType === '30days'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Letzte 30 Tage
                    </button>
                    <button
                      onClick={() => setFilterType('90days')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        filterType === '90days'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Letzte 90 Tage
                    </button>
                    <button
                      onClick={() => setFilterType('currentMonth')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        filterType === 'currentMonth'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Aktueller Monat
                    </button>
                    <button
                      onClick={() => setFilterType('currentYear')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        filterType === 'currentYear'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Aktuelles Jahr
                    </button>
                    <button
                      onClick={() => setFilterType('custom')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        filterType === 'custom'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Benutzerdefiniert
                    </button>
                  </div>
                </div>

                {/* Custom Date Range */}
                {filterType === 'custom' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Von
                      </label>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Bis
                      </label>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Workouts List */}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-lg text-gray-600">Lädt Workouts...</div>
                </div>
              ) : workouts.length > 0 ? (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600 mb-2">
                    {workouts.length} Workout{workouts.length !== 1 ? 's' : ''} gefunden
                  </div>
                  {workouts.map((workout) => (
                    <div
                      key={workout.id}
                      className="block bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6"
                    >
                      <div className="flex items-start justify-between">
                        <Link
                          href={`/history/${workout.id}`}
                          className="flex-1"
                        >
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {workout.isFreeWorkout
                                ? 'Freies Workout'
                                : workout.workoutDayName || 'Workout'}
                            </h3>
                            {workout.cycleName && (
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                {workout.cycleName}
                              </span>
                            )}
                            {workout.homeGym ? (
                              <span className="text-xs bg-violet-100 text-violet-800 px-2 py-1 rounded">
                                {workout.homeGym.name}
                              </span>
                            ) : (
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                Anderes Gym
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span>{formatDate(workout.date)}</span>
                            </div>
                            {workout.totalDuration && (
                              <div className="flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>{formatDuration(workout.totalDuration)}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                              </svg>
                              <span>{workout.exerciseCount} Übung{workout.exerciseCount !== 1 ? 'en' : ''}</span>
                            </div>
                          </div>
                        </Link>
                        <div className="flex items-center gap-2 ml-4">
                          <Link
                            href={`/history/${workout.id}/edit`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Workout bearbeiten"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </Link>
                          <Link
                            href={`/history/${workout.id}`}
                            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                            title="Details anzeigen"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow p-12 text-center">
                  <p className="text-gray-600">
                    Keine Workouts im ausgewählten Zeitraum gefunden
                  </p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
