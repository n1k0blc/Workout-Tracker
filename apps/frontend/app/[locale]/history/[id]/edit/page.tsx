'use client';

import { ProtectedRoute } from '@/components/protected-route';
import { useParams, useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { ExerciseLog, SetLog, Workout, WorkoutExercise } from '@/types';
import { buildExerciseLogsForEdit, toExercisePayload } from '@/lib/workout-order';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { Badge } from '@/components/ui/badge';
import { Field, FieldLabel } from '@/components/ui/field';
import { DatePicker } from '@/components/date-picker';
import ExerciseCard from '@/components/workout/exercise-card';
import {
  IconChevronLeft,
} from '@tabler/icons-react';

type SetEditData = Partial<
  Pick<
    SetLog,
    | 'reps'
    | 'weight'
    | 'rir'
    | 'setType'
    | 'repsLeft'
    | 'repsRight'
    | 'weightLeft'
    | 'weightRight'
    | 'rirLeft'
    | 'rirRight'
  >
>;

export default function EditWorkoutPage() {
  const t = useTranslations('HistoryEditPage');
  const format = useFormatter();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const workoutId = params.id as string;

  // Support navigation context: coming from cycle detail or regular history
  const fromCycle = searchParams.get('from') === 'cycle';
  const cycleId = searchParams.get('cycleId');

  // The history editor owns its workout state locally and saves through its own update call
  // -- it never touches the shared workout context, the way the template and cycle blueprint
  // editors already work (issue #126). That keeps "a workout is in the context" meaning
  // unambiguously "a live session is running".
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [exercises, setExercises] = useState<ExerciseLog[]>([]);
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

  const loadWorkout = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.getWorkout(workoutId);
      setWorkout(data);
      setExercises(buildExerciseLogsForEdit(data.exercises as unknown as WorkoutExercise[]));
      // Seeded from the stored calendar day, not from the instant: reading the instant back
      // in UTC would show (and, on save, write back) the wrong day for a late-night session.
      setWorkoutDate(data.localDate);
    } catch (error) {
      console.error('Failed to load workout:', error);
      alert(t('loadError'));
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

  const handleUpdateSet = (exerciseId: string, setId: string, data: SetEditData) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? { ...ex, sets: ex.sets.map((s) => (s.id === setId ? { ...s, ...data } : s)) }
          : ex,
      ),
    );
  };

  const handleSave = async () => {
    if (!workout) return;

    setSaving(true);
    try {
      // The picked day is already a local calendar day, so it becomes localDate verbatim --
      // correcting a workout's date has to move both, or the two would disagree.
      await apiClient.updateWorkout(workoutId, {
        date: new Date(workoutDate + 'T12:00:00').toISOString(),
        localDate: workoutDate,
        totalDuration: workout.totalDuration ?? 0,
        isFreeWorkout: workout.isFreeWorkout,
        homeGymId: workout.homeGymId ?? undefined,
        cycleId: workout.cycleId,
        workoutDayId: workout.workoutDayId,
        originTemplateId: workout.originTemplateId,
        exercises: toExercisePayload(exercises),
      });
      navigateBack();
    } catch (error) {
      console.error('Failed to save workout:', error);
      alert(t('saveError'));
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return format.dateTime(new Date(dateStr), {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  if (loading || !workout) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-lg text-muted-foreground">{t('loading')}</div>
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
              {fromCycle && cycleId ? t('backToCycle') : t('backToHistory')}
            </Button>

            {/* Header */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">
                      {t('title')}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {workout.isFreeWorkout
                        ? workout.originTemplateName || t('freeWorkout')
                        : workout.workoutDayName || t('workout')}
                      {workout.cycleName && ` - ${workout.cycleName}`}
                    </p>
                  </div>
                  <Badge variant="outline">{t('editing')}</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Workout Date */}
            <Card>
              <CardContent className="p-6">
                <Field>
                  <FieldLabel>{t('date')}</FieldLabel>
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
                  {t('originally', { date: formatDate(workout.date) })}
                </p>
              </CardContent>
            </Card>

            {/* Exercises rendered directly with central ExerciseCard in restricted history-edit mode.
                No reordering, no exercise actions (replace/delete), no set add/delete, no logging.
                Only value edits, type changes and collapse/expand are allowed, written straight
                back into this screen's local state via the injected `onUpdateSet`. */}
            <div className="space-y-4">
              {exercises.map((exercise, idx) => (
                <ExerciseCard
                  key={exercise.id}
                  exercise={exercise}
                  exerciseNumber={idx + 1}
                  mode="edit"
                  allowReorder={false}
                  allowExerciseActions={false}
                  allowSetManagement={false}
                  allowLogging={false}
                  onUpdateSet={handleUpdateSet}
                />
              ))}
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full md:w-auto"
              >
                {saving ? t('saving') : t('save')}
              </Button>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
