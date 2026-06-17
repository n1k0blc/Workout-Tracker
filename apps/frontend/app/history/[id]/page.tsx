'use client';

import { ProtectedRoute } from '@/components/protected-route';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { Workout, SetType } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import ExerciseCard from '@/components/workout/exercise-card';
import {
  IconChevronLeft,
  IconCheck,
} from '@tabler/icons-react';

export default function WorkoutDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const workoutId = params?.id as string;
  
  // Check if coming from cycle detail page
  const fromCycle = searchParams.get('from') === 'cycle';
  const cycleId = searchParams.get('cycleId');
  
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (workoutId) {
      loadWorkout();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutId]);

  const loadWorkout = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getWorkout(workoutId);

      // Trim plannedSets to only those that were actually performed.
      // This prevents "unlogged/removed planned sets" (skipped during execution)
      // from appearing in the history view. Only the real executed sets (and their
      // matching planned rows) should be shown. Matches the behavior in history edit.
      const trimmedData = {
        ...data,
        exercises: data.exercises.map((ex) => {
          const performedNumbers = new Set(ex.sets.map((s) => s.setNumber));
          return {
            ...ex,
            plannedSets: (ex.plannedSets || []).filter((ps) => performedNumbers.has(ps.order)),
          };
        }),
      };

      setWorkout(trimmedData);
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
      <div className="min-h-screen bg-background">
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-lg text-muted-foreground">Lädt Workout...</div>
              </div>
            ) : workout ? (
              <div className="space-y-6">
                {/* Back Button */}
                {fromCycle && cycleId ? (
                  <Button
                    variant="ghost"
                    onClick={() => router.push(`/cycles/${cycleId}`)}
                    className="flex items-center gap-2 -ml-2"
                  >
                    <IconChevronLeft className="size-4" />
                    Zurück zu Zyklusdetails
                  </Button>
                ) : (
                  <Link href="/history">
                    <Button variant="ghost" className="flex items-center gap-2 -ml-2">
                      <IconChevronLeft className="size-4" />
                      Zurück zum Verlauf
                    </Button>
                  </Link>
                )}

                {/* Header */}
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h2 className="text-2xl font-bold text-foreground">
                          {workout.isFreeWorkout
                            ? workout.templateName || 'Freies Workout'
                            : workout.workoutDayName || 'Workout'}
                        </h2>
                        {workout.cycleName && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {workout.cycleName}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <IconCheck className="size-3.5" />
                          Abgeschlossen
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const editUrl = fromCycle && cycleId
                              ? `/history/${workoutId}/edit?from=cycle&cycleId=${cycleId}`
                              : `/history/${workoutId}/edit`;
                            router.push(editUrl);
                          }}
                        >
                          Bearbeiten
                        </Button>
                      </div>
                    </div>
                    <p className="text-muted-foreground">{formatDate(workout.date)}</p>
                  </CardContent>
                </Card>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card>
                    <CardContent className="p-6">
                      <div className="text-sm font-medium text-muted-foreground mb-1">
                        Dauer
                      </div>
                      <div className="text-2xl font-bold text-foreground">
                        {formatDuration(workout.totalDuration || 0)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="text-sm font-medium text-muted-foreground mb-1">
                        Gesamtvolumen
                      </div>
                      <div className="text-2xl font-bold text-foreground">
                        {formatNumber(calculateTotalVolume())}{' '}
                        <span className="text-lg text-muted-foreground">kg</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="text-sm font-medium text-muted-foreground mb-1">
                        Übungen
                      </div>
                      <div className="text-2xl font-bold text-foreground">
                        {workout.exercises.length}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Exercises - now using the shared modern ExerciseCard for consistent look */}
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-foreground">Übungen</h3>
                  {workout.exercises.map((exercise, idx) => (
                    <ExerciseCard
                      key={exercise.id}
                      exercise={exercise}
                      exerciseNumber={idx + 1}
                      mode="edit"
                      readonly={true}
                      allowReorder={false}
                      allowExerciseActions={false}
                      allowSetManagement={false}
                      allowLogging={false}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-muted-foreground mb-4">Workout nicht gefunden</p>
                  {fromCycle && cycleId ? (
                    <Button
                      variant="outline"
                      onClick={() => router.push(`/cycles/${cycleId}`)}
                    >
                      Zurück zu Zyklusdetails
                    </Button>
                  ) : (
                    <Link href="/history">
                      <Button variant="outline">Zurück zum Verlauf</Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
