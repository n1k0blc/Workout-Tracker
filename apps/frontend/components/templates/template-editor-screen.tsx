'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { Exercise, HomeGym, WorkoutTemplate, SetType } from '@/types';
import { Plus, Trash2 } from 'lucide-react';
import ExerciseSelectionModal from '@/components/workout/exercise-selection-modal';
import { TemplateExerciseCard } from './template-exercise-card';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

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
  const [replacingExerciseId, setReplacingExerciseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!templateId);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
          // Fix 0-based orders from old templates (ensure 1-based)
          const fixedExercises = template.exercises.map((ex, idx) => ({
            ...ex,
            order: ex.order === 0 ? idx + 1 : ex.order,
            sets: ex.sets.map((set, setIdx) => ({
              ...set,
              order: set.order === 0 ? setIdx + 1 : set.order,
            })),
          }));
          
          setExercises(
            fixedExercises.map((ex) => ({
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

  const handleAddExercise = async (exerciseId: string, exercise?: Exercise) => {
    // Check if this is a replace operation
    if (replacingExerciseId) {
      handleReplaceExercise(exerciseId, exercise);
      return;
    }

    // Use provided exercise or find in available exercises
    let selectedExercise = exercise;
    if (!selectedExercise) {
      selectedExercise = availableExercises.find((ex) => ex.id === exerciseId);
    }
    
    if (!selectedExercise) {
      alert('Übung nicht gefunden.');
      return;
    }

    // If this is a newly created exercise, add it to availableExercises
    if (exercise && !availableExercises.find((ex) => ex.id === exercise.id)) {
      setAvailableExercises((prev) => [exercise, ...prev]);
    }

    const newOrder = exercises.length + 1;

    setExercises([
      ...exercises,
      {
        id: `ex-${Date.now()}`,
        exerciseId: selectedExercise.id,
        exerciseName: selectedExercise.name,
        order: newOrder,
        sets: [],
      },
    ]);
    setShowExerciseModal(false);
  };

  const handleReplaceExercise = (newExerciseId: string, newExercise?: Exercise) => {
    if (!replacingExerciseId) return;

    // Use provided exercise or find in available exercises
    let selectedExercise = newExercise;
    if (!selectedExercise) {
      selectedExercise = availableExercises.find((ex) => ex.id === newExerciseId);
    }
    
    if (!selectedExercise) {
      alert('Übung nicht gefunden.');
      return;
    }

    // If this is a newly created exercise, add it to availableExercises
    if (newExercise && !availableExercises.find((ex) => ex.id === newExercise.id)) {
      setAvailableExercises((prev) => [newExercise, ...prev]);
    }

    setExercises(
      exercises.map((ex) =>
        ex.id === replacingExerciseId
          ? {
              ...ex,
              exerciseId: selectedExercise.id,
              exerciseName: selectedExercise.name,
            }
          : ex
      )
    );
    setShowExerciseModal(false);
    setReplacingExerciseId(null);
  };

  const handleOpenReplaceModal = (exerciseId: string) => {
    setReplacingExerciseId(exerciseId);
    setShowExerciseModal(true);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setExercises((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        const reordered = arrayMove(items, oldIndex, newIndex);
        // Update order property
        return reordered.map((ex, idx) => ({ ...ex, order: idx }));
      });
    }
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
          const newSetOrder = ex.sets.length + 1;
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

  const getExerciseDetails = (exerciseId: string): Exercise | undefined => {
    return availableExercises.find((ex) => ex.id === exerciseId);
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
          {exercises.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={exercises.map((ex) => ex.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-4">
                  {exercises.map((exercise, index) => (
                    <TemplateExerciseCard
                      key={exercise.id}
                      exercise={exercise}
                      exerciseDetails={getExerciseDetails(exercise.exerciseId)}
                      index={index}
                      onRemove={() => handleRemoveExercise(exercise.id)}
                      onReplace={() => handleOpenReplaceModal(exercise.id)}
                      onAddSet={() => handleAddSet(exercise.id)}
                      onRemoveSet={(setId) => handleRemoveSet(exercise.id, setId)}
                      onUpdateSet={(setId, field, value) =>
                        handleUpdateSet(exercise.id, setId, field, value)
                      }
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : null}

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
          onClose={() => {
            setShowExerciseModal(false);
            setReplacingExerciseId(null);
          }}
        />
      )}
    </div>
  );
}
