'use client';

import { ProtectedRoute } from '@/components/protected-route';
import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { Workout } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { Badge } from '@/components/ui/badge';
import { Field, FieldLabel } from '@/components/ui/field';
import { DatePicker } from '@/components/date-picker';
import ActiveWorkoutScreen from '@/components/workout/active-workout-screen';
import { useWorkout } from '@/lib/workout-context';
import {
  IconChevronLeft,
} from '@tabler/icons-react';

export default function EditWorkoutPage() {
  const router = useRouter();
  const params = useParams();
  const workoutId = params.id as string;

  const { setActiveWorkoutDirectly, activeWorkout } = useWorkout();

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [workoutDate, setWorkoutDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (workout) {
      setActiveWorkoutDirectly(workout);
    }
  }, [workout, setActiveWorkoutDirectly]);

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
      router.push('/history');
    } finally {
      setLoading(false);
    }
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
              onClick={() => router.push('/history')}
              className="flex items-center gap-2 -ml-2"
            >
              <IconChevronLeft className="size-4" />
              Zurück zum Verlauf
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

            {/* Exercises - using central shared component in edit mode */}
            <ActiveWorkoutScreen 
              mode="edit" 
              showBottomBar={false} 
            />

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
