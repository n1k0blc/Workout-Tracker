'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkout } from '@/lib/workout-context';
import { apiClient } from '@/lib/api';
import { Workout, PersonalRecord, SaveAsTemplateMode } from '@/types';
import ExerciseCard from '@/components/workout/exercise-card';
import ExerciseSelectionModal from '@/components/workout/exercise-selection-modal';
import WorkoutTimer from '@/components/workout/workout-timer';
import { RestTimerDisplay } from '@/components/workout/rest-timer-display';
import toast from 'react-hot-toast';
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
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  IconPlayerPlay,
  IconPlayerPause,
  IconPlus,
} from '@tabler/icons-react';

interface ActiveWorkoutScreenProps {
  onWorkoutComplete?: (workout: Workout, prs: PersonalRecord[]) => void;
  mode?: 'active' | 'edit';
  showBottomBar?: boolean;
  showHeader?: boolean;
}

type TemplateAction = 'none' | 'overwrite' | 'new';

export default function ActiveWorkoutScreen({ onWorkoutComplete, mode = 'active', showBottomBar = true, showHeader = true }: ActiveWorkoutScreenProps) {
  const router = useRouter();
  const {
    activeWorkout,
    completeWorkout,
    discardWorkout,
    addExercise,
    reorderExercises,
    loading,
    workoutDuration,
    isPaused,
    togglePause,
    isPastWorkout,
    pastWorkoutDuration,
    setPastWorkoutDuration,
  } = useWorkout();

  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [updateBlueprint, setUpdateBlueprint] = useState(false);
  const [templateAction, setTemplateAction] = useState<TemplateAction>('none');
  const [newTemplateName, setNewTemplateName] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Long-press to drag (for reordering exercises without visible grip handle)
      activationConstraint: {
        delay: 300,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  if (!activeWorkout) {
    return null;
  }

  const hasBlueprint = !activeWorkout.isFreeWorkout && activeWorkout.workoutDayId && activeWorkout.homeGymId !== null;
  // §3.4 availability matrix: overwrite-template only for a custom origin template (system
  // templates are locked); auto-detected from where this workout was started, no selector.
  const canOverwriteTemplate = !!activeWorkout.originTemplateId && activeWorkout.originTemplateIsCustom === true;

  // Simplified: An exercise is considered "handled" if it has at least one logged set.
  // We no longer distinguish between planned/unplanned sets during execution.
  const areAllSetsLogged = (): boolean => {
    if (activeWorkout.exercises.length === 0) return false;

    return activeWorkout.exercises.every((exercise) => {
      return exercise.sets.length > 0;
    });
  };

  const canFinishWorkout = (): boolean => {
    if (mode === 'edit' || isPastWorkout) {
      // In edit mode (e.g. past workout tracking), allow finishing as long as there are exercises.
      // The values in the input fields (edit state or planned) will be used on save.
      // No requirement for explicit "logged" sets via log UI (which is hidden in edit).
      return activeWorkout.exercises.length > 0;
    }
    return areAllSetsLogged();
  };

  const handleAddExercise = async (exerciseId: string) => {
    // Check if exercise already exists in workout
    const isDuplicate = activeWorkout.exercises.some(
      (ex) => ex.exerciseId === exerciseId
    );

    if (isDuplicate) {
      toast.error(
        'Diese Übung ist bereits im Workout. Füge stattdessen Sätze zur bestehenden Übung hinzu.',
        {
          duration: 4000,
        }
      );
      return; // Don't add, keep modal open
    }

    try {
      await addExercise(exerciseId);
      setShowExerciseModal(false);
    } catch (error) {
      console.error('Failed to add exercise:', error);
      toast.error('Fehler beim Hinzufügen der Übung');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = activeWorkout.exercises.findIndex((ex) => ex.id === active.id);
    const newIndex = activeWorkout.exercises.findIndex((ex) => ex.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const newExercises = [...activeWorkout.exercises];
    const [movedExercise] = newExercises.splice(oldIndex, 1);
    newExercises.splice(newIndex, 0, movedExercise);

    try {
      await reorderExercises(newExercises.map((ex) => ex.id));
    } catch (error) {
      console.error('Failed to reorder exercises:', error);
    }
  };

  const handleComplete = async () => {
    try {
      const workout = await completeWorkout({
        overwriteBlueprint: updateBlueprint,
        saveAsTemplateMode:
          templateAction === 'new'
            ? SaveAsTemplateMode.NEW
            : templateAction === 'overwrite'
            ? SaveAsTemplateMode.OVERWRITE
            : SaveAsTemplateMode.NONE,
        saveAsTemplateName: templateAction === 'new' ? newTemplateName.trim() : undefined,
        overwriteTemplateId: templateAction === 'overwrite' ? activeWorkout.originTemplateId : undefined,
      });

      if (!workout) {
        throw new Error('No workout returned from completeWorkout');
      }

      // Close confirmation modal
      setShowCompleteConfirm(false);

      // Load recent PRs to show if any were set in this workout
      let prs: PersonalRecord[] = [];
      try {
        const prData = await apiClient.getPersonalRecords({});
        prs = prData.recentPRs || [];
      } catch (error) {
        console.error('Failed to load PRs:', error);
        // Continue anyway with empty array
      }

      // Call parent handler to show completion modal (only when provided, e.g. not in pure edit mode for history/templates)
      onWorkoutComplete?.(workout, prs);

    } catch (error) {
      console.error('Failed to complete workout:', error);
      toast.error('Fehler beim Speichern des Workouts');
    }
  };

  const handleDiscard = () => {
    discardWorkout();
    router.push('/dashboard');
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs
        .toString()
        .padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <div className="min-h-screen bg-background pb-32">
        {/* Header - hidden for pure edit usages (e.g. template editor, history edit of completed)
            where the parent provides its own chrome. For isPastWorkout (past tracking) the header
            provides the duration input, so it stays unless explicitly hidden. */}
        {showHeader && (
          <div className="bg-card border-b sticky top-0 z-10">
            <div className="max-w-4xl mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-foreground">
                    {activeWorkout.isFreeWorkout
                      ? activeWorkout.originTemplateName || 'Freies Workout'
                      : activeWorkout.workoutDayName || 'Workout'}
                  </h1>
                  {activeWorkout.cycleName && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {activeWorkout.cycleName}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {/* For past workout tracking we *always* show the manual duration input and never the live timers.
                      This prevents the overall workout timer from appearing after set operations (delete, etc.). */}
                  {!isPastWorkout && mode === 'active' ? (
                    <>
                      <div className="flex flex-col items-end gap-2">
                        <WorkoutTimer workoutDuration={workoutDuration} />
                        <RestTimerDisplay />
                      </div>
                      {/* Pause/Play Button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={togglePause}
                        title={isPaused ? 'Training fortsetzen' : 'Training pausieren'}
                      >
                        {isPaused ? (
                          <IconPlayerPlay className="size-6" />
                        ) : (
                          <IconPlayerPause className="size-6" />
                        )}
                      </Button>
                    </>
                  ) : isPastWorkout ? (
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Dauer (Min):</Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={Math.floor(pastWorkoutDuration / 60)}
                        onChange={(e) => {
                          const minutes = parseInt(e.target.value) || 0;
                          setPastWorkoutDuration(minutes * 60);
                        }}
                        className="w-20 text-base"
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
          {/* Exercises */}
          {activeWorkout.exercises.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={activeWorkout.exercises.map((ex) => ex.id)}
                strategy={verticalListSortingStrategy}
              >
                {activeWorkout.exercises.map((exercise, idx) => (
                  <ExerciseCard
                    key={exercise.id}
                    exercise={exercise}
                    exerciseNumber={idx + 1}
                    mode={mode}
                    allowReorder={true}
                    allowExerciseActions={true}
                    allowSetManagement={true}
                    allowLogging={!isPastWorkout}
                  />
                ))}
              </SortableContext>
            </DndContext>
          ) : (
            <Card>
              <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
                <p className="text-muted-foreground">
                  Noch keine Übungen hinzugefügt
                </p>
                {/* Large centered square + icon as primary CTA (eckig, mittig) */}
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

          {/* Add Exercise: large centered square + icon (instead of text button) */}
          {activeWorkout.exercises.length > 0 && (
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
          )}
        </div>
      </div>

      {/* Bottom Actions Bar */}
      {showBottomBar && (
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t shadow-lg">
          <div className="max-w-4xl mx-auto px-4 py-4 flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowDiscardConfirm(true)}
              disabled={loading}
              className="flex-1"
            >
              Verwerfen
            </Button>
            <Button
              onClick={() => setShowCompleteConfirm(true)}
              disabled={loading || !canFinishWorkout()}
              className="flex-1"
            >
              Workout beenden
            </Button>
          </div>
        </div>
      )}

      {/* Exercise Selection Modal (shadcn Dialog, controlled) */}
      <ExerciseSelectionModal
        open={showExerciseModal}
        onOpenChange={setShowExerciseModal}
        onSelect={handleAddExercise}
      />

      {/* Complete Confirmation Modal */}
      <Dialog open={showCompleteConfirm} onOpenChange={(open) => {
        if (!open) {
          setShowCompleteConfirm(false);
          setUpdateBlueprint(false);
          setTemplateAction('none');
          setNewTemplateName('');
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Workout beenden?</DialogTitle>
            <DialogDescription>
              Dein Workout wird mit {formatTime(isPastWorkout ? pastWorkoutDuration : workoutDuration)} Dauer gespeichert.
            </DialogDescription>
          </DialogHeader>

          {/* Blueprint Update Option */}
          {hasBlueprint && (
            <Card className="bg-muted/50 border">
              <CardContent className="p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={updateBlueprint}
                    onChange={(e) => setUpdateBlueprint(e.target.checked)}
                    className="mt-1 size-4 accent-primary"
                  />
                  <div>
                    <div className="font-medium text-foreground">
                      Blueprint aktualisieren
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Überschreibe den Blueprint mit den heutigen Werten (Gewicht, Wiederholungen, RIR).
                      Diese werden beim nächsten Training vorgeschlagen.
                    </div>
                  </div>
                </label>
              </CardContent>
            </Card>
          )}

          {/* Template Option (§3.4: auto-detected overwrite target, no selector) */}
          <Card className="bg-muted/50 border">
            <CardContent className="p-4 space-y-3">
              <div className="font-medium text-foreground">Vorlage</div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={templateAction === 'none'}
                  onChange={() => setTemplateAction('none')}
                  className="mt-1 size-4 accent-primary"
                />
                <div className="text-sm text-muted-foreground">Nicht als Vorlage speichern</div>
              </label>

              {canOverwriteTemplate && (
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={templateAction === 'overwrite'}
                    onChange={() => setTemplateAction('overwrite')}
                    className="mt-1 size-4 accent-primary"
                  />
                  <div>
                    <div className="text-sm text-foreground font-medium">
                      &quot;{activeWorkout.originTemplateName}&quot; überschreiben
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Ersetzt die Vorlage dauerhaft mit den heutigen Werten.
                    </div>
                  </div>
                </label>
              )}

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={templateAction === 'new'}
                  onChange={() => setTemplateAction('new')}
                  className="mt-1 size-4 accent-primary"
                />
                <div className="flex-1">
                  <div className="text-sm text-foreground font-medium">Als neue Vorlage speichern</div>
                  {templateAction === 'new' && (
                    <Input
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      placeholder="z.B. Mein starkes Push Workout"
                      className="mt-2"
                      autoFocus
                    />
                  )}
                </div>
              </label>
            </CardContent>
          </Card>

          <DialogFooter className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowCompleteConfirm(false);
                setUpdateBlueprint(false);
                setTemplateAction('none');
                setNewTemplateName('');
              }}
              className="flex-1 h-14 text-base py-2"
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleComplete}
              disabled={loading || (templateAction === 'new' && !newTemplateName.trim())}
              className="flex-1 h-14 text-base py-2"
            >
              {loading ? 'Wird gespeichert...' : 'Beenden'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discard Confirmation Modal */}
      <Dialog open={showDiscardConfirm} onOpenChange={(open) => !open && setShowDiscardConfirm(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Workout verwerfen?</DialogTitle>
            <DialogDescription>
              Alle nicht gespeicherten Daten gehen verloren. Dies kann nicht
              rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowDiscardConfirm(false)}
              className="flex-1 h-14 text-base py-2"
            >
              Abbrechen
            </Button>
            <Button
              variant="outline"
              onClick={handleDiscard}
              disabled={loading}
              className="flex-1 h-14 text-base py-2 border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              {loading ? 'Wird verworfen...' : 'Verwerfen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
