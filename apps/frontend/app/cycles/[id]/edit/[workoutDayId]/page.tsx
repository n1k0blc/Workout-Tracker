'use client';

import { ProtectedRoute } from '@/components/protected-route';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { WorkoutCycle, Exercise, WorkoutExercise, SetType } from '@/types';
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
import ExerciseCard from '@/components/workout/exercise-card';
import ExerciseSelectionModal from '@/components/workout/exercise-selection-modal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { IconPlus } from '@tabler/icons-react';
import type { ExerciseLog, WorkoutDay } from '@/types';
import { replacePlanExerciseInList } from '@/lib/exercise-replace';
import { usePlanExercisePrefill } from '@/lib/plan-exercise-prefill';
import { withArrayPositionOrder } from '@/lib/workout-order';
import { plannedSideFields } from '@/lib/set-sides';
import { addPlannedSet } from '@/lib/planned-sets';
import type { PlannedSet } from '@/types';
import { WEEKDAY_NAMES } from '@/lib/weekday';

export default function EditBlueprintPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const cycleId = params.id as string;
  const workoutDayId = params.workoutDayId as string;

  const [cycle, setCycle] = useState<WorkoutCycle | null>(null);
  const [workoutDayName, setWorkoutDayName] = useState<string>('');
  const [plannedWeekday, setPlannedWeekday] = useState<number>(1);
  const [plannedHomeGymId, setPlannedHomeGymId] = useState<string>('');
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  // Exercises added this session start expanded (see handleAddExercise) so the user
  // isn't left guessing they need to review/edit its planned sets.
  const [newlyAddedIds, setNewlyAddedIds] = useState<Set<string>>(new Set());
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  // The day currently holding `plannedWeekday`, when it isn't this day -- set right before
  // asking the user to confirm a swap, so the dialog can name it.
  const [swapConflict, setSwapConflict] = useState<WorkoutDay | null>(null);

  const makeSetId = useCallback(
    () => `set-new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    [],
  );

  // Fills a swapped / added exercise's planned sets from its last performance (issue #113).
  // The cascade starts from the day's planned gym.
  const prefillExercise = usePlanExercisePrefill({
    exercises,
    setsKey: 'sets',
    gymId: plannedHomeGymId || undefined,
    makeSetId,
    onApply: setExercises,
  });

  // DnD Kit sensors (long-press on title, same as template editor and active workout)
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

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleId, workoutDayId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const cycleData = await apiClient.getCycle(cycleId);

      setCycle(cycleData);

      // Find the specific workout day
      const workoutDay = cycleData.workoutDays.find((d) => d.id === workoutDayId);
      if (!workoutDay) {
        throw new Error('Workout day not found');
      }

      setWorkoutDayName(workoutDay.name);
      setPlannedWeekday(workoutDay.weekday);
      setPlannedHomeGymId(workoutDay.plannedHomeGymId || (user?.homeGyms && user.homeGyms.length > 0 ? user.homeGyms[0].id : ''));

      if (workoutDay.blueprint) {
        setExercises(workoutDay.blueprint.exercises);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      alert('Fehler beim Laden der Daten');
      router.push('/cycles');
    } finally {
      setLoading(false);
    }
  };

  const handleAddExercise = (exerciseId: string, exercise?: Exercise) => {
    if (!exercise) return;

    const baseSets = [
      { id: `set-new-${Date.now()}`, order: 1, setType: SetType.WARMUP, reps: 10, weight: 20, rir: 3, rest: 90 },
      { id: `set-new-${Date.now()}-1`, order: 2, setType: SetType.WORKING, reps: 10, weight: 40, rir: 2, rest: 90 },
      { id: `set-new-${Date.now()}-2`, order: 3, setType: SetType.WORKING, reps: 10, weight: 40, rir: 2, rest: 90 },
    ];

    const newExercise: WorkoutExercise = {
      id: `new-${Date.now()}`, // Temporary ID
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      isUnilateral: exercise.isUnilateral,
      isDoubleWeight: exercise.isDoubleWeight,
      order: exercises.length + 1,
      // A unilateral exercise's planned sets carry both sides from the start (seeded
      // symmetrically), so the save payload is a valid unilateral tree even if the user
      // never opens the sides (issue #103).
      sets: exercise.isUnilateral
        ? baseSets.map((s) => ({
            ...s,
            repsLeft: s.reps,
            repsRight: s.reps,
            weightLeft: s.weight,
            weightRight: s.weight,
            rirLeft: s.rir,
            rirRight: s.rir,
          }))
        : baseSets,
    };
    setExercises([...exercises, newExercise]);
    setNewlyAddedIds((prev) => new Set(prev).add(newExercise.id));
    setShowExerciseModal(false);
    // Fire-and-forget: an added exercise has no structure, so it takes history's shape wholesale.
    void prefillExercise(newExercise.id, exercise.id, false);
  };

  // Passed directly as ExerciseCard's onReplaceExercise: the card owns its own replace
  // picker modal internally, so this just needs to perform the swap with the picked
  // exercise's id -- no second, page-level modal involved.
  const handleReplaceExercise = async (exerciseLogId: string, newExerciseId: string) => {
    try {
      const newExercise = await apiClient.getExercise(newExerciseId);
      setExercises((prev) => replacePlanExerciseInList(prev, exerciseLogId, newExercise, 'sets'));
      // The swap has applied from local state; the lookup resolves after and fills the plan's
      // existing slots from the last performance (issue #113).
      void prefillExercise(exerciseLogId, newExerciseId, true);
    } catch (error) {
      console.error('Failed to replace exercise:', error);
    }
  };

  const handleRemoveExercise = (exerciseId: string) => {
    const updatedExercises = exercises
      .filter((ex) => ex.id !== exerciseId)
      .map((ex, idx) => ({ ...ex, order: idx + 1 }));
    setExercises(updatedExercises);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setExercises((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        const reordered = arrayMove(items, oldIndex, newIndex);
        return reordered.map((ex, idx) => ({ ...ex, order: idx + 1 }));
      });
    }
  };

  const handleSave = async () => {
    if (!workoutDayName.trim()) {
      alert('Bitte gib einen Workout-Namen ein');
      return;
    }

    // Every weekday in the cycle is unique to one day (#71), so a match here can only be
    // another day -- this one already owns `plannedWeekday` if it's unchanged. Ask before
    // exchanging weekdays rather than letting the save hit the API's 400.
    const conflict = cycle?.workoutDays.find(
      (day) => day.weekday === plannedWeekday && day.id !== workoutDayId
    );
    if (conflict) {
      setSwapConflict(conflict);
      return;
    }

    await saveWorkoutDay();
  };

  const saveWorkoutDay = async (swapWithWorkoutDayId?: string) => {
    setSaving(true);
    try {
      // First update the workout day name and weekday
      await apiClient.updateWorkoutDay(cycleId, workoutDayId, {
        name: workoutDayName.trim(),
        weekday: plannedWeekday,
        plannedHomeGymId: plannedHomeGymId || undefined,
        swapWithWorkoutDayId,
      });

      // Transform exercises to match API format
      const blueprintData = {
        exercises: withArrayPositionOrder(exercises.map((ex) => ({
          exerciseId: ex.exerciseId,
          sets: ex.sets.map((set) => ({
            setType: set.setType,
            reps: set.reps,
            weight: set.weight,
            rir: set.rir,
            ...plannedSideFields(set, ex.isUnilateral),
            rest: set.rest,
          })),
        }))),
      };

      await apiClient.updateBlueprint(cycleId, workoutDayId, blueprintData);
      router.push('/cycles');
    } catch (error) {
      console.error('Failed to save blueprint:', error);
      alert('Fehler beim Speichern des Blueprints');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmSwap = () => {
    const conflict = swapConflict;
    setSwapConflict(null);
    if (conflict) {
      saveWorkoutDay(conflict.id);
    }
  };

  const handleCancel = () => {
    router.push('/cycles');
  };

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) {
      alert('Bitte gib einen Vorlagen-Namen ein');
      return;
    }

    if (exercises.length === 0) {
      alert('Füge mindestens eine Übung hinzu');
      return;
    }

    setSavingTemplate(true);
    try {
      // Convert frontend data to DTO format
      const templateData = {
        name: templateName.trim(),
        recommendedGymId: plannedHomeGymId || undefined,
        exercises: withArrayPositionOrder(exercises.map((ex) => ({
          exerciseId: ex.exerciseId,
          sets: ex.sets.map((set) => ({
            setType: set.setType,
            reps: set.reps,
            weight: set.weight,
            rir: set.rir,
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

  const openAddModal = () => {
    setShowExerciseModal(true);
  };

  // A blueprint is a plan: `plannedSets` is the single representation the card edits, and
  // `onUpdatePlannedSet` writes each change straight back to `exercises` (no fabricated
  // logged twin). Unilateral exercises get the two-sub-row per-side layout (issue #103).
  const exerciseLogs: ExerciseLog[] = exercises.map((ex) => {
    const plannedSets = ex.sets.map((s) => ({
      id: s.id,
      order: s.order,
      setType: s.setType,
      reps: s.reps,
      weight: s.weight,
      rir: s.rir ?? 0,
      repsLeft: s.repsLeft ?? undefined,
      repsRight: s.repsRight ?? undefined,
      weightLeft: s.weightLeft ?? undefined,
      weightRight: s.weightRight ?? undefined,
      rirLeft: s.rirLeft ?? undefined,
      rirRight: s.rirRight ?? undefined,
      rest: s.rest ?? 90,
    }));
    return {
      id: ex.id,
      exerciseId: ex.exerciseId,
      exerciseName: ex.exerciseName,
      isUnilateral: ex.isUnilateral,
      isDoubleWeight: ex.isDoubleWeight,
      order: ex.order,
      sets: [],
      plannedSets,
    } as ExerciseLog;
  });

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-lg text-muted-foreground">Lädt Blueprint...</div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            {/* Header */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground">
                Blueprint bearbeiten
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {cycle?.name}
              </p>
            </div>

            {/* Workout Day Settings */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <h3 className="text-lg font-medium text-foreground mb-4">
                  Workout-Einstellungen
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="block text-sm font-medium text-foreground mb-2">
                    Workout-Name
                  </Label>
                  <Input
                    type="text"
                    value={workoutDayName}
                    onChange={(e) => setWorkoutDayName(e.target.value)}
                    className="w-full"
                    placeholder="z.B. Push Day, Pull Day, Legs"
                  />
                </div>
                <div>
                  <Label className="block text-sm font-medium text-foreground mb-2">
                    Geplanter Wochentag
                  </Label>
                  <select
                    value={plannedWeekday}
                    onChange={(e) => setPlannedWeekday(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value={1}>Montag</option>
                    <option value={2}>Dienstag</option>
                    <option value={3}>Mittwoch</option>
                    <option value={4}>Donnerstag</option>
                    <option value={5}>Freitag</option>
                    <option value={6}>Samstag</option>
                    <option value={0}>Sonntag</option>
                  </select>
                </div>
                <div>
                  <Label className="block text-sm font-medium text-foreground mb-2">
                    Geplantes Gym
                  </Label>
                  <select
                    value={plannedHomeGymId}
                    onChange={(e) => setPlannedHomeGymId(e.target.value)}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {user?.homeGyms && user.homeGyms.length > 0 ? (
                      [...user.homeGyms]
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((gym) => (
                          <option key={gym.id} value={gym.id}>
                            {gym.name}
                          </option>
                        ))
                    ) : (
                      <option value="">Keine Gyms verfügbar</option>
                    )}
                  </select>
                </div>
              </div>
              </CardContent>
            </Card>

            {/* Exercise List Header */}
            <div className="mb-4">
              <h3 className="text-lg font-medium text-foreground">
                Übungen
              </h3>
            </div>

            {/* Exercise List / Empty State (matching wizard step 3 + central card) */}
            {exercises.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground mb-4">
                    Noch keine Übungen hinzugefügt
                  </p>
                  {/* Large centered + as primary CTA (consistent with active workout + wizard step 3) */}
                  <Button
                    variant="outline"
                    onClick={openAddModal}
                    className="h-16 w-16 rounded-lg p-0"
                    aria-label="Erste Übung hinzufügen"
                  >
                    <IconPlus className="size-8" />
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={exercises.map((ex) => ex.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-4 mb-4">
                      {exerciseLogs.map((log, index) => (
                        <ExerciseCard
                          key={log.id}
                          exercise={log}
                          exerciseNumber={index + 1}
                          mode="edit"
                          allowReorder={true}
                          allowExerciseActions={true}
                          allowSetManagement={true}
                          allowLogging={false}
                          defaultOpen={newlyAddedIds.has(log.id)}
                          onRemoveExercise={() => handleRemoveExercise(log.id)}
                          onReplaceExercise={handleReplaceExercise}
                          onAddSet={() => {
                            const updated = exercises.map((ex) => {
                              if (ex.id !== log.id) return ex;
                              // `addPlannedSet` seeds the new set from the previous one -- and
                              // both sides of it for a unilateral exercise (issue #103).
                              const seeded = addPlannedSet(ex.sets as unknown as PlannedSet[], {
                                isUnilateral: ex.isUnilateral,
                              });
                              return { ...ex, sets: seeded as unknown as typeof ex.sets };
                            });
                            setExercises(updated);
                          }}
                          onRemoveSet={(exId, setNumber) => {
                            const updated = exercises.map((ex) => {
                              if (ex.id !== exId) return ex;
                              const filtered = ex.sets.filter((s) => s.order !== setNumber);
                              const reordered = filtered.map((s, i) => ({ ...s, order: i + 1 }));
                              return { ...ex, sets: reordered };
                            });
                            setExercises(updated);
                          }}
                          onUpdatePlannedSet={(exId, setNumber, data) => {
                            const updated = exercises.map((ex) => {
                              if (ex.id !== exId) return ex;
                              const updatedSets = ex.sets.map((s) =>
                                s.order === setNumber ? { ...s, ...data } : s,
                              );
                              return { ...ex, sets: updatedSets };
                            });
                            setExercises(updated);
                          }}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>

                {/* Small centered + icon to add more exercises (same as wizard step 3) */}
                <div className="flex justify-center py-2">
                  <Button
                    variant="outline"
                    onClick={openAddModal}
                    className="h-14 w-14 rounded-lg p-0"
                    aria-label="Übung hinzufügen"
                  >
                    <IconPlus className="size-7" />
                  </Button>
                </div>
              </>
            )}

            {/* Save as Template Button (exact look as in wizard step 3) */}
            {exercises.length > 0 && (
              <Button
                variant="outline"
                onClick={() => setShowSaveTemplateModal(true)}
                disabled={saving}
                className="w-full mt-2"
              >
                Als Vorlage speichern
              </Button>
            )}

            {/* Action Buttons */}
            <div className="mt-6 flex gap-3">
              <Button
                variant="outline"
                onClick={handleCancel}
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
          </div>
        </main>
      </div>

      {/* Exercise Selection Modal (shadcn Dialog, controlled) -- Add only; Replace is
          handled by each ExerciseCard's own built-in replace modal (onReplaceExercise). */}
      <ExerciseSelectionModal
        open={showExerciseModal}
        onOpenChange={setShowExerciseModal}
        onSelect={handleAddExercise}
      />

      {/* Save Template Modal (shadcn) */}
      <Dialog open={showSaveTemplateModal} onOpenChange={(open) => {
        setShowSaveTemplateModal(open);
        if (!open) setTemplateName('');
      }}>
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
              placeholder="z.B. Mein Push Workout"
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

      {/* Swap confirmation -- a taken weekday can't just be moved onto, so this names the
          day that already holds it and offers to exchange weekdays atomically. */}
      <AlertDialog open={!!swapConflict} onOpenChange={(open) => !open && setSwapConflict(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tage tauschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {WEEKDAY_NAMES[plannedWeekday]} ist für &quot;{swapConflict?.name}&quot; belegt. Tage tauschen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSwap} disabled={saving}>
              Tauschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ProtectedRoute>
  );
}
