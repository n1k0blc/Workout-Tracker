import { useState, useEffect } from 'react';
import { CycleFormData } from './cycle-wizard';
import { Exercise } from '@/types';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { IconFlame, IconBarbell } from '@tabler/icons-react';

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
      {formData.workoutDays.map((day, dayIndex) => (
        <Card key={dayIndex}>
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
              <div className="space-y-3">
                {day.blueprint.exercises.map((ex, idx) => {
                  const exercise = exercises.find((e) => e.id === ex.exerciseId);
                  return (
                    <div
                      key={idx}
                      className="border border-border rounded-lg p-4 bg-muted/30"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-muted-foreground">
                            #{ex.order}
                          </span>
                          <h4 className="font-semibold text-foreground">
                            {exercise?.name || 'Übung lädt...'}
                          </h4>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-sm font-medium text-muted-foreground">
                          Sätze ({ex.sets.length}):
                        </div>
                        {ex.sets.map((set, setIdx) => (
                          <div key={setIdx} className="bg-card rounded p-2 text-sm border border-border">
                            <span className="inline-flex items-center gap-1">
                              {set.setType === 'WARMUP' ? (
                                <IconFlame className="size-4 text-orange-500" />
                              ) : (
                                <IconBarbell className="size-4 text-foreground" />
                              )}
                              {set.setType === 'WARMUP' ? 'Aufwärmen' : 'Arbeit'}
                            </span>
                            {' • '}
                            {set.reps} Wdh × {set.weight}kg @ RIR {set.rir}
                            {' • '}
                            <span className="text-muted-foreground">Pause: {set.restAfterSet}s</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
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
