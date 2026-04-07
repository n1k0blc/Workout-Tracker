'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { Exercise, HomeGym, WorkoutTemplate, SetType } from '@/types';
import { Plus, Trash2 } from 'lucide-react';
import ExerciseSelectionModal from '@/components/workout/exercise-selection-modal';

interface TemplateSet {
  id: string;
  order: number;
  isWarmup: boolean;
  targetReps: number;
  targetWeight: number;
  targetRir: number;
}

interface TemplateExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  order: number;
  sets: TemplateSet[];
}

interface TemplateEditorScreenProps {
  templateId?: string;
}

export default function TemplateEditorScreen({ templateId }: TemplateEditorScreenProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [recommendedGymId, setRecommendedGymId] = useState<string>('');
  const [exercises, setExercises] = useState<TemplateExercise[]>([]);
  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);
  const [availableGyms, setAvailableGyms] = useState<HomeGym[]>([]);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [loading, setLoading] = useState(!!templateId);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [gyms, allExercises] = await Promise.all([
        apiClient.getHomeGyms(),
        apiClient.getExercises(),
      ]);
      setAvailableGyms(gyms);
      setAvailableExercises(allExercises);

      if (templateId) {
        const template = await apiClient.getWorkoutTemplate(templateId);
        setName(template.name);
        setRecommendedGymId(template.recommendedGymId || '');
        
        if (template.exercises) {
          setExercises(
            template.exercises.map((ex) => ({
              id: `ex-${ex.order}`,
              exerciseId: ex.exerciseId,
              exerciseName: ex.exerciseName || '',
              order: ex.order,
              sets: ex.sets.map((set) => ({
                id: `set-${ex.order}-${set.order}`,
                order: set.order,
                isWarmup: set.isWarmup,
                targetReps: set.targetReps,
                targetWeight: set.targetWeight,
                targetRir: set.targetRir,
              })),
            }))
          );
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      alert('Fehler beim Laden der Daten.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddExercise = async (exerciseId: string) => {
    const exercise = availableExercises.find((ex) => ex.id === exerciseId);
    if (!exercise) {
      alert('Übung nicht gefunden.');
      return;
    }

    const newOrder = exercises.length;

    setExercises([
      ...exercises,
      {
        id: `ex-${Date.now()}`,
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        order: newOrder,
        sets: [],
      },
    ]);
    setShowExerciseModal(false);
  };

  const handleRemoveExercise = (exerciseId: string) => {
    const newExercises = exercises.filter((ex) => ex.id !== exerciseId);
    // Reorder
    newExercises.forEach((ex, index) => {
      ex.order = index;
    });
    setExercises(newExercises);
  };

  const handleAddSet = (exerciseId: string) => {
    setExercises(
      exercises.map((ex) => {
        if (ex.id === exerciseId) {
          const newSetOrder = ex.sets.length;
          return {
            ...ex,
            sets: [
              ...ex.sets,
              {
                id: `set-${Date.now()}`,
                order: newSetOrder,
                isWarmup: false,
                targetReps: 10,
                targetWeight: 0,
                targetRir: 2,
              },
            ],
          };
        }
        return ex;
      })
    );
  };

  const handleRemoveSet = (exerciseId: string, setId: string) => {
    setExercises(
      exercises.map((ex) => {
        if (ex.id === exerciseId) {
          const newSets = ex.sets.filter((s) => s.id !== setId);
          // Reorder
          newSets.forEach((set, index) => {
            set.order = index;
          });
          return { ...ex, sets: newSets };
        }
        return ex;
      })
    );
  };

  const handleUpdateSet = (
    exerciseId: string,
    setId: string,
    field: keyof TemplateSet,
    value: any
  ) => {
    setExercises(
      exercises.map((ex) => {
        if (ex.id === exerciseId) {
          return {
            ...ex,
            sets: ex.sets.map((set) => {
              if (set.id === setId) {
                return { ...set, [field]: value };
              }
              return set;
            }),
          };
        }
        return ex;
      })
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Bitte gib einen Namen für die Vorlage ein.');
      return;
    }

    if (exercises.length === 0) {
      alert('Bitte füge mindestens eine Übung hinzu.');
      return;
    }

    const invalidExercise = exercises.find((ex) => ex.sets.length === 0);
    if (invalidExercise) {
      alert('Jede Übung muss mindestens einen Satz haben.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        recommendedGymId: recommendedGymId || undefined,
        exercises: exercises.map((ex) => ({
          exerciseId: ex.exerciseId,
          order: ex.order,
          sets: ex.sets.map((set) => ({
            order: set.order,
            isWarmup: set.isWarmup,
            targetReps: set.targetReps,
            targetWeight: set.targetWeight,
            targetRir: set.targetRir,
          })),
        })),
      };

      if (templateId) {
        await apiClient.updateWorkoutTemplate(templateId, payload);
      } else {
        await apiClient.createWorkoutTemplate(payload);
      }

      router.push('/templates');
    } catch (error) {
      console.error('Failed to save template:', error);
      alert('Fehler beim Speichern der Vorlage.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Lädt...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0 space-y-6">
          {/* Header */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {templateId ? 'Vorlage bearbeiten' : 'Neue Vorlage erstellen'}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Erstelle eine Workout-Vorlage mit Übungen und Sätzen
            </p>
          </div>

          {/* Template Info */}
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vorlagenname
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. Upper Body, Push Day, etc."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Empfohlenes Studio (Optional)
              </label>
              <select
                value={recommendedGymId}
                onChange={(e) => setRecommendedGymId(e.target.value)}
                className="w-full md:w-auto px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Kein empfohlenes Studio</option>
                {availableGyms.map((gym) => (
                  <option key={gym.id} value={gym.id}>
                    {gym.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Exercises */}
          <div className="space-y-4">
            {exercises.map((exercise, index) => (
              <div key={exercise.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    #{index + 1} {exercise.exerciseName}
                  </h3>
                  <button
                    onClick={() => handleRemoveExercise(exercise.id)}
                    className="text-red-600 hover:text-red-800 transition-colors"
                    title="Übung entfernen"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>

                {/* Sets */}
                <div className="space-y-3">
                  {exercise.sets.map((set, setIndex) => (
                    <div
                      key={set.id}
                      className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-700">
                          Satz {setIndex + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                            {set.isWarmup ? 'Aufwärmen' : 'Arbeitssatz'}
                          </span>
                          <button
                            onClick={() => handleRemoveSet(exercise.id, set.id)}
                            className="text-red-600 hover:text-red-800 transition-colors"
                            title="Satz entfernen"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">
                            Typ
                          </label>
                          <select
                            value={set.isWarmup ? 'warmup' : 'working'}
                            onChange={(e) =>
                              handleUpdateSet(
                                exercise.id,
                                set.id,
                                'isWarmup',
                                e.target.value === 'warmup'
                              )
                            }
                            className="w-full px-2 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="warmup">Aufwärmen</option>
                            <option value="working">Arbeitssatz</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs text-gray-600 mb-1">
                            Wiederholungen
                          </label>
                          <input
                            type="number"
                            value={set.targetReps}
                            onChange={(e) =>
                              handleUpdateSet(
                                exercise.id,
                                set.id,
                                'targetReps',
                                parseInt(e.target.value) || 0
                              )
                            }
                            min="1"
                            className="w-full px-2 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-gray-600 mb-1">
                            Gewicht (kg)
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            value={set.targetWeight}
                            onChange={(e) =>
                              handleUpdateSet(
                                exercise.id,
                                set.id,
                                'targetWeight',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            min="0"
                            className="w-full px-2 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-gray-600 mb-1">
                            RIR
                          </label>
                          <input
                            type="number"
                            value={set.targetRir}
                            onChange={(e) =>
                              handleUpdateSet(
                                exercise.id,
                                set.id,
                                'targetRir',
                                parseInt(e.target.value) || 0
                              )
                            }
                            min="0"
                            max="10"
                            placeholder="-"
                            className="w-full px-2 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Add Set Button */}
                  <button
                    onClick={() => handleAddSet(exercise.id)}
                    className="w-full py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Satz hinzufügen
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add Exercise Button */}
          <button
            onClick={() => setShowExerciseModal(true)}
            className="w-full py-3 border-2 border-dashed border-gray-300 text-gray-600 rounded-lg hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600 transition-all flex items-center justify-center gap-2"
          >
            <Plus className="h-5 w-5" />
            <span className="font-medium">Übung hinzufügen</span>
          </button>

          {/* Actions */}
          {exercises.length > 0 && (
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/templates')}
                disabled={saving}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Speichert...' : 'Speichern'}
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Exercise Selection Modal */}
      {showExerciseModal && (
        <ExerciseSelectionModal
          onSelect={handleAddExercise}
          onClose={() => setShowExerciseModal(false)}
        />
      )}
    </div>
  );
}
