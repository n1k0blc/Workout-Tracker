'use client';

import { ProtectedRoute } from '@/components/protected-route';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { CycleDetails, PersonalRecord, WorkoutListItem } from '@/types';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Calendar, 
  Dumbbell, 
  TrendingUp, 
  Trophy,
  MapPin,
} from 'lucide-react';
import Confetti from 'react-confetti';
import CircularProgress from '@/components/CircularProgress';

export default function CycleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const cycleId = params.id as string;
  const showCelebration = searchParams.get('celebration') === 'true';

  const [cycleDetails, setCycleDetails] = useState<CycleDetails | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutListItem[]>([]);
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(showCelebration);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    loadData();
  }, [cycleId]);

  useEffect(() => {
    // Set window size for confetti
    setWindowSize({
      width: window.innerWidth,
      height: window.innerHeight,
    });

    // Stop confetti after 3 seconds
    if (showCelebration) {
      const timer = setTimeout(() => {
        setShowConfetti(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showCelebration]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [details, cycleWorkouts, prs] = await Promise.all([
        apiClient.getCycleDetails(cycleId),
        apiClient.getWorkoutHistory({ cycleId: cycleId, status: 'COMPLETED' }),
        apiClient.getPersonalRecords({}),
      ]);

      setCycleDetails(details);
      setWorkouts(cycleWorkouts);

      // Create a Set of cycle workout IDs for efficient lookup
      const cycleWorkoutIds = new Set(cycleWorkouts.map(w => w.id));

      // Filter PRs to only those from cycle workouts
      const cyclePRs = prs.recentPRs.filter(pr => cycleWorkoutIds.has(pr.workoutId));
      setPersonalRecords(cyclePRs);

    } catch (error) {
      console.error('Failed to load cycle details:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  };

  const formatVolume = (volume: number): string => {
    return new Intl.NumberFormat('de-DE').format(Math.round(volume));
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes} min`;
  };

  const formatPRType = (type: string) => {
    switch (type) {
      case 'weight':
        return 'Gewicht';
      case 'reps':
        return 'Wiederholungen';
      case 'volume':
        return 'Volumen';
      case 'one_rm':
        return '1RM';
      default:
        return type;
    }
  };

  const formatPRValue = (pr: PersonalRecord) => {
    switch (pr.type) {
      case 'weight':
        return `${pr.value} kg`;
      case 'reps':
        return `${pr.value} Wdh`;
      case 'volume':
        return `${Math.round(pr.value)} kg`;
      case 'one_rm':
        return `${Math.round(pr.value)} kg`;
      default:
        return `${pr.value}`;
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-lg text-gray-600">Lädt Zyklusdetails...</div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!cycleDetails) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-lg text-gray-600">Zyklus nicht gefunden</div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        {/* Confetti */}
        {showConfetti && (
          <Confetti
            width={windowSize.width}
            height={windowSize.height}
            recycle={false}
            numberOfPieces={300}
          />
        )}

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0 space-y-6">
            {/* Header */}
            <div>
              <button
                onClick={() => router.push('/cycles')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
              >
                <ArrowLeft className="h-4 w-4" />
                Zurück zu Zyklen
              </button>

              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold text-gray-900">
                      {cycleDetails.name}
                    </h1>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-semibold ${ 
                        cycleDetails.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {cycleDetails.status === 'ACTIVE' ? 'Aktiv' : 'Abgeschlossen'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {formatDate(cycleDetails.startDate)} - {formatDate(cycleDetails.endDate)}
                    </span>
                    {cycleDetails.completedAt && (
                      <span className="ml-2 text-sm">
                        (Beendet: {formatDate(cycleDetails.completedAt)})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Circular Progress (for active cycles) */}
              {cycleDetails.status === 'ACTIVE' && cycleDetails.currentWeek && cycleDetails.totalWeeks && (
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="text-sm font-medium text-gray-600 mb-4">
                    Fortschritt
                  </div>
                  <div className="flex justify-center">
                    <CircularProgress
                      current={cycleDetails.currentWeek}
                      total={cycleDetails.totalWeeks}
                      size={120}
                    />
                  </div>
                </div>
              )}

              {/* Total Volume */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-gray-600">
                    Gesamtvolumen
                  </div>
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  {formatVolume(cycleDetails.totalVolume)}
                </div>
                <div className="text-sm text-gray-500 mt-1">kg bewegt</div>
              </div>

              {/* Workout Count */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-gray-600">
                    Workouts
                  </div>
                  <Dumbbell className="h-5 w-5 text-blue-600" />
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-3">
                  {cycleDetails.workoutCount}
                </div>
                <div className="space-y-1">
                  {cycleDetails.workoutsByGym.map((gym, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-1 text-gray-600">
                        {gym.isHome && <MapPin className="h-3 w-3" />}
                        <span>{gym.gymName}</span>
                      </div>
                      <span className="font-medium text-gray-900">{gym.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* PRs */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-gray-600">
                    Personal Records
                  </div>
                  <Trophy className="h-5 w-5 text-yellow-600" />
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  {personalRecords.length}
                </div>
                <div className="text-sm text-gray-500 mt-1">neue PRs</div>
              </div>
            </div>

            {/* PRs List */}
            {personalRecords.length > 0 && (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Personal Records
                  </h2>
                </div>
                <div className="p-6 space-y-3">
                  {personalRecords.map((pr, index) => (
                    <div
                      key={index}
                      className="bg-gradient-to-r from-yellow-50 to-blue-50 border border-yellow-200 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900">
                            {pr.exerciseName}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            {formatPRType(pr.type)} PR • {formatDate(pr.date)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-blue-600">
                            {formatPRValue(pr)}
                          </div>
                          {pr.details?.weight && pr.details?.reps && (
                            <div className="text-sm text-gray-600 mt-1">
                              {pr.details.weight} kg × {pr.details.reps}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Workout History */}
            {workouts.length > 0 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Workout-Verlauf
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {workouts.length} Workout{workouts.length !== 1 ? 's' : ''} in diesem Zyklus
                  </p>
                </div>
                {workouts.map((workout) => (
                  <div
                    key={workout.id}
                    className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6"
                  >
                    <div className="flex items-start justify-between">
                      <Link
                        href={`/history/${workout.id}?from=cycle&cycleId=${cycleId}`}
                        className="flex-1"
                      >
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {workout.isFreeWorkout
                              ? workout.templateName || 'Freies Workout'
                              : workout.workoutDayName || 'Workout'}
                          </h3>
                          {workout.cycleWorkoutDay?.trainingDay && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              Tag {workout.cycleWorkoutDay.trainingDay}
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
                            <Calendar className="w-4 h-4" />
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
                            <Dumbbell className="w-4 h-4" />
                            <span>{workout.exerciseCount} Übung{workout.exerciseCount !== 1 ? 'en' : ''}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <TrendingUp className="w-4 h-4" />
                            <span>{formatVolume(workout.totalVolume)} kg</span>
                          </div>
                        </div>
                      </Link>
                      <Link
                        href={`/history/${workout.id}?from=cycle&cycleId=${cycleId}`}
                        className="ml-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Details anzeigen"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* New Cycle Button (for completed cycles) */}
            {cycleDetails.status === 'COMPLETED' && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={() => router.push('/cycles/new')}
                  className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Neuen Zyklus anlegen
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
