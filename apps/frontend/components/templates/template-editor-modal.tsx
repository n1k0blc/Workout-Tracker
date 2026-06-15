'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import {
  Exercise,
  HomeGym,
  CreateWorkoutTemplate,
  UpdateWorkoutTemplate,
  WorkoutTemplate,
} from '@/types';
import { X, Plus, Trash2, DollarSign } from 'lucide-react';

interface TemplateEditorModalProps {
  templateId?: string; // If provided, edit mode
  onClose: () => void;
  onSave: () => void;
}

interface TemplateSet {
  order: number;
  isWarmup: boolean;
  targetReps: number;
  targetWeight: number;
  targetRir: number;
}

interface TemplateExercise {
  exerciseId: string;
  exerciseName?: string;
  order: number;
  sets: TemplateSet[];
}

interface TemplateFormData {
  name: string;
  recommendedGymId?: string;
  exercises: TemplateExercise[];
}

export default function TemplateEditorModal({
  templateId,
  onClose,
  onSave,
}: TemplateEditorModalProps) {
  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    exercises: [],
  });
  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);
  const [availableGyms, setAvailableGyms] = useState<HomeGym[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [exercises, gyms] = await Promise.all([
        apiClient.getExercises(),
        apiClient.getHomeGyms(),
      ]);
      setAvailableExercises(exercises);
      setAvailableGyms(gyms);

      // If editing, load template data
      if (templateId) {
        const template = await apiClient.getWorkoutTemplate(templateId);
        setFormData({
          name: template.name,
          recommendedGymId: template.recommendedGymId || undefined,
          exercises: template.exercises
            ? template.exercises.map((ex) => ({
                exerciseId: ex.exerciseId,
                exerciseName: ex.exerciseName,
                order: ex.order,
                sets: ex.sets.map((set) => ({
                  order: set.order,
                  isWarmup: set.isWarmup,
                  targetReps: set.targetReps,
                  targetWeight: set.targetWeight,
                  targetRir: set.targetRir,
                })),
              }))
            : [],
        });
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      alert('Fehler beim Laden der Daten.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddExercise = () => {
    const newOrder = formData.exercises.length;
    setFormData({
      ...formData,
      exercises: [
        ...formData.exercises,
        {
          exerciseId: '',
          order: newOrder,
          sets: [],
        },
      ],
    });
  };

  const handleRemoveExercise = (index: number) => {
    const newExercises = formData.exercises.filter((_, i) => i !== index);
    // Reorder
    newExercises.forEach((ex, i) => {
      ex.order = i;
    });
    setFormData({ ...formData, exercises: newExercises });
  };

  const handleExerciseChange = (index: number, exerciseId: string) => {
    const exercise = availableExercises.find((ex) => ex.id === exerciseId);
    const newExercises = [...formData.exercises];
    newExercises[index] = {
      ...newExercises[index],
      exerciseId,
      exerciseName: exercise?.name,
    };
    setFormData({ ...formData, exercises: newExercises });
  };

  const handleAddSet = (exerciseIndex: number) => {
    const newExercises = [...formData.exercises];
    const newSetOrder = newExercises[exerciseIndex].sets.length;
    newExercises[exerciseIndex].sets.push({
      order: newSetOrder,
      isWarmup: false,
      targetReps: 10,
      targetWeight: 0,
      targetRir: 2,
    });
    setFormData({ ...formData, exercises: newExercises });
  };

  const handleRemoveSet = (exerciseIndex: number, setIndex: number) => {
    const newExercises = [...formData.exercises];
    newExercises[exerciseIndex].sets = newExercises[exerciseIndex].sets.filter(
      (_, i) => i !== setIndex
    );
    // Reorder sets
    newExercises[exerciseIndex].sets.forEach((set, i) => {
      set.order = i;
    });
    setFormData({ ...formData, exercises: newExercises });
  };

  const handleSetChange = (
    exerciseIndex: number,
    setIndex: number,
    field: keyof TemplateSet,
    value: any
  ) => {
    const newExercises = [...formData.exercises];
    newExercises[exerciseIndex].sets[setIndex] = {
      ...newExercises[exerciseIndex].sets[setIndex],
      [field]: value,
    };
    setFormData({ ...formData, exercises: newExercises });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Bitte gib einen Namen ein.');
      return;
    }

    if (formData.exercises.length === 0) {
      alert('Bitte füge mindestens eine Übung hinzu.');
      return;
    }

    // Validate all exercises have an exerciseId
    const invalidExercise = formData.exercises.find((ex) => !ex.exerciseId);
    if (invalidExercise) {
      alert('Bitte wähle für alle Übungen eine Übung aus.');
      return;
    }

    // Validate all exercises have at least one set
    const exerciseWithoutSets = formData.exercises.find((ex) => ex.sets.length === 0);
    if (exerciseWithoutSets) {
      alert('Jede Übung muss mindestens einen Satz haben.');
      return;
    }

    setSaving(true);
    try {
      if (templateId) {
        const payload: UpdateWorkoutTemplate = {
          name: formData.name.trim(),
          recommendedGymId: formData.recommendedGymId || undefined,
          exercises: formData.exercises.map((ex) => ({
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
        await apiClient.updateWorkoutTemplate(templateId, payload);
      } else {
        const payload: CreateWorkoutTemplate = {
          name: formData.name.trim(),
          recommendedGymId: formData.recommendedGymId || undefined,
          exercises: formData.exercises.map((ex) => ({
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
        await apiClient.createWorkoutTemplate(payload);
      }

      onSave();
      onClose();
    } catch (error) {
      console.error('Failed to save template:', error);
      alert('Fehler beim Speichern der Vorlage.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-auto">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {templateId ? 'Vorlage bearbeiten' : 'Neue Vorlage erstellen'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-600">Lädt...</div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name der Vorlage *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="z.B. Upper Body, Push Day, etc."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Gym */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Empfohlenes Studio (Optional)
              </label>
              <select
                value={formData.recommendedGymId || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    recommendedGymId: e.target.value || undefined,
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Kein Studio</option>
                {availableGyms.map((gym) => (
                  <option key={gym.id} value={gym.id}>
                    {gym.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Exercises */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="text-sm font-medium text-gray-700">Übungen *</label>
                <button
                  onClick={handleAddExercise}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  Übung hinzufügen
                </button>
              </div>

              {formData.exercises.length === 0 ? (
                <div className="bg-gray-50 rounded-lg p-8 text-center">
                  <p className="text-gray-500 text-sm">
                    Noch keine Übungen hinzugefügt. Klicke auf "Übung hinzufügen" um zu
                    starten.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {formData.exercises.map((exercise, exerciseIndex) => (
                    <div
                      key={exerciseIndex}
                      className="bg-gray-50 rounded-lg p-4 space-y-3"
                    >
                      {/* Exercise Header */}
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <select
                            value={exercise.exerciseId}
                            onChange={(e) =>
                              handleExerciseChange(exerciseIndex, e.target.value)
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="">Übung auswählen...</option>
                            {availableExercises.map((ex) => (
                              <option key={ex.id} value={ex.id}>
                                {ex.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          onClick={() => handleRemoveExercise(exerciseIndex)}
                          className="text-red-600 hover:text-red-800 transition-colors p-2"
                          title="Übung entfernen"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>

                      {/* Sets */}
                      {exercise.exerciseId && (
                        <div className="ml-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-gray-600">
                              Sätze
                            </label>
                            <button
                              onClick={() => handleAddSet(exerciseIndex)}
                              className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded hover:bg-blue-200 transition-colors"
                            >
                              + Satz
                            </button>
                          </div>

                          {exercise.sets.length === 0 ? (
                            <p className="text-xs text-gray-500">Noch keine Sätze</p>
                          ) : (
                            <div className="space-y-2">
                              {exercise.sets.map((set, setIndex) => (
                                <div
                                  key={setIndex}
                                  className="bg-white rounded p-3 flex items-center gap-3"
                                >
                                  <div className="flex-1 grid grid-cols-5 gap-2">
                                    {/* Warmup/Working */}
                                    <div>
                                      <label className="block text-xs text-gray-600 mb-1">
                                        Typ
                                      </label>
                                      <select
                                        value={set.isWarmup ? 'warmup' : 'working'}
                                        onChange={(e) =>
                                          handleSetChange(
                                            exerciseIndex,
                                            setIndex,
                                            'isWarmup',
                                            e.target.value === 'warmup'
                                          )
                                        }
                                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                                      >
                                        <option value="warmup">Warmup</option>
                                        <option value="working">Working</option>
                                      </select>
                                    </div>

                                    {/* Reps */}
                                    <div>
                                      <label className="block text-xs text-gray-600 mb-1">
                                        Wdh.
                                      </label>
                                      <input
                                        type="number"
                                        value={set.targetReps}
                                        onChange={(e) =>
                                          handleSetChange(
                                            exerciseIndex,
                                            setIndex,
                                            'targetReps',
                                            parseInt(e.target.value) || 0
                                          )
                                        }
                                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                                        min="0"
                                      />
                                    </div>

                                    {/* Weight */}
                                    <div>
                                      <label className="block text-xs text-gray-600 mb-1">
                                        Gewicht
                                      </label>
                                      <input
                                        type="number"
                                        value={set.targetWeight}
                                        onChange={(e) =>
                                          handleSetChange(
                                            exerciseIndex,
                                            setIndex,
                                            'targetWeight',
                                            parseFloat(e.target.value) || 0
                                          )
                                        }
                                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                                        min="0"
                                        step="0.5"
                                      />
                                    </div>

                                    {/* RIR */}
                                    <div>
                                      <label className="block text-xs text-gray-600 mb-1">
                                        RIR
                                      </label>
                                      <input
                                        type="number"
                                        value={set.targetRir}
                                        onChange={(e) =>
                                          handleSetChange(
                                            exerciseIndex,
                                            setIndex,
                                            'targetRir',
                                            parseInt(e.target.value) || 0
                                          )
                                        }
                                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                                        min="0"
                                        max="10"
                                      />
                                    </div>

                                    {/* Remove Set Button */}
                                    <div className="flex items-end">
                                      <button
                                        onClick={() =>
                                          handleRemoveSet(exerciseIndex, setIndex)
                                        }
                                        className="text-red-600 hover:text-red-800 transition-colors p-1"
                                        title="Satz entfernen"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? 'Speichert...' : templateId ? 'Änderungen speichern' : 'Erstellen'}
          </button>
        </div>
      </div>
    </div>
  );
}
