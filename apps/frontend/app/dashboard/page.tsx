'use client';

import { ProtectedRoute } from '@/components/protected-route';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { 
  WorkoutListItem, 
  PersonalRecord, 
  DashboardStats,
  NextPlannedWorkout,
  CycleProgress,
} from '@/types';
import CircularProgress from '@/components/CircularProgress';
import TrendIndicator from '@/components/TrendIndicator';

export default function DashboardPage() {
  const router = useRouter();
  const [weekStats, setWeekStats] = useState<DashboardStats | null>(null);
  const [cycleProgress, setCycleProgress] = useState<CycleProgress | null>(null);
  const [nextWorkout, setNextWorkout] = useState<NextPlannedWorkout | null>(null);
  const [weekWorkouts, setWeekWorkouts] = useState<WorkoutListItem[]>([]);
  const [prs, setPrs] = useState<PersonalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  
  // State for recently completed cycle
  const [showCycleCompletion, setShowCycleCompletion] = useState(false);
  const [completedCycle, setCompletedCycle] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        // Get Monday 00:00:00 of current week
        const getWeekStart = (): Date => {
          const d = new Date();
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1);
          const monday = new Date(d.setDate(diff));
          monday.setHours(0, 0, 0, 0);
          return monday;
        };

        // Get Sunday 23:59:59 of current week
        const getWeekEnd = (): Date => {
          const weekStart = getWeekStart();
          const sunday = new Date(weekStart);
          sunday.setDate(weekStart.getDate() + 6);
          sunday.setHours(23, 59, 59, 999);
          return sunday;
        };

        const weekStart = getWeekStart().toISOString();
        const weekEnd = getWeekEnd().toISOString();

        const [stats, progress, planned, workouts, records] = await Promise.all([
          apiClient.getCurrentWeekStats(),
          apiClient.getCycleProgress(),
          apiClient.getNextPlannedWorkout(),
          apiClient.getWorkoutHistory({ startDate: weekStart, endDate: weekEnd }),
          apiClient.getPersonalRecords(),
        ]);

        setWeekStats(stats);
        setCycleProgress(progress);
        setNextWorkout(planned);
        setWeekWorkouts(workouts);
        setPrs((records.recentPRs || []).slice(0, 3));
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  // Check for recently completed cycles
  useEffect(() => {
    const checkRecentlyCompletedCycle = async () => {
      try {
        const cycles = await apiClient.getCycles();
        const completedCycles = cycles
          .filter(c => c.status === 'COMPLETED' && c.completedAt)
          .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());
        
        if (completedCycles.length > 0) {
          const mostRecent = completedCycles[0];
          const daysSinceCompletion = 
            (Date.now() - new Date(mostRecent.completedAt!).getTime()) / (1000 * 60 * 60 * 24);
          
          const acknowledged = localStorage.getItem(`cycle-${mostRecent.id}-acknowledged`);
          
          // Show completion card if completed within last 7 days and not yet acknowledged
          if (daysSinceCompletion <= 7 && !acknowledged) {
            setCompletedCycle({ id: mostRecent.id, name: mostRecent.name });
            setShowCycleCompletion(true);
          }
        }
      } catch (error) {
        console.error('Failed to check for completed cycles:', error);
      }
    };

    checkRecentlyCompletedCycle();
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

  const getDayName = (dayOfWeek: number): string => {
    const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    return days[dayOfWeek];
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
                {/* Stats Grid - 2x2 Layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Workouts der letzten 7 Tage */}
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-sm font-medium text-gray-600 mb-1">
                      Workouts (letzte 7 Tage)
                    </div>
                    <div className="text-3xl font-bold text-gray-900">
                      {weekStats?.lastSevenDays.workouts || 0}
                    </div>
                  </div>

                  {/* Volumen der letzten 7 Tage mit Trend */}
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-sm font-medium text-gray-600 mb-1">
                      Volumen (letzte 7 Tage)
                    </div>
                    <div className="flex items-end gap-3">
                      <div className="text-3xl font-bold text-gray-900">
                        {formatNumber(weekStats?.lastSevenDays.volume || 0)}
                        <span className="text-lg text-gray-600 ml-1">kg</span>
                      </div>
                      {weekStats && (
                        <div className="pb-1">
                          <TrendIndicator change={weekStats.volumeChange} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Zyklus-Fortschritt / Completion / No Cycle */}
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-sm font-medium text-gray-600 mb-3">
                      Zyklus-Status
                    </div>
                    
                    {/* Show cycle completion card if recently completed */}
                    {showCycleCompletion && completedCycle ? (
                      <div 
                        onClick={() => {
                          localStorage.setItem(`cycle-${completedCycle.id}-acknowledged`, 'true');
                          router.push(`/cycles/${completedCycle.id}?celebration=true`);
                        }}
                        className="bg-gradient-to-br from-gray-900 to-gray-700 text-white rounded-lg p-6 cursor-pointer hover:from-gray-800 hover:to-gray-600 transition-all"
                      >
                        <div className="text-center">
                          <div className="text-6xl mb-3">🎉</div>
                          <div className="text-sm font-medium mb-1 text-gray-300">
                            Zyklus beendet
                          </div>
                          <div className="text-xl font-bold">
                            {completedCycle.name}
                          </div>
                          <div className="text-xs text-gray-400 mt-2">
                            Klicken für Details
                          </div>
                        </div>
                      </div>
                    ) : cycleProgress ? (
                      /* Active cycle - show progress */
                      <div className="flex flex-col items-center">
                        <CircularProgress
                          current={cycleProgress.currentWeek}
                          total={cycleProgress.totalWeeks}
                          size={100}
                        />
                        <div className="text-sm text-gray-600 mt-3 text-center">
                          {cycleProgress.cycleName}
                        </div>
                      </div>
                    ) : (
                      /* No active cycle - show placeholder */
                      <div className="text-center py-4">
                        <div className="text-gray-500 mb-4 text-sm">
                          Kein aktiver Zyklus
                        </div>
                        <button
                          onClick={() => router.push('/cycles/new')}
                          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Neuen Zyklus anlegen
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Durchschnittliche Workout-Dauer */}
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-sm font-medium text-gray-600 mb-1">
                      Ø Dauer (letzte 7 Tage)
                    </div>
                    {weekStats?.lastSevenDays.averageDuration !== null ? (
                      <div className="text-3xl font-bold text-gray-900">
                        {weekStats?.lastSevenDays.averageDuration || 0}
                        <span className="text-lg text-gray-600 ml-1">min</span>
                      </div>
                    ) : (
                      <div className="text-lg text-gray-500 py-2">
                        Keine Daten
                      </div>
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

                {/* Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Workouts dieser Woche (Liste) */}
                  <div className="bg-white rounded-lg shadow">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h2 className="text-lg font-semibold text-gray-900">
                        Workouts dieser Woche
                      </h2>
                    </div>
                    <div className="p-6">
                      {weekWorkouts.length > 0 ? (
                        <div className="space-y-3">
                          {weekWorkouts.map((workout) => (
                            <div
                              key={workout.id}
                              onClick={() => router.push(`/history/${workout.id}`)}
                              className="border border-gray-200 rounded-lg p-4 hover:bg-blue-50 hover:border-blue-300 transition-colors cursor-pointer"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="font-medium text-gray-900">
                                    {workout.workoutDayName || workout.templateName || 'Freies Workout'}
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
                          Noch keine Workouts diese Woche
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Nächstes geplantes Workout */}
                  <div className="bg-white rounded-lg shadow">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h2 className="text-lg font-semibold text-gray-900">
                        Nächstes geplantes Workout
                      </h2>
                    </div>
                    <div className="p-6">
                      {nextWorkout ? (
                        <div className="border border-blue-200 bg-blue-50 rounded-lg p-6">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-gray-900 mb-2">
                              {nextWorkout.workoutDayName}
                            </div>
                            <div className="text-sm text-gray-600 mb-1">
                              {nextWorkout.cycleName}
                            </div>
                            {nextWorkout.templateName && (
                              <div className="text-sm text-gray-500 mb-3">
                                {nextWorkout.templateName}
                              </div>
                            )}
                            <div className="mt-4 pt-4 border-t border-blue-200">
                              <div className="text-lg font-semibold text-blue-600">
                                {getDayName(nextWorkout.dayOfWeek)}
                              </div>
                              <div className="text-sm text-gray-600 mt-1">
                                {formatDate(nextWorkout.suggestedDate)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <div className="text-gray-500">
                            Kein aktiver Zyklus
                          </div>
                          <Link
                            href="/cycles"
                            className="inline-block mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
                          >
                            Zyklus erstellen →
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Personal Records */}
                  <div className="bg-white rounded-lg shadow lg:col-span-2">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h2 className="text-lg font-semibold text-gray-900">
                        Persönliche Rekorde
                      </h2>
                    </div>
                    <div className="p-6">
                      {prs.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {prs.map((pr) => (
                            <div
                              key={`${pr.exerciseId}-${pr.type}`}
                              className="border border-gray-200 rounded-lg p-4"
                            >
                              <div className="flex flex-col">
                                <div className="font-medium text-gray-900 mb-2">
                                  {pr.exerciseName}
                                </div>
                                <div className="text-sm text-gray-600">
                                  {pr.type === 'weight' && `Gewicht: ${pr.value}kg`}
                                  {pr.type === 'reps' && pr.isUnilateral && pr.details?.reps && 
                                    `Wiederholungen: ${pr.details.reps * 2} (${pr.details.reps}x2)`}
                                  {pr.type === 'reps' && !pr.isUnilateral && `Wiederholungen: ${pr.value}`}
                                  {pr.type === 'volume' && `Volumen: ${formatNumber(pr.value)}kg`}
                                  {pr.type === 'one_rm' && `1RM: ${pr.value.toFixed(1)}kg`}
                                </div>
                                <div className="text-xs text-gray-500 mt-2">
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
