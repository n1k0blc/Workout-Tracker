'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { Exercise, HomeGym, ExerciseLog, SetType } from '@/types';
import { ProtectedRoute } from '@/components/protected-route';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Field, FieldLabel } from '@/components/ui/field';
import ExerciseCard from '@/components/workout/exercise-card';
import ExerciseSelectionModal from '@/components/workout/exercise-selection-modal';
import { useWorkout } from '@/lib/workout-context';
import { IconChevronLeft, IconPlus } from '@tabler/icons-react';
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
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

interface TemplateEditorScreenProps {
  templateId?: string;
}

export default function TemplateEditorScreen({ templateId }: TemplateEditorScreenProps) {
  const router = useRouter();
  const { activeWorkout } = useWorkout();

  const [name, setName] = useState('');
  const [recommendedGymId, setRecommendedGymId] = useState<string>('');
  const [availableGyms, setAvailableGyms] = useState<HomeGym[]>([]);
  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(!!templateId);
  const [saving, setSaving] = useState(false);
  const [showExerciseModal, setShowExerciseModal] = useState(false);

  // Local exercises state (ExerciseLog shape for compatibility with central ExerciseCard).
  // This removes the need for context hijack / synthetic workout for templates.
  const [exercises, setExercises] = useState<ExerciseLog[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 300,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = exercises.findIndex((ex) => ex.id === active.id);
    const newIndex = exercises.findIndex((ex) => ex.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newList = [...exercises];
    const [moved] = newList.splice(oldIndex, 1);
    newList.splice(newIndex, 0, moved);

    setExercises(newList.map((ex, i) => ({ ...ex, order: i + 1 })));
  };

  const handleAddExercise = (exerciseId: string) => {
    const exDetails = availableExercises.find((e) => e.id === exerciseId);
    if (!exDetails) return;

    const newEx: ExerciseLog = {
      id: `ex-${Date.now()}`,
      exerciseId,
      exerciseName: exDetails.name,
      order: exercises.length + 1,
      sets: [],
      plannedSets: [],
      isUnilateral: exDetails.isUnilateral,
      isDoubleWeight: exDetails.isDoubleWeight,
    };
    setExercises(prev => [...prev, newEx]);
    setShowExerciseModal(false);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [gyms, exs] = await Promise.all([
        apiClient.getHomeGyms(),
        apiClient.getExercises(),
      ]);
      setAvailableGyms(gyms);
      setAvailableExercises(exs);

      if (templateId) {
        const template = await apiClient.getWorkoutTemplate(templateId);
        setName(template.name);
        setRecommendedGymId(template.recommendedGymId || '');

        // Build local exercises in ExerciseLog shape for the central card (no synthetic/hijack)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fixed = (template.exercises || []).map((ex: any, idx: number) => ({
          id: ex.id || `ex-${Date.now()}-${idx}`,
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName || '',
          order: ex.order === 0 ? idx + 1 : ex.order,
          sets: (ex.sets || []).map((s: any, sIdx: number) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
            id: s.id || `set-${Date.now()}-${sIdx}`,
            setNumber: s.order === 0 ? sIdx + 1 : s.order,
            setType: s.isWarmup ? SetType.WARMUP : SetType.WORKING,
            reps: s.targetReps ?? 0,
            weight: s.targetWeight ?? 0,
            rir: s.targetRir ?? 0,
            completedAt: new Date().toISOString(),
          })),
          plannedSets: (ex.sets || []).map((s: any, sIdx: number) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
            id: s.id || `planned-${Date.now()}-${sIdx}`,
            order: s.order === 0 ? sIdx + 1 : s.order,
            setType: s.isWarmup ? SetType.WARMUP : SetType.WORKING,
            reps: s.targetReps ?? 0,
            weight: s.targetWeight ?? 0,
            rir: s.targetRir ?? 0,
            restAfterSet: 0,
          })),
        }));
        setExercises(fixed as ExerciseLog[]);
      } else {
        setName('');
        setRecommendedGymId('');
        setExercises([]);
      }
    } catch (error) {
      console.error('Failed to load data for template editor:', error);
      alert('Fehler beim Laden der Daten.');
      router.push('/templates');
    } finally {
      setLoading(false);
    }
  }, [templateId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // No more local exercise list handlers – the shared ActiveWorkoutScreen (edit mode)
  // + WorkoutContext (with COMPLETED local-mutation short-circuit) own the full
  // add/remove/replace/reorder/add-set/edit-set surface.

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Bitte gib einen Namen für die Vorlage ein.');
      return;
    }

    if (exercises.length === 0) {
      alert('Bitte füge mindestens eine Übung hinzu.');
      return;
    }

    // Validate every exercise has at least one set (template requirement).
    const hasEmpty = exercises.some((ex) => (ex.sets?.length || 0) === 0);
    if (hasEmpty) {
      alert('Jede Übung muss mindestens einen Satz haben.');
      return;
    }

    setSaving(true);
    try {
      const payloadExercises = exercises.map((ex) => ({
        exerciseId: ex.exerciseId,
        order: ex.order,
        sets: (ex.sets || []).map((s: any, idx: number) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
          order: s.setNumber || s.order || idx + 1,
          isWarmup: s.setType === SetType.WARMUP || s.isWarmup === true,
          targetReps: s.reps ?? 0,
          targetWeight: s.weight ?? 0,
          targetRir: s.rir ?? 0,
        })),
      }));

      const payload = {
        name: name.trim(),
        recommendedGymId: recommendedGymId || undefined,
        exercises: payloadExercises,
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
      <ProtectedRoute>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-lg text-muted-foreground">Lädt Vorlage...</div>
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
              onClick={() => router.push('/templates')}
              className="flex items-center gap-2 -ml-2"
            >
              <IconChevronLeft className="size-4" />
              Zurück zu den Vorlagen
            </Button>

            {/* Header */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">
                      {templateId ? 'Vorlage bearbeiten' : 'Neue Vorlage erstellen'}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Definiere Übungen und Sätze für diese Workout-Vorlage
                    </p>
                  </div>
                  <Badge variant="outline">{templateId ? 'Bearbeitung' : 'Neu'}</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Template Metadata (Name + Recommended Gym) */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <Field>
                  <FieldLabel>Vorlagenname</FieldLabel>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="z.B. Upper Body, Push Day, etc."
                    className="w-full"
                  />
                </Field>

                <Field>
                  <FieldLabel>Empfohlenes Studio (Optional)</FieldLabel>
                  <select
                    value={recommendedGymId}
                    onChange={(e) => setRecommendedGymId(e.target.value)}
                    className="w-full md:w-auto px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                  >
                    <option value="">Kein empfohlenes Studio</option>
                    {availableGyms.map((gym) => (
                      <option key={gym.id} value={gym.id}>
                        {gym.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </CardContent>
            </Card>

            {/* Exercises – using the central ExerciseCard (with blueprint-edit flags).
                Full structural editing allowed (reorder, replace, delete exercise, add/remove sets),
                but no logging (no check column). Own DndContext because reorder is enabled. */}
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
                    {exercises.map((exercise, idx) => (
                      <ExerciseCard
                        key={exercise.id}
                        exercise={exercise}
                        exerciseNumber={idx + 1}
                        mode="edit"
                        allowReorder={true}
                        allowExerciseActions={true}
                        allowSetManagement={true}
                        allowLogging={false}
                        onRemoveExercise={(id) => setExercises(prev => prev.filter(e => e.id !== id))}
                        onReplaceExercise={(id, newId) => {
                          const exDetails = availableExercises.find((e) => e.id === newId);
                          setExercises(prev => prev.map(e => e.id === id 
                            ? { ...e, exerciseId: newId, exerciseName: exDetails?.name || 'Exercise' } 
                            : e
                          ));
                        }}
                        onAddSet={(id) => {
                          setExercises(prev => prev.map(e => {
                            if (e.id !== id) return e;
                            const nextOrder = (e.sets?.length || 0) + 1;
                            const newSet = {
                              id: `set-${Date.now()}`,
                              setNumber: nextOrder,
                              setType: SetType.WORKING,
                              reps: 10,
                              weight: 0,
                              rir: 2,
                              completedAt: new Date().toISOString(),
                            };
                            return { ...e, sets: [...(e.sets || []), newSet] };
                          }));
                        }}
                        onRemoveSet={(id, setId) => {
                          setExercises(prev => prev.map(e => {
                            if (e.id !== id) return e;
                            return { ...e, sets: (e.sets || []).filter(s => s.id !== setId) };
                          }));
                        }}
                        onUpdateSet={(id, setId, data) => {
                          setExercises(prev => prev.map(e => {
                            if (e.id !== id) return e;
                            return {
                              ...e,
                              sets: (e.sets || []).map(s => s.id === setId ? { ...s, ...data } : s),
                            };
                          }));
                        }}
                      />
                    ))}
                  </div>

                  {/* Add exercise button below list */}
                  <div className="flex justify-center py-3">
                    <Button
                      variant="outline"
                      onClick={() => setShowExerciseModal(true)}
                      className="h-14 w-14 rounded-lg p-0 flex items-center justify-center"
                      aria-label="Übung hinzufügen"
                    >
                      <IconPlus className="size-7" />
                    </Button>
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <Card>
                <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
                  <p className="text-muted-foreground">
                    Noch keine Übungen hinzugefügt
                  </p>
                  {/* Large centered square + icon */}
                  <Button
                    variant="outline"
                    onClick={() => setShowExerciseModal(true)}
                    className="h-16 w-16 rounded-lg p-0 flex items-center justify-center"
                    aria-label="Erste Übung hinzufügen"
                  >
                    <IconPlus className="size-8" />
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Save / Cancel Actions (own buttons like in history edit) */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => router.push('/templates')}
                disabled={saving}
                className="flex-1"
              >
                Abbrechen
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !activeWorkout}
                className="flex-1"
              >
                {saving ? 'Speichert...' : 'Speichern'}
              </Button>
            </div>

            {/* Exercise Selection Modal for adding exercises */}
            <ExerciseSelectionModal
              open={showExerciseModal}
              onOpenChange={setShowExerciseModal}
              onSelect={handleAddExercise}
            />
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
