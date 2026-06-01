'use client';

import { ProtectedRoute } from '@/components/protected-route';
import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { Workout } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Field, FieldLabel } from '@/components/ui/field';
import { DatePicker } from '@/components/date-picker';
import {
  IconChevronLeft,
  IconCheck,
  IconX,
  IconBarbell,
  IconFlame,
} from '@tabler/icons-react';

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

            {/* Exercises */}
            <div className="space-y-4">
              {workout.exercises.map((exercise, idx) => (
                <Card key={exercise.id}>
                  <CardContent className="p-6">
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-foreground">
                        #{idx + 1} {exercise.exerciseName}
                      </h3>
                    </div>

                    {/* Sets */}
                    <div className="space-y-3">
                      {exercise.sets.map((set) => {
                        const editedSet = editedSets[exercise.id]?.[set.id];
                        const isWarmup = set.setType === 'WARMUP';
                        return (
                          <div
                            key={set.id}
                            className="rounded-md border bg-muted/30 p-4"
                          >
                            <div className="flex items-center gap-3 mb-3">
                              <Badge
                                variant={isWarmup ? 'outline' : 'default'}
                                className="p-1"
                                title={isWarmup ? 'Aufwärmen' : 'Arbeit'}
                              >
                                {isWarmup ? (
                                  <IconFlame className="size-7" />
                                ) : (
                                  <IconBarbell className="size-7" />
                                )}
                              </Badge>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                              <Field>
                                <FieldLabel className="text-xs">
                                  Wiederholungen{exercise.isUnilateral ? ' (2x)' : ''}
                                </FieldLabel>
                                <Input
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
                                  className="w-full text-sm"
                                />
                              </Field>
                              <Field>
                                <FieldLabel className="text-xs">
                                  Gewicht (kg){exercise.isDoubleWeight ? ' (2x)' : ''}
                                </FieldLabel>
                                <Input
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
                                  className="w-full text-sm"
                                />
                              </Field>
                              <Field>
                                <FieldLabel className="text-xs">RIR</FieldLabel>
                                <Input
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
                                  className="w-full text-sm"
                                />
                              </Field>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => router.push('/history')}
                disabled={saving}
              >
                <IconX className="mr-2 size-4" />
                Abbrechen
              </Button>
              <Button
                className="flex-1"
                onClick={handleSave}
                disabled={saving}
              >
                <IconCheck className="mr-2 size-4" />
                {saving ? 'Speichert...' : 'Speichern'}
              </Button>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
