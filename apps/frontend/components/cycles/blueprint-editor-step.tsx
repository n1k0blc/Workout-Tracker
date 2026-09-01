import { useState, useEffect, useCallback } from 'react';
import { CycleFormData } from './cycle-wizard';
import { SetType, Exercise } from '@/types';
import ExerciseSelectionModal from '@/components/workout/exercise-selection-modal';
import TemplateSelectionModal from '@/components/workout/template-selection-modal';
import ExerciseCard from '@/components/workout/exercise-card';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { IconPlus } from '@tabler/icons-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { ExerciseLog } from '@/types';
import { replacePlanExerciseInList } from '@/lib/exercise-replace';
import { usePlanExercisePrefill } from '@/lib/plan-exercise-prefill';
import { withArrayPositionOrder } from '@/lib/workout-order';
import { plannedSideFields } from '@/lib/set-sides';
import { addPlannedSet } from '@/lib/planned-sets';
import type { PlannedSet } from '@/types';
import { sortByCycleWeekday } from '@/lib/weekday';
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

interface BlueprintEditorStepProps {
  formData: CycleFormData;
  updateFormData: (data: Partial<CycleFormData>) => void;
  currentDayIndex: number | null;
  setCurrentDayIndex: (index: number | null) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function BlueprintEditorStep({
  formData,
  updateFormData,
  currentDayIndex,
  setCurrentDayIndex,
  onNext,
  onBack,
}: BlueprintEditorStepProps) {
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [showTemplateSelectionModal, setShowTemplateSelectionModal] = useState(false);

  // Local state for current day's exercises, mapped to ExerciseLog shape for the central card
  // (same pattern as template editor: mode=edit, allow* structural true, allowLogging=false)
  const [currentExercises, setCurrentExercises] = useState<ExerciseLog[]>([]);

  // Exercises added this session start expanded (see addExerciseToBlueprint) so the user
  // isn't left guessing they need to review/edit its planned set.
  const [newlyAddedIds, setNewlyAddedIds] = useState<Set<string>>(new Set());

  // Load exercises
  useEffect(() => {
    const loadExercises = async () => {
      try {
        const data = await apiClient.getExercises({});
        setExercises(data);
      } catch (error) {
        console.error('Failed to load exercises:', error);
      }
    };
    loadExercises();
  }, []);



  // Setup sensors for drag and drop
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

  // Helpers to map between cycle blueprint format and the ExerciseLog shape used by central ExerciseCard
  const mapBlueprintToExerciseLogs = useCallback((blueprintExercises: any[]): ExerciseLog[] => { // eslint-disable-line @typescript-eslint/no-explicit-any
    return (blueprintExercises || []).map((ex: any, idx: number) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const exDetails = exercises.find((e) => e.id === ex.exerciseId);
      // A blueprint is a plan: `plannedSets` is the single representation the card edits, and
      // `onUpdatePlannedSet` writes each change straight back -- no fabricated logged twin.
      const plannedSets = (ex.sets || []).map((s: any, sIdx: number) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        const sid = s.id || `set-${ex.exerciseId || idx}-${sIdx}`;
        return {
          id: sid,
          order: s.order || sIdx + 1,
          setType: s.setType || SetType.WORKING,
          reps: s.reps ?? 0,
          weight: s.weight ?? 0,
          rir: s.rir ?? 0,
          repsLeft: s.repsLeft ?? undefined,
          repsRight: s.repsRight ?? undefined,
          weightLeft: s.weightLeft ?? undefined,
          weightRight: s.weightRight ?? undefined,
          rirLeft: s.rirLeft ?? undefined,
          rirRight: s.rirRight ?? undefined,
          rest: s.rest ?? 90,
        };
      });
      return {
        // `idx` is part of the fallback because the same exercise may legitimately appear
        // twice in one day. Keying on exerciseId alone made those two entries share a React
        // key, which React rejects outright ("two children with the same key").
        id: ex.id || `ex-${ex.exerciseId || 'unknown'}-${idx}`,
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName || exDetails?.name || '',
        // The blueprint payload only carries exerciseId, so the loading-scheme flags that drive
        // the "Gewicht (2x)" / "Wdh (2x)" headers have to come from the exercise catalogue.
        isUnilateral: ex.isUnilateral ?? exDetails?.isUnilateral ?? false,
        isDoubleWeight: ex.isDoubleWeight ?? exDetails?.isDoubleWeight ?? false,
        order: ex.order || idx + 1,
        sets: [],
        plannedSets,
      } as ExerciseLog;
    });
  }, [exercises]);

  // Every edit round-trips the local draft through formData and straight back in via the effect
  // below, so any field this mapping drops is destroyed on the next keystroke. `id` and the three
  // display fields are carried through for exactly that reason: `id` keeps React keys stable
  // across the round trip, and the display fields survive for exercises the catalogue can't
  // describe (a custom one created inside the picker). The submit payload in cycle-wizard picks
  // only exerciseId and sets, so none of this reaches the API.
  const mapExerciseLogsToBlueprint = useCallback((exLogs: ExerciseLog[]) => {
    return withArrayPositionOrder(exLogs.map((ex) => ({
      id: ex.id,
      exerciseId: ex.exerciseId,
      exerciseName: ex.exerciseName,
      isUnilateral: ex.isUnilateral,
      isDoubleWeight: ex.isDoubleWeight,
      sets: (ex.plannedSets || []).map((s: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
        setType: s.setType,
        reps: s.reps ?? 0,
        weight: s.weight ?? 0,
        rir: s.rir ?? 0,
        // Per-side targets for unilateral exercises (issue #103); dropped for bilateral sets.
        ...plannedSideFields(s, ex.isUnilateral),
        rest: s.rest ?? 90,
      })),
    })));
  }, []);

  // Sync helper: after local changes to currentExercises, push back to formData
  const syncCurrentExercisesToFormData = (exLogs: ExerciseLog[]) => {
    if (currentDayIndex === null) return;
    const bpExercises = mapExerciseLogsToBlueprint(exLogs);
    const updatedDays = [...formData.workoutDays];
    updatedDays[currentDayIndex] = {
      ...updatedDays[currentDayIndex],
      blueprint: { exercises: bpExercises },
    };
    updateFormData({ workoutDays: updatedDays });
  };

  // Load / sync current day's exercises into local ExerciseLog state when day changes
  // (so we can render the central ExerciseCard with local handlers, like in template editor)
  useEffect(() => {
    if (currentDayIndex !== null) {
      const day = formData.workoutDays[currentDayIndex];
      if (day) {
        const mapped = mapBlueprintToExerciseLogs(day.blueprint.exercises);
        setCurrentExercises(mapped);
      }
    } else {
      setCurrentExercises([]);
    }
  }, [currentDayIndex, formData.workoutDays, exercises, mapBlueprintToExerciseLogs]);

  // Handle drag end for reordering exercises (now on the mapped currentExercises, same as template editor)
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || currentDayIndex === null) {
      return;
    }

    const oldIndex = currentExercises.findIndex((ex) => ex.id === active.id);
    const newIndex = currentExercises.findIndex((ex) => ex.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(currentExercises, oldIndex, newIndex).map((ex, idx) => ({
      ...ex,
      order: idx + 1,
    }));

    setCurrentExercises(reordered);
    syncCurrentExercisesToFormData(reordered);
  };

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) {
      alert('Bitte gib einen Vorlagen-Namen ein');
      return;
    }

    if (currentDayIndex === null || !currentDay) {
      return;
    }

    if (currentDay.blueprint.exercises.length === 0) {
      alert('Füge mindestens eine Übung hinzu');
      return;
    }

    setSavingTemplate(true);
    try {
      // Convert wizard data to template DTO format
      const templateData = {
        name: templateName.trim(),
        recommendedGymId: currentDay.plannedHomeGymId || undefined,
        exercises: withArrayPositionOrder(currentDay.blueprint.exercises.map((ex) => ({
          exerciseId: ex.exerciseId,
          sets: ex.sets.map((set) => ({
            setType: set.setType,
            reps: set.reps,
            weight: set.weight,
            rir: set.rir,
            // Carry per-side targets when saving a unilateral blueprint as a template (issue #103).
            ...plannedSideFields(set, ex.isUnilateral),
            rest: set.rest,
          })),
        }))),
      };

      await apiClient.createWorkoutTemplate(templateData);
      alert('Vorlage erfolgreich erstellt!');
      setShowSaveTemplateModal(false);
      setTemplateName('');
    } catch (error: unknown) {
      console.error('Failed to save template:', error);
      const err = error as { response?: { status?: number } };
      if (err.response?.status === 409) {
        alert('Eine Vorlage mit diesem Namen existiert bereits');
      } else {
        alert('Fehler beim Speichern der Vorlage');
      }
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleLoadTemplate = async (templateId: string) => {
    if (currentDayIndex === null) return;

    try {
      // Load template details
      const template = await apiClient.getWorkoutTemplate(templateId);

      // Check if template has exercises
      if (!template.exercises || template.exercises.length === 0) {
        alert('Diese Vorlage enthält keine Übungen');
        return;
      }

      // Convert template data to wizard format
      // No base conversion: the API serves 1-based ordering, and array position is what
      // decides the sequence anyway (see lib/workout-order.ts). The `+ 1` that used to sit
      // here assumed every template was stored 0-based, which shifted user-created ones to
      // start at 2.
      const wizardExercises = withArrayPositionOrder(template.exercises.map((ex) => ({
        exerciseId: ex.exerciseId,
        sets: ex.sets.map((set) => ({
          setType: set.setType,
          reps: set.reps,
          weight: set.weight,
          rir: set.rir ?? 0,
          // Carry a unilateral template's per-side targets into the blueprint (issue #103).
          ...plannedSideFields(set, ex.isUnilateral),
          rest: set.rest ?? 90,
        })),
      })));

      // Update the current day with template data
      const updatedDays = [...formData.workoutDays];
      updatedDays[currentDayIndex].blueprint.exercises = wizardExercises;
      
      // Also update plannedHomeGymId if template has recommendation
      if (template.recommendedGymId) {
        updatedDays[currentDayIndex].plannedHomeGymId = template.recommendedGymId;
      }

      updateFormData({ workoutDays: updatedDays });
      setShowTemplateSelectionModal(false);
    } catch (error) {
      console.error('Failed to load template:', error);
      alert('Fehler beim Laden der Vorlage');
    }
  };

  useEffect(() => {
    if (currentDayIndex === null && formData.workoutDays.length > 0) {
      setCurrentDayIndex(0);
    }
  }, [currentDayIndex, formData.workoutDays.length, setCurrentDayIndex]);

  const currentDay =
    currentDayIndex !== null ? formData.workoutDays[currentDayIndex] : null;

  const makeSetId = useCallback(
    () => `set-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    [],
  );

  // Fills a swapped / added exercise's planned sets from its last performance (issue #113).
  // The cascade starts from the day's planned gym; every edit still round-trips through
  // `formData`, so the write goes to both `currentExercises` and the wizard form.
  const prefillExercise = usePlanExercisePrefill({
    exercises: currentExercises,
    setsKey: 'plannedSets',
    gymId: currentDay?.plannedHomeGymId || undefined,
    makeSetId,
    onApply: (next) => {
      setCurrentExercises(next);
      syncCurrentExercisesToFormData(next);
    },
  });

  const addExerciseToBlueprint = (exerciseId: string, exercise?: Exercise) => {
    if (currentDayIndex === null) return;

    // If exercise object provided (e.g., newly created custom exercise), add to local list
    if (exercise && !exercises.find(ex => ex.id === exercise.id)) {
      setExercises(prev => [exercise, ...prev]);
    }

    // Create mapped ExerciseLog entry with one default planned set. For a unilateral
    // exercise `addPlannedSet` seeds both sides too, so the save payload is valid even if
    // the user never opens the sides (issue #103).
    const exDetails = exercises.find((e) => e.id === exerciseId) || exercise;
    const isUnilateral = exDetails?.isUnilateral ?? false;

    const newExLog: ExerciseLog = {
      id: `ex-${exerciseId}-${Date.now()}`,
      exerciseId,
      exerciseName: exDetails?.name || '',
      isUnilateral,
      isDoubleWeight: exDetails?.isDoubleWeight ?? false,
      order: currentExercises.length + 1,
      sets: [],
      plannedSets: addPlannedSet([], { isUnilateral }),
    };

    const newList = [...currentExercises, newExLog];
    setCurrentExercises(newList);
    syncCurrentExercisesToFormData(newList);
    setNewlyAddedIds((prev) => new Set(prev).add(newExLog.id));

    setShowExerciseModal(false);
    // Fire-and-forget: an added exercise has no structure, so it takes history's shape wholesale.
    void prefillExercise(newExLog.id, exerciseId, false);
  };



  const getWeekday = (weekday: number): string => {
    const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    return days[weekday];
  };

  const allDaysHaveExercises = formData.workoutDays.every(
    (day) => day.blueprint.exercises.length > 0
  );

  // Tabs read in cycle-week order while `currentDayIndex` keeps indexing into
  // `formData.workoutDays` directly, so each tab carries its original index along.
  const orderedDayTabs = sortByCycleWeekday(
    formData.workoutDays.map((day, index) => ({ ...day, index })),
    formData.startDate,
  );

  return (
    <>
      <div className="space-y-6">
        {/* Day Tabs (sera style) */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              {orderedDayTabs.map((day) => (
                <Button
                  key={day.index}
                  variant={currentDayIndex === day.index ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentDayIndex(day.index)}
                  className="text-sm"
                >
                  {day.name || getWeekday(day.weekday)}
                  {day.blueprint.exercises.length > 0 && (
                    <span className="ml-1.5 text-xs opacity-80">
                      ({day.blueprint.exercises.length})
                    </span>
                  )}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Blueprint Editor */}
        {currentDay && (
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-3">
              Blueprint für {currentDay.name || getWeekday(currentDay.weekday)}
            </h3>

            {currentExercises.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={currentExercises.map((ex) => ex.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-4 mb-4">
                    {currentExercises.map((exercise, idx) => (
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
                        onRemoveExercise={(exId) => {
                          const newList = currentExercises
                            .filter((e) => e.id !== exId)
                            .map((e, i) => ({ ...e, order: i + 1 }));
                          setCurrentExercises(newList);
                          syncCurrentExercisesToFormData(newList);
                        }}
                        onReplaceExercise={(exId, newExId, newEx) => {
                          // Prefer the entry the picker handed over: a custom exercise created
                          // during this very swap is not in `exercises` yet, so the lookup alone
                          // would leave the card with an empty name and no 2x headers.
                          const exDetails = newEx ?? exercises.find((e) => e.id === newExId);
                          if (newEx && !exercises.some((e) => e.id === newEx.id)) {
                            setExercises((prev) => [newEx, ...prev]);
                          }
                          const newList = replacePlanExerciseInList(currentExercises, exId, {
                            ...(exDetails ?? { name: 'Exercise' }),
                            id: newExId,
                          }, 'plannedSets');
                          setCurrentExercises(newList);
                          syncCurrentExercisesToFormData(newList);
                          // The swap has applied from local state; the lookup resolves after
                          // and fills the plan's existing slots from the last performance.
                          void prefillExercise(exId, newExId, true);
                        }}
                        onAddSet={(exId) => {
                          const newList = currentExercises.map((e) => {
                            if (e.id !== exId) return e;
                            return {
                              ...e,
                              plannedSets: addPlannedSet(
                                (e.plannedSets || []) as PlannedSet[],
                                { isUnilateral: e.isUnilateral },
                              ),
                            };
                          });
                          setCurrentExercises(newList);
                          syncCurrentExercisesToFormData(newList);
                        }}
                        onRemoveSet={(exId, setNumber) => {
                          const newList = currentExercises.map((e) => {
                            if (e.id !== exId) return e;
                            return {
                              ...e,
                              plannedSets: (e.plannedSets || [])
                                .filter((p) => p.order !== setNumber)
                                .map((p, i) => ({ ...p, order: i + 1 })),
                            };
                          });
                          setCurrentExercises(newList);
                          syncCurrentExercisesToFormData(newList);
                        }}
                        onUpdatePlannedSet={(exId, setNumber, data) => {
                          const newList = currentExercises.map((e) => {
                            if (e.id !== exId) return e;
                            return {
                              ...e,
                              plannedSets: (e.plannedSets || []).map((p) =>
                                p.order === setNumber ? { ...p, ...data } : p,
                              ),
                            };
                          });
                          setCurrentExercises(newList);
                          syncCurrentExercisesToFormData(newList);
                        }}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground mb-4">
                    Noch keine Übungen hinzugefügt
                  </p>
                  {/* Large centered + as primary CTA (consistent with active workout) */}
                  <Button
                    variant="outline"
                    onClick={() => setShowExerciseModal(true)}
                    className="h-16 w-16 rounded-lg p-0"
                    aria-label="Erste Übung hinzufügen"
                  >
                    <IconPlus className="size-8" />
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Add Exercise Button (large + when list not empty, consistent style) */}
            {currentExercises.length > 0 && (
              <div className="flex justify-center py-2">
                <Button
                  variant="outline"
                  onClick={() => setShowExerciseModal(true)}
                  className="h-14 w-14 rounded-lg p-0"
                  aria-label="Übung hinzufügen"
                >
                  <IconPlus className="size-7" />
                </Button>
              </div>
            )}

            {/* Load from Template Button (kept for functionality, styled sera) */}
            <div className="mt-2">
              <Button
                variant="outline"
                onClick={() => setShowTemplateSelectionModal(true)}
                disabled={currentDay.blueprint.exercises.length > 0}
                className="w-full"
              >
                Aus Vorlage laden
              </Button>
            </div>

            {/* Save as Template Button */}
            {currentDay.blueprint.exercises.length > 0 && (
              <Button
                variant="outline"
                onClick={() => setShowSaveTemplateModal(true)}
                className="w-full mt-2"
              >
                Als Vorlage speichern
              </Button>
            )}
          </div>
        )}

        {/* Navigation (consistent with other steps) */}
        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="flex-1"
          >
            Zurück
          </Button>
          <Button
            type="button"
            onClick={onNext}
            disabled={!allDaysHaveExercises}
            className="flex-1"
          >
            Weiter zur Überprüfung
          </Button>
        </div>
      </div>

      {/* Exercise Selection Modal (shadcn Dialog, controlled) */}
      <ExerciseSelectionModal
        open={showExerciseModal}
        onOpenChange={setShowExerciseModal}
        onSelect={addExerciseToBlueprint}
      />

      {/* Save Template Modal (shadcn Dialog) */}
      <Dialog
        open={showSaveTemplateModal}
        onOpenChange={(open) => {
          setShowSaveTemplateModal(open);
          if (!open) {
            setTemplateName('');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Blueprint als Vorlage speichern</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Gib einen Namen für deine Workout-Vorlage ein. Diese Vorlage kannst du
              später wiederverwenden oder direkt als Workout starten.
            </p>
            <Input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="z.B. Mein Push Day"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !savingTemplate) {
                  handleSaveAsTemplate();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowSaveTemplateModal(false);
                setTemplateName('');
              }}
              disabled={savingTemplate}
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleSaveAsTemplate}
              disabled={savingTemplate || !templateName.trim()}
            >
              {savingTemplate ? 'Speichert...' : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Selection Modal */}
      {showTemplateSelectionModal && (
        <TemplateSelectionModal
          onSelect={(templateId) => handleLoadTemplate(templateId)}
          onClose={() => setShowTemplateSelectionModal(false)}
        />
      )}
    </>
  );
}
