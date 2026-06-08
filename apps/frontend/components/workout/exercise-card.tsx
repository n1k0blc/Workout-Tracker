'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ExerciseLog, SetLog, SetType } from '@/types';
import { useWorkout } from '@/lib/workout-context';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ExerciseSelectionModal from './exercise-selection-modal';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import {
  IconRefresh,
  IconTrash,
  IconCheck,
  IconPlus,
  IconFlame,
  IconBarbell,
} from '@tabler/icons-react';

// TODO: This component mixes live execution logging/editing with presentation.
// Before extracting a shared WorkoutExercise component (with mode="execution"|"editor"|"review"),
// further separation of concerns may be useful. Unplanned live tracking removed (Phase 4).

interface ExerciseCardProps {
  exercise: ExerciseLog;
  exerciseNumber: number;
  mode?: 'active' | 'edit';

  // Fine-grained control for edit modes (History vs. Blueprint/Template).
  // Defaults are derived from mode if not explicitly provided.
  allowReorder?: boolean;            // Enable Dnd listeners on header for reordering exercises
  allowExerciseActions?: boolean;    // Show Replace and Delete-Exercise buttons in header
  allowSetManagement?: boolean;      // Show "+ Satz hinzufügen" and per-set delete
  allowLogging?: boolean;            // Show check column, enable log behavior and LTR swipe logging

  // Optional handlers for controlled usage (e.g. templates without context hijack)
  onRemoveExercise?: (exerciseId: string) => void | Promise<void>;
  onReplaceExercise?: (exerciseId: string, newExerciseId: string) => void | Promise<void>;
  onAddSet?: (exerciseId: string) => void;
  onRemoveSet?: (exerciseId: string, setId: string) => void;
  onUpdateSet?: (exerciseId: string, setId: string, data: { reps?: number; weight?: number; rir?: number; setType?: SetType }) => void | Promise<void>;
}


export default function ExerciseCard({
  exercise,
  exerciseNumber,
  mode = 'active',
  allowReorder,
  allowExerciseActions,
  allowSetManagement,
  allowLogging,
  onRemoveExercise,
  onReplaceExercise,
  onAddSet,
  onRemoveSet,
  onUpdateSet,
}: ExerciseCardProps) {
  // Derive effective flags. For 'active' everything is on.
  // For 'edit' the caller decides (History: all structural/logging off; Blueprint: structural on, logging off).
  const effectiveAllowReorder = allowReorder ?? (mode === 'active');
  const effectiveAllowExerciseActions = allowExerciseActions ?? (mode === 'active');
  const effectiveAllowSetManagement = allowSetManagement ?? (mode === 'active');
  const effectiveAllowLogging = allowLogging ?? (mode === 'active');
  const { 
    removeExercise: contextRemoveExercise, 
    replaceExercise: contextReplaceExercise, 
    logSet, 
    updateSet: contextUpdateSet, 
    loading,
    activeWorkout,
    setActiveWorkoutDirectly,
  } = useWorkout();

  // Prefer injected handlers (for decoupled template usage, no context hijack) over context
  const removeExercise = onRemoveExercise || contextRemoveExercise;
  const replaceExercise = onReplaceExercise || contextReplaceExercise;

  const [editValues, setEditValues] = useState<{[key: number]: {weight: string, reps: string, rir: string, setType: SetType}}>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<{
    reps: string;
    weight: string;
    rir: string;
  }>({ reps: '', weight: '', rir: '' });

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: exercise.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // drag listeners are conditionally spread in the name area below when effectiveAllowReorder is true.

  const hasPlannedSets = exercise.plannedSets && exercise.plannedSets.length > 0;

  const showCheckColumn = effectiveAllowLogging;
  const colTemplate = showCheckColumn
    ? 'grid-cols-[auto_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.7fr)_auto]'
    : 'grid-cols-[auto_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.7fr)]';

  // Local drafts for additional/extra sets (free workouts or sets beyond planned).
  // These are UI-only (not persisted in context) – backend only cares about final logs.
  const [additionalSetNumbers, setAdditionalSetNumbers] = useState<number[]>([]);

  // Locally skipped planned set numbers (for this workout execution only).
  // Allows "deleting" (hiding the row for) unlogged planned sets via RTL swipe.
  const [skippedPlannedSetNumbers, setSkippedPlannedSetNumbers] = useState<Set<number>>(new Set());

  // Swipe state for set rows (LTR = log if unlogged, RTL = discard unlogged draft).
  const [activeSwipe, setActiveSwipe] = useState<null | { key: string | number; startX: number; startY: number; offset: number }>(null);

  const initialEditCommitDone = useRef(false);

  // Centralized detection via the clean flag set by the caller (template editor, future cycle wizard etc.).
  // Note: isBlueprintEdit / prefix hacks have been replaced by explicit props (allow*).
  // See ExerciseCardProps and the centralization plan in UI-REFRACTORING-PLAN.md.

  const addAdditionalSet = () => {
    const maxPlanned = hasPlannedSets
      ? Math.max(...exercise.plannedSets!.map((ps) => ps.order))
      : 0;
    const maxLogged = exercise.sets.length > 0
      ? Math.max(...exercise.sets.map((s) => s.setNumber))
      : 0;
    const maxDraft = additionalSetNumbers.length > 0
      ? Math.max(...additionalSetNumbers)
      : 0;
    const next = Math.max(maxPlanned, maxLogged, maxDraft) + 1;

    setAdditionalSetNumbers((prev) => [...prev, next]);
    setEditValues((prev) => ({
      ...prev,
      [next]: { weight: '', reps: '', rir: '', setType: SetType.WORKING },
    }));
  };

  const handleLogSet = async (setNumber: number) => {
    // Double-click protection
    const existingSet = getLoggedSet(setNumber);
    if (existingSet) {
      console.warn(`Set ${setNumber} is already logged`);
      return;
    }
    if (loading) {
      return;
    }

    // Both setNumber and order are 1-based
    const plannedSet = exercise.plannedSets?.find((ps) => ps.order === setNumber);

    let values: { weight: string; reps: string; rir: string };
    let setType: SetType = SetType.WORKING;
    let plannedRestAfterSet: number | undefined;

    if (plannedSet) {
      values = {
        weight: editValues[setNumber]?.weight ?? plannedSet.weight.toString(),
        reps: editValues[setNumber]?.reps ?? plannedSet.reps.toString(),
        rir: editValues[setNumber]?.rir ?? plannedSet.rir.toString(),
      };
      setType = editValues[setNumber]?.setType ?? plannedSet.setType;
      plannedRestAfterSet = plannedSet.restAfterSet;
    } else {
      // Additional / free set: must come from seeded editValues (from addAdditionalSet)
      const ev = editValues[setNumber];
      if (!ev) return;
      const w = parseFloat(ev.weight || '0');
      const r = parseInt(ev.reps || '0');
      if (w === 0 || r === 0) {
        console.warn('Cannot log additional set with empty weight or reps');
        return;
      }
      values = { weight: ev.weight, reps: ev.reps, rir: ev.rir };
      setType = ev.setType || SetType.WORKING;
      plannedRestAfterSet = 90; // sensible default for extra sets
    }

    try {
      await logSet(exercise.id, {
        setNumber,
        weight: parseFloat(values.weight) || 0,
        reps: parseInt(values.reps) || 0,
        rir: values.rir ? parseInt(values.rir) : undefined,
        setType,
        plannedRestAfterSet,
      });

      // Remove from additional drafts (if it was one)
      setAdditionalSetNumbers((prev) => prev.filter((n) => n !== setNumber));

      // Clear edit state for this setNumber
      setEditValues((prev) => {
        const newVals = { ...prev };
        delete newVals[setNumber];
        return newVals;
      });
    } catch (error) {
      console.error('Failed to log set:', error);
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        console.error('This set number is already logged (database constraint)');
      }
    }
  };

  const handleRemoveExercise = async () => {
    try {
      await removeExercise(exercise.id);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Failed to remove exercise:', error);
    }
  };

  const handleReplaceExercise = async (newExerciseId: string) => {
    try {
      await replaceExercise(exercise.id, newExerciseId);
      setShowReplaceModal(false);
    } catch (error) {
      console.error('Failed to replace exercise:', error);
    }
  };


  const getLoggedSet = useCallback((setNumber: number) => {
    return exercise.sets.find(s => s.setNumber === setNumber);
  }, [exercise.sets]);

  const updateEditValue = (setNumber: number, field: 'weight' | 'reps' | 'rir' | 'setType', value: string | SetType) => {
    setEditValues(prev => ({
      ...prev,
      [setNumber]: {
        ...prev[setNumber],
        [field]: value,
      },
    }));
  };

  const getEditValue = useCallback((setNumber: number, field: 'weight' | 'reps' | 'rir'): string => {
    // Check if we have an edit value (including empty strings)
    if (editValues[setNumber] && editValues[setNumber][field] !== undefined) {
      return editValues[setNumber][field] as string;
    }
    // Fall back to planned set value (both setNumber and order are 1-based)
    const plannedSet = exercise.plannedSets?.find(ps => ps.order === setNumber);
    if (!plannedSet) return '';
    return plannedSet[field]?.toString() || '';
  }, [editValues, exercise.plannedSets]);

  const getEditSetType = (setNumber: number): SetType => {
    if (editValues[setNumber]?.setType) {
      return editValues[setNumber].setType;
    }
    // Both setNumber and order are 1-based
    const plannedSet = exercise.plannedSets?.find(ps => ps.order === setNumber);
    return plannedSet?.setType || SetType.WORKING;
  };

  // In edit mode, on mount, commit any pre-filled planned sets with values (even if not edited),
  // so that on "beenden" the current field values (planned or edited) are saved.
  useEffect(() => {
    if (mode === 'edit' && hasPlannedSets && !initialEditCommitDone.current) {
      initialEditCommitDone.current = true;
      exercise.plannedSets!.forEach((ps) => {
        const sn = ps.order;
        if (!getLoggedSet(sn)) {
          const w = parseFloat(getEditValue(sn, 'weight') || ps.weight?.toString() || '0');
          const r = parseInt(getEditValue(sn, 'reps') || ps.reps?.toString() || '0');
          if (w > 0 && r > 0) {
            // schedule to not run during render
            setTimeout(() => handleLogSet(sn), 0);
          }
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, hasPlannedSets]);

  const getSetIndicatorSlots = (): number[] => {
    const slots = new Set<number>();

    if (hasPlannedSets && exercise.plannedSets!.length > 0) {
      exercise.plannedSets!
        .filter(ps => !skippedPlannedSetNumbers.has(ps.order))
        .forEach((ps) => slots.add(ps.order));
    }

    // Include logged sets (covers logged planned + logged extras; for free workouts: all logged)
    exercise.sets.forEach((s) => slots.add(s.setNumber));

    // Include unlogged additional/extras (for planned workouts with added sets, and free workouts)
    additionalSetNumbers.forEach((n) => slots.add(n));

    return Array.from(slots).sort((a, b) => a - b);
  };

  // Swipe helpers
  const SWIPE_THRESHOLD = 70;
  const startSwipe = (key: string | number, clientX: number, clientY: number) => {
    if (loading) return;
    setActiveSwipe({ key, startX: clientX, startY: clientY, offset: 0 });
  };
  const updateSwipe = (clientX: number, clientY: number) => {
    if (!activeSwipe) return;
    const dx = clientX - activeSwipe.startX;
    const dy = clientY - activeSwipe.startY;
    if (Math.abs(dx) > Math.abs(dy) * 1.5) { // mostly horizontal
      const clamped = Math.max(-120, Math.min(120, dx));
      setActiveSwipe({ ...activeSwipe, offset: clamped });
    }
  };
  const endSwipe = (key: string | number, setNumber?: number, isLogged: boolean = false) => {
    if (!activeSwipe || activeSwipe.key !== key) {
      setActiveSwipe(null);
      return;
    }
    const offset = activeSwipe.offset;
    setActiveSwipe(null);
    if (offset > SWIPE_THRESHOLD && setNumber !== undefined && !isLogged) {
      handleLogSet(setNumber);
    } else if (offset < -SWIPE_THRESHOLD && setNumber !== undefined && (!isLogged || effectiveAllowSetManagement)) {
      discardUnloggedSet(setNumber);
    }
    // RTL on logged: no effect (cannot delete logged sets via swipe) — except for template synthetic (pure plan edit)
  };

  const discardUnloggedSet = (setNumber: number) => {
    // Clear any pending edits for this setNumber (reverts planned to defaults, clears additional)
    setEditValues(prev => {
      const newVals = { ...prev };
      delete newVals[setNumber];
      return newVals;
    });

    const isPlannedSlot = hasPlannedSets && exercise.plannedSets?.some(ps => ps.order === setNumber);

    if (effectiveAllowSetManagement) {
      if (onRemoveSet) {
        // Use injected handler (for no-hijack template usage)
        const setForNum = (exercise.sets || []).find((s: any) => (s.setNumber ?? s.order) === setNumber) // eslint-disable-line @typescript-eslint/no-explicit-any
          || (exercise.plannedSets || []).find((p: any) => p.order === setNumber); // eslint-disable-line @typescript-eslint/no-explicit-any
        if (setForNum) {
          const sid = (setForNum as any).id; // eslint-disable-line @typescript-eslint/no-explicit-any
          onRemoveSet(exercise.id, sid);
        }
      } else if (activeWorkout && setActiveWorkoutDirectly) {
        // fallback for cases still using hijack (e.g. history edit)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updatedExercises = activeWorkout.exercises.map((ex: any) => {
          if (ex.id !== exercise.id) return ex;
          return {
            ...ex,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            plannedSets: (ex.plannedSets || []).filter((ps: any) => ps.order !== setNumber),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sets: (ex.sets || []).filter((s: any) => (s.setNumber ?? s.order) !== setNumber),
          };
        });
        setActiveWorkoutDirectly({
          ...activeWorkout,
          exercises: updatedExercises,
        } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      }
      setAdditionalSetNumbers(prev => prev.filter(n => n !== setNumber));
      setSkippedPlannedSetNumbers(prev => {
        const next = new Set(prev);
        next.delete(setNumber);
        return next;
      });
      return;
    }

    if (isPlannedSlot) {
      // For unlogged planned: "delete" means hide the row for this execution (user doesn't want to do this planned set)
      setSkippedPlannedSetNumbers(prev => {
        const next = new Set(prev);
        next.add(setNumber);
        return next;
      });
    } else {
      // Additional / extra / free: remove the prepare row entirely
      setAdditionalSetNumbers(prev => prev.filter(n => n !== setNumber));
    }
  };

  // Helper for changing values in a row (live update for logged sets)
  const handleRowValueChange = (setNumber: number, loggedSet: { id: string; weight: number; reps: number; rir?: number; setNumber?: number } | null, field: 'weight' | 'reps' | 'rir', newValStr: string) => {
    if (loggedSet) {
      if (editingSetId !== loggedSet.id) {
        setEditingSetId(loggedSet.id);
        setEditingValues({
          weight: loggedSet.weight.toString(),
          reps: loggedSet.reps.toString(),
          rir: loggedSet.rir != null ? loggedSet.rir.toString() : '',
        });
      }
      setEditingValues(prev => ({ ...prev, [field]: newValStr }));

      // Build payload from current editing buffer or logged + this change
      const w = field === 'weight'
        ? (parseFloat(newValStr) || 0)
        : (editingValues.weight ? parseFloat(editingValues.weight) : loggedSet.weight);
      const r = field === 'reps'
        ? (parseInt(newValStr) || 0)
        : (editingValues.reps ? parseInt(editingValues.reps) : loggedSet.reps);
      const ri = field === 'rir'
        ? (parseInt(newValStr) || undefined)
        : (editingValues.rir ? parseInt(editingValues.rir) : loggedSet.rir);
      if (onUpdateSet) {
        onUpdateSet(exercise.id, loggedSet.id, { weight: w, reps: r, rir: ri });
      } else {
        contextUpdateSet(loggedSet.id, { weight: w, reps: r, rir: ri });
      }
    } else {
      updateEditValue(setNumber, field, newValStr);
    }
  };

  // Render helpers for extra rows (used to render logged extras + unlogged drafts in a single sorted-by-setNumber list)
  const renderDraftRow = (setNumber: number) => {
    const gridClass = `grid ${colTemplate} items-center gap-x-2 py-1.5 border-b border-border last:border-b-0`;
    const isWarmup = getEditSetType(setNumber) === SetType.WARMUP;

    const swipeKey = `add-${setNumber}`;
    const swipeOffset = activeSwipe && activeSwipe.key === swipeKey ? activeSwipe.offset : 0;
    const swipeClass = swipeOffset > 0 ? 'bg-primary/5' : swipeOffset < 0 ? 'bg-destructive/5' : '';

    const commitIfNeeded = () => {
      if (mode === 'edit' && !getLoggedSet(setNumber)) {
        const w = parseFloat(getEditValue(setNumber, 'weight') || '0');
        const r = parseInt(getEditValue(setNumber, 'reps') || '0');
        if (w > 0 && r > 0) {
          handleLogSet(setNumber);
        }
      }
    };

    return (
      <div
        key={`add-${setNumber}`}
        onPointerDown={(e) => startSwipe(swipeKey, e.clientX, e.clientY)}
        onPointerMove={(e) => updateSwipe(e.clientX, e.clientY)}
        onPointerUp={() => endSwipe(swipeKey, setNumber, false)}
        onPointerLeave={() => endSwipe(swipeKey, setNumber, false)}
        onPointerCancel={() => setActiveSwipe(null)}
        style={swipeOffset !== 0 ? { transform: `translateX(${swipeOffset}px)` } : undefined}
        className={`${swipeClass} transition-transform touch-pan-y`}
      >
        <div className={gridClass}>
          {/* Type: tappable icon for unlogged drafts */}
          <button
            type="button"
            onClick={() => {
              const next = isWarmup ? SetType.WORKING : SetType.WARMUP;
              updateEditValue(setNumber, 'setType', next);
            }}
            disabled={loading}
            className="flex items-center justify-center"
            title={isWarmup ? 'Aufwärmen' : 'Arbeit'}
          >
            <Badge variant={isWarmup ? 'outline' : 'default'} className="p-0.5">
              {isWarmup ? <IconFlame className="size-4" /> : <IconBarbell className="size-4" />}
            </Badge>
          </button>

          <Input type="number" step="0.5" value={getEditValue(setNumber, 'weight')} onChange={(e) => handleRowValueChange(setNumber, null, 'weight', e.target.value)} onBlur={commitIfNeeded} placeholder="0" className="h-7 text-sm tabular-nums" disabled={loading} onPointerDown={e => e.stopPropagation()} />
          <Input type="number" value={getEditValue(setNumber, 'reps')} onChange={(e) => handleRowValueChange(setNumber, null, 'reps', e.target.value)} onBlur={commitIfNeeded} placeholder="0" className="h-7 text-sm tabular-nums" disabled={loading} onPointerDown={e => e.stopPropagation()} />
          <Input type="number" value={getEditValue(setNumber, 'rir')} onChange={(e) => handleRowValueChange(setNumber, null, 'rir', e.target.value)} onBlur={commitIfNeeded} placeholder="" className="h-7 text-sm tabular-nums" disabled={loading} onPointerDown={e => e.stopPropagation()} />

          {showCheckColumn && (
            <div className="flex justify-end">
              <button onClick={() => handleLogSet(setNumber)} disabled={loading} className="p-0.5" title="Satz loggen (oder Swipe LTR)">
                <IconCheck className="size-4 text-muted-foreground/60 hover:text-primary" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderLoggedExtraRow = (set: SetLog) => {
    const gridClass = `grid ${colTemplate} items-center gap-x-2 py-1.5 border-b border-border last:border-b-0`;
    const isWarmup = set.setType === SetType.WARMUP;
    const isEditingThis = editingSetId === set.id;

    const swipeKey = set.id;
    const swipeOffset = activeSwipe && activeSwipe.key === swipeKey ? activeSwipe.offset : 0;
    const swipeClass = swipeOffset > 0 ? 'bg-primary/5' : swipeOffset < 0 ? 'bg-destructive/5' : '';

    return (
      <div
        key={set.id}
        onPointerDown={(e) => startSwipe(swipeKey, e.clientX, e.clientY)}
        onPointerMove={(e) => updateSwipe(e.clientX, e.clientY)}
        onPointerUp={() => endSwipe(swipeKey, set.setNumber, true)}
        onPointerLeave={() => endSwipe(swipeKey, set.setNumber, true)}
        onPointerCancel={() => setActiveSwipe(null)}
        style={swipeOffset !== 0 ? { transform: `translateX(${swipeOffset}px)` } : undefined}
        className={`${swipeClass} transition-transform touch-pan-y`}
      >
        <div className={gridClass}>
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => {
                if (effectiveAllowSetManagement) {
                  const next = isWarmup ? SetType.WORKING : SetType.WARMUP;
                  if (onUpdateSet) {
                    onUpdateSet(exercise.id, set.id, { setType: next });
                  }
                }
              }}
              disabled={loading || !effectiveAllowSetManagement}
              className="flex items-center justify-center"
              title={isWarmup ? 'Aufwärmen' : 'Arbeit'}
            >
              <Badge variant={isWarmup ? 'outline' : 'default'} className="p-0.5">
                {isWarmup ? <IconFlame className="size-4" /> : <IconBarbell className="size-4" />}
              </Badge>
            </button>
          </div>

          {/* Value cells - always inputs for consistent layout; live edit for logged via updateSet */}
          <Input
            type="number"
            step="0.5"
            value={isEditingThis ? editingValues.weight : set.weight.toString()}
            onChange={(e) => handleRowValueChange(set.setNumber, set, 'weight', e.target.value)}
            placeholder="0"
            className="h-7 text-sm tabular-nums"
            disabled={loading}
            onPointerDown={e => e.stopPropagation()}
          />
          <Input
            type="number"
            value={isEditingThis ? editingValues.reps : set.reps.toString()}
            onChange={(e) => handleRowValueChange(set.setNumber, set, 'reps', e.target.value)}
            placeholder="0"
            className="h-7 text-sm tabular-nums"
            disabled={loading}
            onPointerDown={e => e.stopPropagation()}
          />
          <Input
            type="number"
            value={isEditingThis ? editingValues.rir : (set.rir != null ? set.rir.toString() : '')}
            onChange={(e) => handleRowValueChange(set.setNumber, set, 'rir', e.target.value)}
            placeholder=""
            className="h-7 text-sm tabular-nums"
            disabled={loading}
            onPointerDown={e => e.stopPropagation()}
          />

          {/* Check cell - fat only, no buttons (delete via swipe) */}
          {showCheckColumn && (
            <div className="flex justify-end">
              <button disabled={loading} className="p-0.5" title="Geloggt (nicht entloggen möglich; Swipe RTL zum Löschen)">
                <IconCheck className="size-4 text-foreground stroke-[3]" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <Card
        ref={setNodeRef}
        style={style}
        className="py-0 gap-0 overflow-hidden rounded-lg border-border"
      >
        {/* Exercise Header (compact bar) */}
        <div className="px-4 py-3 flex items-start justify-between bg-muted border-b border-border">
          {/* Name area + indicators: long-press to drag-reorder (only if allowed); tap name to toggle collapse */}
          <div
            {...(effectiveAllowReorder ? { ...attributes, ...listeners } : {})}
            className={`flex flex-col ${effectiveAllowReorder ? 'cursor-grab active:cursor-grabbing' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setIsCollapsed(!isCollapsed);
            }}
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-muted-foreground">
                #{exerciseNumber}
              </span>
              <h3 className="font-semibold text-foreground">
                {exercise.exerciseName}
              </h3>
            </div>
            {/* Collapsed set progress indicators: horizontal lines, foreground for logged */}
            {isCollapsed && (
              <div className="flex items-center gap-1 mt-1 ml-8">
                {getSetIndicatorSlots().map((slot, i) => {
                  // For blueprint/template edit (!allowLogging), always show as "unlogged" (gray) since there's no logging concept.
                  const logged = effectiveAllowLogging && !!getLoggedSet(slot);
                  return (
                    <div
                      key={i}
                      className={`h-[2.5px] w-4 rounded-[1px] transition-colors ${logged ? 'bg-foreground' : 'bg-muted-foreground/30'}`}
                      title={`Satz ${slot}${logged ? ' geloggt' : ''}`}
                    />
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            {/* Replace Exercise Button - only if allowed */}
            {effectiveAllowExerciseActions && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowReplaceModal(true)}
                onPointerDown={(e) => e.stopPropagation()}
                className="size-8"
                title="Übung austauschen"
              >
                <IconRefresh className="size-4" />
              </Button>
            )}
            {/* Delete Exercise Button - only if allowed */}
            {effectiveAllowExerciseActions && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDeleteConfirm(true)}
                onPointerDown={(e) => e.stopPropagation()}
                className="size-8 text-destructive hover:text-destructive"
                title="Übung entfernen"
              >
                <IconTrash className="size-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Sets - table layout with swipe support */}
        {!isCollapsed && (
          <CardContent className="p-2 sm:p-3">
            {/* Compact column header (optional, saves space on mobile) */}
            <div className={`grid ${colTemplate} items-center gap-x-2 px-1 pb-1 text-[10px] text-muted-foreground font-medium`}>
              <div></div>
              <div>Gewicht{exercise.isDoubleWeight ? ' (2x)' : ''}</div>
              <div>Wdh{exercise.isUnilateral ? ' (2x)' : ''}</div>
              <div>RIR</div>
              {showCheckColumn && <div className="text-center">✓</div>}
            </div>

            {/* Planned Sets as table rows (filter skipped unlogged ones) */}
            {hasPlannedSets && exercise.plannedSets!
              .filter(ps => !skippedPlannedSetNumbers.has(ps.order))
              .map((plannedSet) => {
              const setNumber = plannedSet.order;
              const loggedSet = getLoggedSet(setNumber);
              const isEditingThis = editingSetId === loggedSet?.id;
              const currentType = loggedSet ? loggedSet.setType : getEditSetType(setNumber);
              const isWarmup = currentType === SetType.WARMUP;

              const gridClass = `grid ${colTemplate} items-center gap-x-2 py-1.5 border-b border-border last:border-b-0`;

              const swipeKey = setNumber;
              const swipeOffset = activeSwipe && activeSwipe.key === swipeKey ? activeSwipe.offset : 0;
              const swipeClass = swipeOffset > 0 ? 'bg-primary/5' : swipeOffset < 0 ? 'bg-destructive/5' : '';

              const commitIfNeeded = () => {
                if (mode === 'edit' && !loggedSet) {
                  const w = parseFloat(getEditValue(setNumber, 'weight') || plannedSet.weight?.toString() || '0');
                  const r = parseInt(getEditValue(setNumber, 'reps') || plannedSet.reps?.toString() || '0');
                  if (w > 0 && r > 0) {
                    handleLogSet(setNumber);
                  }
                }
              };

              return (
                <div
                  key={plannedSet.id}
                  onPointerDown={(e) => startSwipe(swipeKey, e.clientX, e.clientY)}
                  onPointerMove={(e) => updateSwipe(e.clientX, e.clientY)}
                  onPointerUp={() => endSwipe(swipeKey, setNumber, !!loggedSet)}
                  onPointerLeave={() => endSwipe(swipeKey, setNumber, !!loggedSet)}
                  onPointerCancel={() => setActiveSwipe(null)}
                  style={swipeOffset !== 0 ? { transform: `translateX(${swipeOffset}px)` } : undefined}
                  className={`${swipeClass} transition-transform touch-pan-y`}
                >
                  <div className={gridClass}>
                    {/* Type cell: tappable icon for unlogged/editing to switch type */}
                    <button
                      type="button"
                      onClick={() => {
                        if (effectiveAllowSetManagement || !loggedSet || isEditingThis) {
                          const next = isWarmup ? SetType.WORKING : SetType.WARMUP;
                          if (effectiveAllowSetManagement && loggedSet && onUpdateSet) {
                            // For blueprint: directly update the set type via handler
                            onUpdateSet(exercise.id, loggedSet.id, { setType: next });
                          } else {
                            updateEditValue(setNumber, 'setType', next);
                          }
                        }
                      }}
                      disabled={loading || (!effectiveAllowSetManagement && !!loggedSet)}
                      className="flex items-center justify-center"
                      title={isWarmup ? 'Aufwärmen' : 'Arbeit'}
                    >
                      <Badge variant={isWarmup ? 'outline' : 'default'} className="p-0.5">
                        {isWarmup ? <IconFlame className="size-4" /> : <IconBarbell className="size-4" />}
                      </Badge>
                    </button>

                    {/* Weight cell - always input style; for logged: live editable via updateSet */}
                    <Input
                      type="number"
                      step="0.5"
                      value={isEditingThis ? editingValues.weight : (loggedSet ? loggedSet.weight.toString() : getEditValue(setNumber, 'weight'))}
                      onChange={(e) => handleRowValueChange(setNumber, loggedSet ?? null, 'weight', e.target.value)}
                      onBlur={commitIfNeeded}
                      placeholder="0"
                      className="h-7 text-sm tabular-nums"
                      disabled={loading}
                      onPointerDown={e => e.stopPropagation()}
                    />

                    {/* Reps cell - always input style; for logged: live editable via updateSet */}
                    <Input
                      type="number"
                      value={isEditingThis ? editingValues.reps : (loggedSet ? loggedSet.reps.toString() : getEditValue(setNumber, 'reps'))}
                      onChange={(e) => handleRowValueChange(setNumber, loggedSet ?? null, 'reps', e.target.value)}
                      onBlur={commitIfNeeded}
                      placeholder="0"
                      className="h-7 text-sm tabular-nums"
                      disabled={loading}
                      onPointerDown={e => e.stopPropagation()}
                    />

                    {/* RIR cell - always input style; for logged: live editable via updateSet */}
                    <Input
                      type="number"
                      value={isEditingThis ? editingValues.rir : (loggedSet ? (loggedSet.rir != null ? loggedSet.rir.toString() : '') : getEditValue(setNumber, 'rir'))}
                      onChange={(e) => handleRowValueChange(setNumber, loggedSet ?? null, 'rir', e.target.value)}
                      onBlur={commitIfNeeded}
                      placeholder=""
                      className="h-7 text-sm tabular-nums"
                      disabled={loading}
                      onPointerDown={e => e.stopPropagation()}
                    />

                    {/* Check / actions cell - show check in active, or delete button for sets in setManagement (blueprint) */}
                    {(showCheckColumn || (effectiveAllowSetManagement && loggedSet)) && (
                      <div className="flex justify-end">
                        {showCheckColumn ? (
                          loggedSet ? (
                            <button disabled={loading} className="p-0.5" title="Geloggt (nicht entloggen möglich; Swipe RTL zum Löschen)">
                              <IconCheck className="size-4 text-foreground stroke-[3]" />
                            </button>
                          ) : (
                            <button onClick={() => handleLogSet(setNumber)} disabled={loading} className="p-0.5" title="Satz loggen (oder Swipe LTR)">
                              <IconCheck className="size-4 text-muted-foreground/60 hover:text-primary" />
                            </button>
                          )
                        ) : null}
                        {effectiveAllowSetManagement && loggedSet && onRemoveSet && (
                          <button
                            onClick={() => onRemoveSet(exercise.id, loggedSet.id)}
                            disabled={loading}
                            className="p-0.5 text-destructive"
                            title="Satz löschen"
                            onPointerDown={e => e.stopPropagation()}
                          >
                            <IconTrash className="size-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Extra sets (logged extras + unlogged additional drafts) in correct ascending setNumber order.
               This ensures that newly added unplanned sets always appear after previously logged unplanned sets (at the bottom of the extras section). */}
            {(() => {
              const draftNumbers = additionalSetNumbers.filter((n) => !getLoggedSet(n));
              const loggedExtraSets = exercise.sets
                .filter((s) => !hasPlannedSets || !exercise.plannedSets!.some((p) => p.order === s.setNumber))
                .sort((a, b) => a.setNumber - b.setNumber);

              const allExtraNumbers = Array.from(
                new Set([
                  ...draftNumbers,
                  ...loggedExtraSets.map((s) => s.setNumber),
                ])
              ).sort((a, b) => a - b);

              return allExtraNumbers.map((setNumber) => {
                const loggedSet = getLoggedSet(setNumber);
                const isDraft = draftNumbers.includes(setNumber) && !loggedSet;
                if (isDraft) {
                  return renderDraftRow(setNumber);
                }
                if (loggedSet) {
                  return renderLoggedExtraRow(loggedSet);
                }
                return null;
              });
            })()}

            {/* Add set button (table-like) - only if set management allowed */}
            {effectiveAllowSetManagement && (
              <Button variant="outline" onClick={() => {
                if (onAddSet) {
                  onAddSet(exercise.id);
                } else {
                  addAdditionalSet();
                }
              }} disabled={loading} className="w-full mt-2 border-dashed text-muted-foreground hover:text-foreground h-8">
                <IconPlus className="size-4 mr-2" />
                Satz hinzufügen
              </Button>
            )}

            {!hasPlannedSets && exercise.sets.length === 0 && additionalSetNumbers.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-2">Noch keine Sätze geloggt</p>
            )}
          </CardContent>
        )}
      </Card>

      {/* Delete Confirmation (AlertDialog, no X button, consistent with other modals) */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={(open) => !open && setShowDeleteConfirm(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Übung entfernen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchtest du <strong>{exercise.exerciseName}</strong> und alle zugehörigen Sätze entfernen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveExercise}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? 'Wird entfernt...' : 'Entfernen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Replace Exercise Modal (shadcn Dialog, controlled) */}
      <ExerciseSelectionModal
        open={showReplaceModal}
        onOpenChange={setShowReplaceModal}
        onSelect={handleReplaceExercise}
      />
    </>
  );
}
