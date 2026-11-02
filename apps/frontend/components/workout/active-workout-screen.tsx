'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useWorkout } from '@/lib/workout-context';
import { apiClient } from '@/lib/api';
import { checkWorkoutCompleteness } from '@/lib/workout-completeness';
import { notify } from '@/lib/toast';
import { Workout, PersonalRecord, SaveAsTemplateMode } from '@/types';
import ExerciseCard from '@/components/workout/exercise-card';
import ExerciseSelectionModal from '@/components/workout/exercise-selection-modal';
import WorkoutTimer from '@/components/workout/workout-timer';
import { RestTimerDisplay } from '@/components/workout/rest-timer-display';
import { toast } from 'sonner';
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
import { cn } from '@/lib/utils';
import { FieldError } from '@/components/ui/field';
import { useFormErrors } from '@/hooks/useFormErrors';
import { useValidationMessage } from '@/hooks/useApiErrorMessage';
import { EXERCISES_PER_WORKOUT_MAX, NAME_MAX, checkBaseText } from '@/lib/field-rules';
import {
  TYPED_DURATION_MAX_MINUTES,
  TYPED_DURATION_MIN_MINUTES,
  checkTypedDuration,
} from '@/lib/workout-duration';

interface ActiveWorkoutScreenProps {
  onWorkoutComplete?: (workout: Workout, prs: PersonalRecord[]) => void;
  mode?: 'active' | 'edit';
  showBottomBar?: boolean;
  showHeader?: boolean;
  /** Where the sticky header pins. `top-7` clears the overlay's own sticky drag
   *  handle (28px, issue #131); the default pins it to the top. */
  headerTop?: 'top-0' | 'top-7';
}

type TemplateAction = 'none' | 'overwrite' | 'new';

/** Runs "Beenden" when the 5-hour prompt's "Workout beenden" is pressed (#229): a complete workout
 *  opens the confirm dialog, an incomplete one names its first problem, as for a tap on the button. */
function FinishOnRequest({ onFinish }: { onFinish: () => void }) {
  const { finishRequest } = useWorkout();
  const seen = useRef(finishRequest);
  useEffect(() => {
    if (finishRequest === seen.current) return;
    seen.current = finishRequest;
    onFinish();
  }, [finishRequest, onFinish]);
  return null;
}

export default function ActiveWorkoutScreen({ onWorkoutComplete, mode = 'active', showBottomBar = true, showHeader = true, headerTop = 'top-0' }: ActiveWorkoutScreenProps) {
  const t = useTranslations('ActiveWorkout');
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
    isMinimized,
    setRowState,
  } = useWorkout();

  const [showExerciseModal, setShowExerciseModal] = useState(false);
  // Exercises added this session start expanded (see handleAddExercise) so the user
  // isn't left guessing they need to add sets.
  const [newlyAddedIds, setNewlyAddedIds] = useState<Set<string>>(new Set());
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  // Where a refused "Beenden" sent the user, and whether it was refused at all: the card of the
  // first problem opens and scrolls to it, and a past workout marks every row that is not done.
  const [reveal, setReveal] = useState<{ exerciseId: string; setNumber: number | null; nonce: number } | null>(null);
  const [finishRefused, setFinishRefused] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [updateBlueprint, setUpdateBlueprint] = useState(false);
  const [templateAction, setTemplateAction] = useState<TemplateAction>('none');
  const [newTemplateName, setNewTemplateName] = useState('');
  const [templateForm, templateFormRef] = useFormErrors({
    fields: ['templateName'],
    codeFields: { TEMPLATE_NAME_TAKEN: 'templateName' },
    messageValues: { templateName: { max: NAME_MAX } },
  });
  const validationMessage = useValidationMessage();

  // Minimizing has to close any open workout dialog, or a portalled picker sits at a
  // higher z-index floating over the app once the overlay has collapsed (issue #129).
  // Keyed off the flag rather than any one handler so every minimize path -- tap,
  // drag (#131), back button -- is covered without repeating this.
  useEffect(() => {
    if (!isMinimized) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowExerciseModal(false);
    setShowCompleteConfirm(false);
    setShowDiscardConfirm(false);
  }, [isMinimized]);

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

  // The typed duration of a workout tracked afterwards: shown live under its field, and it
  // keeps "Beenden" from opening the confirmation until it is a real number of minutes.
  const typedMinutes = Math.floor(pastWorkoutDuration / 60);
  const durationProblem = isPastWorkout ? checkTypedDuration(String(typedMinutes)) : null;
  const durationMessage = durationProblem
    ? validationMessage('durationMinutes', durationProblem, {
        min: TYPED_DURATION_MIN_MINUTES,
        max: TYPED_DURATION_MAX_MINUTES,
      })
    : undefined;

  // "Beenden" always looks enabled. A complete workout opens the confirm dialog; an incomplete one
  // answers with a toast naming the first problem and takes the user there (#228). Live
  // workouts and past-workout tracking share the one rule.
  const handleFinish = () => {
    if (durationMessage) {
      notify.error(durationMessage);
      return;
    }
    const result = checkWorkoutCompleteness(activeWorkout, setRowState);
    if (result.complete) {
      setShowCompleteConfirm(true);
      return;
    }
    const { problem } = result;
    setFinishRefused(true);
    if (problem.kind === 'nothingLogged') {
      notify.warning(t('incomplete.nothingLogged'));
      return;
    }
    notify.warning(
      t(`incomplete.${problem.kind}`, {
        exercise: problem.exerciseName,
        number: problem.kind === 'emptyExercise' ? 0 : problem.setNumber,
      }),
    );
    setReveal((prev) => ({
      exerciseId: problem.exerciseId,
      setNumber: problem.kind === 'emptyExercise' ? null : problem.setNumber,
      nonce: (prev?.nonce ?? 0) + 1,
    }));
  };

  const handleAddExercise = async (exerciseId: string) => {
    // Check if exercise already exists in workout
    const isDuplicate = activeWorkout.exercises.some(
      (ex) => ex.exerciseId === exerciseId
    );

    if (activeWorkout.exercises.length >= EXERCISES_PER_WORKOUT_MAX) {
      notify.warning(t('exerciseLimitReached', { max: EXERCISES_PER_WORKOUT_MAX }));
      return; // Don't add, keep modal open
    }

    if (isDuplicate) {
      toast.error(t('duplicateExerciseError'), {
        duration: 4000,
      });
      return; // Don't add, keep modal open
    }

    try {
      const newExerciseLogId = await addExercise(exerciseId);
      setNewlyAddedIds((prev) => new Set(prev).add(newExerciseLogId));
      setShowExerciseModal(false);
    } catch (error) {
      console.error('Failed to add exercise:', error);
      toast.error(t('addExerciseError'));
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
    if (
      templateAction === 'new' &&
      !templateForm.setConstraints({ templateName: checkBaseText(newTemplateName, NAME_MAX) })
    ) {
      return;
    }

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
      toast.error(t('saveError'));
    }
  };

  const handleDiscard = () => {
    // The overlay unmounts itself once the session is gone; the collapse-catcher
    // history entry is cleaned up by ActiveWorkoutOverlay (issue #132). No forced
    // navigation -- like completion, discarding leaves the user where they were.
    discardWorkout();
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
      {mode === 'active' && <FinishOnRequest onFinish={handleFinish} />}
      <div className="min-h-screen bg-background pb-32">
        {/* Header - hidden for pure edit usages (e.g. template editor, history edit of completed)
            where the parent provides its own chrome. For isPastWorkout (past tracking) the header
            provides the duration input, so it stays unless explicitly hidden. */}
        {showHeader && (
          <div className={cn('bg-card border-b sticky z-10', headerTop)}>
            <div className="max-w-4xl mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-foreground">
                    {activeWorkout.isFreeWorkout
                      ? activeWorkout.originTemplateName || t('freeWorkoutName')
                      : activeWorkout.workoutDayName || t('defaultName')}
                  </h1>
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
                        title={isPaused ? t('resume') : t('pause')}
                      >
                        {isPaused ? (
                          <IconPlayerPlay className="size-6" />
                        ) : (
                          <IconPlayerPause className="size-6" />
                        )}
                      </Button>
                    </>
                  ) : isPastWorkout ? (
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="pastWorkoutMinutes" className="text-sm">{t('durationMinutesLabel')}</Label>
                        <Input
                          id="pastWorkoutMinutes"
                          type="number"
                          inputMode="numeric"
                          min={TYPED_DURATION_MIN_MINUTES}
                          max={TYPED_DURATION_MAX_MINUTES}
                          step={1}
                          value={typedMinutes}
                          onChange={(e) => {
                            const minutes = parseInt(e.target.value) || 0;
                            setPastWorkoutDuration(minutes * 60);
                          }}
                          className="w-20 text-base"
                          aria-invalid={durationMessage ? true : undefined}
                          aria-describedby={durationMessage ? 'pastWorkoutMinutes-error' : undefined}
                        />
                      </div>
                      <FieldError id="pastWorkoutMinutes-error" className="max-w-56 text-right">
                        {durationMessage}
                      </FieldError>
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
                    defaultOpen={newlyAddedIds.has(exercise.id)}
                    reveal={reveal?.exerciseId === exercise.id ? reveal : undefined}
                    showUnloggedErrors={isPastWorkout && finishRefused}
                  />
                ))}
              </SortableContext>
            </DndContext>
          ) : (
            <Card>
              <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
                <p className="text-muted-foreground">
                  {t('empty')}
                </p>
                {/* Large centered square + icon as primary CTA (eckig, mittig) */}
                <Button
                  variant="outline"
                  onClick={() => setShowExerciseModal(true)}
                  className="h-16 w-16 rounded-lg p-0 flex items-center justify-center"
                  aria-label={t('addFirstExerciseAria')}
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
                aria-label={t('addExerciseAria')}
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
              {t('discard')}
            </Button>
            <Button
              onClick={handleFinish}
              disabled={loading}
              className="flex-1"
            >
              {t('finish')}
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
            <DialogTitle>{t('finishDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('finishDialog.description', {
                duration: formatTime(isPastWorkout ? pastWorkoutDuration : workoutDuration),
              })}
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
                      {t('finishDialog.updateBlueprint.label')}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {t('finishDialog.updateBlueprint.description')}
                    </div>
                  </div>
                </label>
              </CardContent>
            </Card>
          )}

          {/* Template Option (§3.4: auto-detected overwrite target, no selector) */}
          <Card className="bg-muted/50 border">
            <CardContent className="p-4 space-y-3">
              <div className="font-medium text-foreground">{t('finishDialog.templateSection.title')}</div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={templateAction === 'none'}
                  onChange={() => setTemplateAction('none')}
                  className="mt-1 size-4 accent-primary"
                />
                <div className="text-sm text-muted-foreground">
                  {t('finishDialog.templateSection.none')}
                </div>
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
                      {t('finishDialog.templateSection.overwrite', {
                        name: activeWorkout.originTemplateName ?? '',
                      })}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {t('finishDialog.templateSection.overwriteDescription')}
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
                <div className="flex-1" ref={templateFormRef}>
                  <div className="text-sm text-foreground font-medium">
                    {t('finishDialog.templateSection.saveNew')}
                  </div>
                  {templateAction === 'new' && (
                    <>
                      <Input
                        value={newTemplateName}
                        onChange={(e) => {
                          setNewTemplateName(e.target.value);
                          templateForm.clear('templateName');
                        }}
                        placeholder={t('finishDialog.templateSection.namePlaceholder')}
                        className="mt-2"
                        autoFocus
                        {...templateForm.fieldProps('templateName')}
                      />
                      <FieldError id={templateForm.errorId('templateName')} className="mt-1">
                        {templateForm.errors.templateName}
                      </FieldError>
                    </>
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
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleComplete}
              disabled={loading}
              className="flex-1 h-14 text-base py-2"
            >
              {loading ? t('finishing') : t('finishDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discard Confirmation Modal */}
      <Dialog open={showDiscardConfirm} onOpenChange={(open) => !open && setShowDiscardConfirm(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('discardDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('discardDialog.description')}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowDiscardConfirm(false)}
              className="flex-1 h-14 text-base py-2"
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="outline"
              onClick={handleDiscard}
              disabled={loading}
              className="flex-1 h-14 text-base py-2 border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              {loading ? t('discarding') : t('discardDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
