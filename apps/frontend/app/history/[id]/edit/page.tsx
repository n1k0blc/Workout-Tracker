'use client';

import { ProtectedRoute } from '@/components/protected-route';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
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

  const { setActiveWorkoutDirectly, activeWorkout, loadWorkoutForEdit, completeWorkout } = useWorkout();

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

  // Clear the hijacked workout from global context when leaving this edit view
  // (browser back, or unmount). This prevents the main site header/nav from staying hidden.
  useEffect(() => {
    return () => {
      setActiveWorkoutDirectly(null);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- rely on stable ref from context; including it caused update loops on clear

  const loadWorkout = useCallback(async () => {
    setLoading(true);
    try {
      await loadWorkoutForEdit(workoutId);
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

  // Seed the date field once the workout has loaded into context.
  useEffect(() => {
    if (activeWorkout) {
      // Seeded from the stored calendar day, not from the instant: reading the instant back
      // in UTC would show (and, on save, write back) the wrong day for a late-night session.
      setWorkoutDate(activeWorkout.localDate);
    }
  }, [activeWorkout?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveFromShared = async () => {
    if (!activeWorkout) return;

    setSaving(true);
    try {
      // The picked day is already a local calendar day, so it becomes localDate verbatim --
      // correcting a workout's date has to move both, or the two would disagree.
      await completeWorkout({
        dateOverride: {
          date: new Date(workoutDate + 'T12:00:00').toISOString(),
          localDate: workoutDate,
        },
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

  if (loading || !activeWorkout) {
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
                      {activeWorkout.isFreeWorkout
                        ? activeWorkout.originTemplateName || 'Freies Workout'
                        : activeWorkout.workoutDayName || 'Workout'}
                      {activeWorkout.cycleName && ` - ${activeWorkout.cycleName}`}
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
                  Ursprünglich: {formatDate(activeWorkout.date)}
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
