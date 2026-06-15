import { useState, useEffect } from 'react';
import { CycleFormData } from './cycle-wizard';
import { Exercise } from '@/types';
import { apiClient } from '@/lib/api';

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

  useEffect(() => {
    loadExercises();
  }, []);

  const loadExercises = async () => {
    try {
      const data = await apiClient.getExercises({ includeCustom: true });
      setExercises(data);
    } catch (error) {
      console.error('Failed to load exercises:', error);
    }
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

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Zusammenfassung
        </h3>
        <div className="space-y-4">
          <div className="flex justify-between">
            <span className="text-gray-600">Zyklus-Name:</span>
            <span className="font-semibold text-gray-900">{formData.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Dauer:</span>
            <span className="font-semibold text-gray-900">
              {formData.duration} Wochen
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Start-Datum:</span>
            <span className="font-semibold text-gray-900">
              {formatDate(formData.startDate)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Trainingstage:</span>
            <span className="font-semibold text-gray-900">
              {formData.workoutDays.length}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Gesamte Übungen:</span>
            <span className="font-semibold text-gray-900">
              {totalExercises}
            </span>
          </div>
        </div>
      </div>

      {/* Workout Days Details */}
      {formData.workoutDays.map((day, dayIndex) => (
        <div key={dayIndex} className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {day.name || getWeekday(day.weekday)}
            </h3>
            <span className="text-sm text-gray-600">
              {getWeekday(day.weekday)}
            </span>
          </div>

          {day.blueprint.exercises.length > 0 ? (
            <div className="space-y-3">
              {day.blueprint.exercises.map((ex, idx) => {
                const exercise = exercises.find((e) => e.id === ex.exerciseId);
                return (
                  <div
                    key={idx}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-500">
                          #{ex.order}
                        </span>
                        <h4 className="font-semibold text-gray-900">
                          {exercise?.name || 'Übung lädt...'}
                        </h4>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm font-medium text-gray-700">
                        Sätze ({ex.sets.length}):
                      </div>
                      {ex.sets.map((set, setIdx) => (
                        <div key={setIdx} className="bg-gray-50 rounded p-2 text-sm">
                          <span className={set.setType === 'WARMUP' ? 'text-orange-600' : 'text-blue-600'}>
                            {set.setType === 'WARMUP' ? 'Aufwärmen' : 'Arbeit'}
                          </span>
                          {' • '}
                          {set.reps} Wdh × {set.weight}kg @ RIR {set.rir}
                          {' • '}
                          <span className="text-gray-600">Pause: {set.restAfterSet}s</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">
              Keine Übungen definiert
            </p>
          )}
        </div>
      ))}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          Zurück
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading}
          className="flex-1 py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Wird erstellt...' : 'Zyklus erstellen'}
        </button>
      </div>
    </div>
  );
}
