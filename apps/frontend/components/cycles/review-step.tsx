import { useState, useEffect } from 'react';
import { CycleFormData } from './cycle-wizard';
import { Exercise } from '@/types';
import type { ExerciseLog } from '@/types';
import { apiClient } from '@/lib/api';
import { sortByCycleWeekday } from '@/lib/weekday';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ExerciseCard from '@/components/workout/exercise-card';

interface ReviewStepProps {
  formData: CycleFormData;
  onBack: () => void;
  onSubmit: () => void;
  loading: boolean;
}

export default function ReviewStep({
  formData,
  onBack,
  onSubmit,
  loading,
}: ReviewStepProps) {
  const [exercises, setExercises] = useState<Exercise[]>([]);

  const loadExercises = async () => {
    try {
      const data = await apiClient.getExercises({ includeCustom: true });
      setExercises(data);
    } catch (error) {
      console.error('Failed to load exercises:', error);
    }
  };

  useEffect(() => {
    const id = setTimeout(() => loadExercises(), 0);
    return () => clearTimeout(id);
  }, []);

  // Map day blueprint exercises to ExerciseLog shape for the central readonly ExerciseCard
  // (same as system template readonly view and the editable mapping in step 3)
  const mapDayExercisesToLogs = (dayExercises: any[]): ExerciseLog[] => { // eslint-disable-line @typescript-eslint/no-explicit-any
    return (dayExercises || []).map((ex: any, idx: number) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const exercise = exercises.find((e) => e.id === ex.exerciseId);
      const sets = (ex.sets || []).map((s: any, sIdx: number) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
        id: s.id || `set-${ex.exerciseId}-${sIdx}`,
        setNumber: s.order || sIdx + 1,
        setType: s.setType,
        reps: s.reps ?? 0,
        weight: s.weight ?? 0,
        rir: s.rir ?? 0,
        completedAt: new Date().toISOString(),
      }));
      const plannedSets = (ex.sets || []).map((s: any, sIdx: number) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
        id: `planned-${ex.exerciseId}-${sIdx}`,
        order: s.order || sIdx + 1,
        setType: s.setType,
        reps: s.reps ?? 0,
        weight: s.weight ?? 0,
        rir: s.rir ?? 0,
        rest: s.rest ?? 90,
      }));
      return {
        id: ex.id || `ex-${ex.exerciseId}-${idx}`,
        exerciseId: ex.exerciseId,
        exerciseName: exercise?.name || 'Übung lädt...',
        order: ex.order || idx + 1,
        sets,
        plannedSets,
      } as ExerciseLog;
    });
  };

  const getWeekday = (weekday: number): string => {
    const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    return days[weekday];
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  };

  const totalExercises = formData.workoutDays.reduce(
    (sum, day) => sum + day.blueprint.exercises.length,
    0
  );

  const sortedWorkoutDays = sortByCycleWeekday(formData.workoutDays, formData.startDate);

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Zusammenfassung
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Zyklus-Name:</span>
              <span className="font-medium text-foreground">{formData.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dauer:</span>
              <span className="font-medium text-foreground">
                {formData.duration} Wochen
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Start-Datum:</span>
              <span className="font-medium text-foreground">
                {formatDate(formData.startDate)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Trainingstage:</span>
              <span className="font-medium text-foreground">
                {formData.workoutDays.length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gesamte Übungen:</span>
              <span className="font-medium text-foreground">
                {totalExercises}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workout Days Details */}
      {sortedWorkoutDays.map((day) => (
        <Card key={day.weekday}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                {day.name || getWeekday(day.weekday)}
              </h3>
              <Badge variant="secondary">
                {getWeekday(day.weekday)}
              </Badge>
            </div>

            {day.blueprint.exercises.length > 0 ? (
              <div className="space-y-4">
                {mapDayExercisesToLogs(day.blueprint.exercises).map((exercise, idx) => (
                  <ExerciseCard
                    key={exercise.id}
                    exercise={exercise}
                    exerciseNumber={idx + 1}
                    mode="edit"
                    readonly={true}
                  />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                Keine Übungen definiert
              </p>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={loading}
          className="flex-1"
        >
          Zurück
        </Button>
        <Button
          type="button"
          onClick={onSubmit}
          disabled={loading}
          className="flex-1"
        >
          {loading ? 'Wird erstellt...' : 'Zyklus erstellen'}
        </Button>
      </div>
    </div>
  );
}
