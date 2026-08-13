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
import { IconChevronLeft, IconPlus } from '@tabler/icons-react';
import { replaceExerciseInList } from '@/lib/exercise-replace';
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

  const [isReadonlyView, setIsReadonlyView] = useState(false);

  // Exercises added this session start expanded (see handleAddExercise) so the user
  // isn't left guessing they need to add sets.
  const [newlyAddedIds, setNewlyAddedIds] = useState<Set<string>>(new Set());

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
    setNewlyAddedIds((prev) => new Set(prev).add(newEx.id));
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
        setIsReadonlyView(!template.isCustom);

        // Build local exercises in ExerciseLog shape for the central card (no synthetic/hijack)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fixed = (template.exercises || []).map((ex: any, idx: number) => ({
          id: ex.id || `ex-${Date.now()}-${idx}`,
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName || '',
          // Templates saved before the flags were persisted fall back to the exercise catalogue,
          // which is what the "Gewicht (2x)" / "Wdh (2x)" headers read from.
          isUnilateral: ex.isUnilateral ?? exs.find((e) => e.id === ex.exerciseId)?.isUnilateral ?? false,
          isDoubleWeight: ex.isDoubleWeight ?? exs.find((e) => e.id === ex.exerciseId)?.isDoubleWeight ?? false,
          // Stored order is 1-based and contiguous (migration 20260814080000); it is used as
          // read. The previous `order === 0 ? index + 1` fixup for 0-based rows mapped the
          // first two sets of an exercise onto the same number, which is what made the
          // collapsed card drop a bar and the expanded card mislabel a set's type.
          order: ex.order,
          sets: (ex.sets || []).map((s: any, sIdx: number) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
            id: s.id || `set-${Date.now()}-${sIdx}`,
            setNumber: s.order,
            setType: s.setType ?? SetType.WORKING,
            reps: s.reps ?? 0,
            weight: s.weight ?? 0,
            rir: s.rir ?? 0,
            completedAt: new Date().toISOString(),
          })),
          plannedSets: (ex.sets || []).map((s: any, sIdx: number) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
            id: s.id || `planned-${Date.now()}-${sIdx}`,
            order: s.order,
            setType: s.setType ?? SetType.WORKING,
            reps: s.reps ?? 0,
            weight: s.weight ?? 0,
            rir: s.rir ?? 0,
            rest: s.rest ?? 90,
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
      // `order` comes from array position, not `ex.order`: removals leave gaps that
      // `handleAddExercise` (length + 1) can collide with, and the backend sorts on `order`
      // with no tiebreaker -- so the rendered sequence has to be what gets persisted.
      const payloadExercises = exercises.map((ex, idx) => ({
        exerciseId: ex.exerciseId,
        order: idx + 1,
        sets: (ex.sets || []).map((s: any, idx: number) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
          order: s.setNumber || s.order || idx + 1,
          setType: s.setType ?? SetType.WORKING,
          reps: s.reps ?? 0,
          weight: s.weight ?? 0,
          rir: s.rir ?? 0,
          rest: s.rest ?? 90,
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
                  {isReadonlyView ? (
                    <div className="px-3 py-2 text-sm font-medium border border-input bg-muted/30 rounded-md">
                      {name || '—'}
                    </div>
                  ) : (
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="z.B. Upper Body, Push Day, etc."
                      className="w-full"
                    />
                  )}
                </Field>

                {!isReadonlyView && (
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
                )}
              </CardContent>
            </Card>

            {/* Exercises – using the central ExerciseCard.
                For readonly (system templates): pure view, no Dnd, no actions, inputs disabled.
                For edit (custom): full structure with handlers, no logging. */}
            {exercises.length > 0 ? (
              isReadonlyView ? (
                <div className="space-y-4">
                  {exercises.map((exercise, idx) => (
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
                          defaultOpen={newlyAddedIds.has(exercise.id)}
                          onRemoveExercise={(id) => setExercises(prev => prev.filter(e => e.id !== id))}
                          onReplaceExercise={(id, newId) => {
                            const exDetails = availableExercises.find((e) => e.id === newId);
                            setExercises(prev => replaceExerciseInList(prev, id, {
                              ...(exDetails ?? { name: 'Exercise' }),
                              id: newId,
                            }));
                          }}
                          onAddSet={(id) => {
                            setExercises(prev => prev.map(e => {
                              if (e.id !== id) return e;
                              const setNumbers = (e.sets || []).map((s: any) => s.setNumber || s.order || 0); // eslint-disable-line @typescript-eslint/no-explicit-any
                              const plannedOrders = (e.plannedSets || []).map((p: any) => p.order || p.setNumber || 0); // eslint-disable-line @typescript-eslint/no-explicit-any
                              const nextOrder = Math.max(0, ...setNumbers, ...plannedOrders) + 1;
                              const newSet = {
                                id: `set-${Date.now()}`,
                                setNumber: nextOrder,
                                setType: SetType.WORKING,
                                reps: 10,
                                weight: 0,
                                rir: 2,
                                completedAt: new Date().toISOString(),
                              };
                              const newPlanned = {
                                id: `planned-${Date.now()}`,
                                order: nextOrder,
                                setType: SetType.WORKING,
                                reps: 10,
                                weight: 0,
                                rir: 2,
                                rest: 90,
                              };
                              return {
                                ...e,
                                sets: [...(e.sets || []), newSet],
                                plannedSets: [...(e.plannedSets || []), newPlanned],
                              };
                            }));
                          }}
                          onRemoveSet={(id, setNumber) => {
                            setExercises(prev => prev.map(e => {
                              if (e.id !== id) return e;
                              return {
                                ...e,
                                sets: (e.sets || []).filter(s => (s.setNumber ?? 0) !== setNumber),
                                plannedSets: (e.plannedSets || []).filter(p => p.order !== setNumber),
                              };
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
              )
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

            {/* Save / Cancel Actions (only for editable custom templates) */}
            {!isReadonlyView && (
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
                  disabled={saving || exercises.length === 0}
                  className="flex-1"
                >
                  {saving ? 'Speichert...' : 'Speichern'}
                </Button>
              </div>
            )}

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
