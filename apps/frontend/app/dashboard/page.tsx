'use client';

import { ProtectedRoute } from '@/components/protected-route';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { WorkoutListItem, PersonalRecord, WorkoutCycle } from '@/types';

export default function DashboardPage() {
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutListItem[]>([]);
  const [prs, setPrs] = useState<PersonalRecord[]>([]);
  const [cycles, setCycles] = useState<WorkoutCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalWorkouts: 0,
    totalVolume: 0,
    activeCycle: null as WorkoutCycle | null,
  });

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        // Load recent workouts (last 5)
        const endDate = new Date().toISOString();
        const startDate = new Date(
          Date.now() - 30 * 24 * 60 * 60 * 1000
        ).toISOString();

        const [workouts, records, cyclesList, volumeData] = await Promise.all([
          apiClient.getWorkoutHistory({ startDate, endDate }),
          apiClient.getPersonalRecords(),
          apiClient.getCycles(),
          apiClient.getVolumeAnalytics({ startDate, endDate }),
        ]);

        setRecentWorkouts(workouts.slice(0, 5));
        setPrs((records.recentPRs || []).slice(0, 3));
        setCycles(cyclesList);

        // Calculate stats
        const activeCycle = cyclesList.find((c) => {
          const now = new Date();
          const start = new Date(c.startDate);
          const end = new Date(
            start.getTime() + c.duration * 7 * 24 * 60 * 60 * 1000
          );
          return now >= start && now <= end;
        });

        setStats({
          totalWorkouts: workouts.length,
          totalVolume: volumeData.totalVolume,
          activeCycle: activeCycle || null,
        });
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
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
                <div className="text-lg text-gray-600">Lädt Dashboard...</div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-sm font-medium text-gray-600 mb-1">
                      Workouts (30 Tage)
                    </div>
                    <div className="text-3xl font-bold text-gray-900">
                      {stats.totalWorkouts}
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-sm font-medium text-gray-600 mb-1">
                      Gesamtes Volumen
                    </div>
                    <div className="text-3xl font-bold text-gray-900">
                      {formatNumber(stats.totalVolume)}
                      <span className="text-lg text-gray-600 ml-1">kg</span>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-sm font-medium text-gray-600 mb-1">
                      Aktiver Zyklus
                    </div>
                    {stats.activeCycle ? (
                      <div className="text-lg font-semibold text-gray-900 truncate">
                        {stats.activeCycle.name}
                      </div>
                    ) : (
                      <div className="text-lg text-gray-500">Kein aktiver Zyklus</div>
                    )}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Link
                    href="/workout"
                    className="block p-6 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg shadow hover:shadow-lg transition-shadow text-white"
                  >
                    <h3 className="text-lg font-semibold mb-2">
                      🏋️ Workout starten
                    </h3>
                    <p className="text-blue-100 text-sm">
                      Starte ein neues Workout
                    </p>
                  </Link>

                  <Link
                    href="/cycles"
                    className="block p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow"
                  >
                    <h3 className="text-lg font-semibold mb-2 text-gray-900">
                      📅 Zyklen verwalten
                    </h3>
                    <p className="text-gray-600 text-sm">
                      Trainingszyklen erstellen
                    </p>
                  </Link>

                  <Link
                    href="/analytics"
                    className="block p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow"
                  >
                    <h3 className="text-lg font-semibold mb-2 text-gray-900">
                      📊 Analytics
                    </h3>
                    <p className="text-gray-600 text-sm">
                      Trainingsfortschritt analysieren
                    </p>
                  </Link>
                </div>

                {/* Recent Workouts & PRs */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Recent Workouts */}
                  <div className="bg-white rounded-lg shadow">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h2 className="text-lg font-semibold text-gray-900">
                        Letzte Workouts
                      </h2>
                    </div>
                    <div className="p-6">
                      {recentWorkouts.length > 0 ? (
                        <div className="space-y-3">
                          {recentWorkouts.map((workout) => (
                            <div
                              key={workout.id}
                              className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="font-medium text-gray-900">
                                    {workout.workoutDayName || 'Freies Workout'}
                                  </div>
                                  <div className="text-sm text-gray-600 mt-1">
                                    {formatDate(workout.date)}
                                  </div>
                                  {workout.cycleName && (
                                    <div className="text-xs text-gray-500 mt-1">
                                      {workout.cycleName}
                                    </div>
                                  )}
                                </div>
                                <div className="text-sm text-gray-600">
                                  {workout.exerciseCount} Übungen
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-center py-8">
                          Noch keine Workouts vorhanden
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Personal Records */}
                  <div className="bg-white rounded-lg shadow">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h2 className="text-lg font-semibold text-gray-900">
                        Persönliche Rekorde
                      </h2>
                    </div>
                    <div className="p-6">
                      {prs.length > 0 ? (
                        <div className="space-y-3">
                          {prs.map((pr) => (
                            <div
                              key={`${pr.exerciseId}-${pr.type}`}
                              className="border border-gray-200 rounded-lg p-4"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="font-medium text-gray-900">
                                    {pr.exerciseName}
                                  </div>
                                  <div className="text-sm text-gray-600 mt-1">
                                    {pr.type === 'weight' && `Gewicht: ${pr.value}kg`}
                                    {pr.type === 'reps' && pr.isUnilateral && pr.details?.reps && 
                                      `Wiederholungen: ${pr.details.reps * 2} (${pr.details.reps}x2)`}
                                    {pr.type === 'reps' && !pr.isUnilateral && `Wiederholungen: ${pr.value}`}
                                    {pr.type === 'volume' && `Volumen: ${formatNumber(pr.value)}kg`}
                                    {pr.type === 'one_rm' && `1RM: ${pr.value.toFixed(1)}kg`}
                                  </div>
                                </div>
                                <div className="text-xs text-gray-500">
                                  {formatDate(pr.date)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-center py-8">
                          Noch keine PRs vorhanden
                        </p>
                      )}
                      <Link
                        href="/analytics"
                        className="block mt-4 text-center text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Alle PRs ansehen →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
