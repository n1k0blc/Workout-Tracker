'use client';

import { ProtectedRoute } from '@/components/protected-route';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { Workout } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { Badge } from '@/components/ui/badge';
import { Field, FieldLabel } from '@/components/ui/field';
import { DatePicker } from '@/components/date-picker';
import ExerciseCard from '@/components/workout/exercise-card';
import { useWorkout } from '@/lib/workout-context';
import {
  IconChevronLeft,
} from '@tabler/icons-react';

export default function EditWorkoutPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const workoutId = params.id as string;

  // Support navigation context: coming from cycle detail or regular history
  const fromCycle = searchParams.get('from') === 'cycle';
  const cycleId = searchParams.get('cycleId');

  const { setActiveWorkoutDirectly, activeWorkout } = useWorkout();

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [workoutDate, setWorkoutDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const navigateBack = () => {
    if (fromCycle && cycleId) {
      router.push(`/cycles/${cycleId}`);
    } else {
      router.push('/history');
    }
  };

  useEffect(() => {
    if (workout) {
      // Technical debt workaround (see UI-REFRACTORING-PLAN.md): the API always returns the full
      // plannedSets snapshot from the (current) blueprint for the workout. In history edit of a
      // *performed* record we only want to show rows for the sets that were actually executed
      // (i.e. exist in .sets). Un-performed / previously removed planned sets should not appear
      // as if they are part of the historical performed data.
      // We trim here for the hijacked context (cards see only matching planned). This is pure
      // frontend view adjustment; the real persisted data (sets) is untouched. No backend change.
      const trimmedForEdit = {
        ...workout,
        exercises: workout.exercises.map((ex) => {
          const performed = new Set(ex.sets.map((s) => s.setNumber));
          return {
            ...ex,
            plannedSets: (ex.plannedSets || []).filter((ps) => performed.has(ps.order)),
          };
        }),
      };
      setActiveWorkoutDirectly(trimmedForEdit);
    }
  }, [workout]); // eslint-disable-line react-hooks/exhaustive-deps -- setActiveWorkoutDirectly is stable (useCallback([]))

  // Clear the hijacked completed workout from global context when leaving this edit view
  // (browser back, or unmount). This prevents the main site header/nav from staying hidden
  // (MobileNav hides on any activeWorkout, but we only want that for real IN_PROGRESS sessions).
  useEffect(() => {
    return () => {
      setActiveWorkoutDirectly(null);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- rely on stable ref from context; including it caused update loops on clear

  const loadWorkout = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.getWorkout(workoutId);
      setWorkout(data);
      
      // Format date for input (YYYY-MM-DD)
      const date = new Date(data.date);
      const formattedDate = date.toISOString().split('T')[0];
      setWorkoutDate(formattedDate);
    } catch (error) {
      console.error('Failed to load workout:', error);
      alert('Fehler beim Laden des Workouts');
      if (fromCycle && cycleId) {
        router.push(`/cycles/${cycleId}`);
      } else {
        router.push('/history');
      }
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutId, router]);

  useEffect(() => {
    loadWorkout();
  }, [loadWorkout]);

  const handleSaveFromShared = async () => {
    if (!activeWorkout) return;

    setSaving(true);
    try {
      const exercises = activeWorkout.exercises.map((exercise) => ({
        id: exercise.id,
        sets: exercise.sets.map((set) => ({
          id: set.id,
          reps: set.reps,
          weight: set.weight,
          rir: set.rir,
        })),
      }));

      await apiClient.updateCompletedWorkout(workoutId, {
        completedAt: new Date(workoutDate + 'T12:00:00').toISOString(),
        exercises,
      });

      navigateBack();
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
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-lg text-muted-foreground">Lädt Workout...</div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0 space-y-6">
            {/* Back Button */}
            <Button
              variant="ghost"
              onClick={navigateBack}
              className="flex items-center gap-2 -ml-2"
            >
              <IconChevronLeft className="size-4" />
              {fromCycle && cycleId ? 'Zurück zu Zyklusdetails' : 'Zurück zum Verlauf'}
            </Button>

            {/* Header */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">
                      Workout bearbeiten
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {workout.isFreeWorkout
                        ? workout.templateName || 'Freies Workout'
                        : workout.workoutDayName || 'Workout'}
                      {workout.cycleName && ` - ${workout.cycleName}`}
                    </p>
                  </div>
                  <Badge variant="outline">Bearbeitung</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Workout Date */}
            <Card>
              <CardContent className="p-6">
                <Field>
                  <FieldLabel>Workout-Datum</FieldLabel>
                  <DatePicker
                    date={workoutDate ? new Date(workoutDate) : null}
                    onSelect={(date) => {
                      if (date) {
                        const y = date.getFullYear();
                        const m = String(date.getMonth() + 1).padStart(2, '0');
                        const d = String(date.getDate()).padStart(2, '0');
                        setWorkoutDate(`${y}-${m}-${d}`);
                      } else {
                        setWorkoutDate('');
                      }
                    }}
                    className="w-full md:w-auto"
                  />
                </Field>
                <p className="mt-2 text-sm text-muted-foreground">
                  Ursprünglich: {formatDate(workout.date)}
                </p>
              </CardContent>
            </Card>

            {/* Exercises rendered directly with central ExerciseCard in restricted history-edit mode.
                No reordering, no exercise actions (replace/delete), no set add/delete, no logging.
                Only value edits, type changes and collapse/expand are allowed. */}
            <div className="space-y-4">
              {activeWorkout?.exercises?.map((exercise, idx) => (
                <ExerciseCard
                  key={exercise.id}
                  exercise={exercise}
                  exerciseNumber={idx + 1}
                  mode="edit"
                  allowReorder={false}
                  allowExerciseActions={false}
                  allowSetManagement={false}
                  allowLogging={false}
                />
              ))}
            </div>

            <div className="flex justify-end">
              <Button 
                onClick={handleSaveFromShared} 
                disabled={saving || !activeWorkout}
                className="w-full md:w-auto"
              >
                {saving ? 'Speichert...' : 'Speichern'}
              </Button>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
