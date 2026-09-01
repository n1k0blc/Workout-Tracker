'use client';

import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { ExerciseLog, SetLog, SetType, Exercise } from '@/types';
import { useWorkout } from '@/lib/workout-context';
import { getSetIndicatorSlots, resolveSetRows } from '@/lib/set-slots';
import { setPerSide, deriveSidesFromDrafts, type PerSideBreakdown } from '@/lib/set-sides';
import { canLogAdditionalSet } from '@/lib/log-set-guards';
import type { LogSetData } from '@/lib/workout-context';
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
  IconArrowsUpDown,
} from '@tabler/icons-react';

// TODO: This component mixes live execution logging/editing with presentation.
// Before extracting a shared WorkoutExercise component (with mode="execution"|"editor"|"review"),
// further separation of concerns may be useful. Unplanned live tracking removed (Phase 4).
//
// Key invariant after bugfix (reappear + timer + phantom history sets):
// - plannedSets are treated as immutable *initial defaults/suggestions* for execution flows.
// - "Delete" of an unlogged planned set during active/past tracking = session skip (via skippedPlannedSetNumbers).
// - Only controlled callers (templates/cycles via onRemoveSet) mutate plannedSets (they edit blueprints).
// - setActiveWorkoutDirectly no longer restarts live timers on patches.

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
  /**
   * `newExercise` is the catalogue entry the user actually picked, handed over so the receiver
   * does not have to look the id up again. A just-created custom exercise is not in any list
   * the receiver holds, so a lookup returns nothing and the swap loses the name and the
   * isUnilateral/isDoubleWeight flags.
   */
  onReplaceExercise?: (exerciseId: string, newExerciseId: string, newExercise?: Exercise) => void | Promise<void>;
  onAddSet?: (exerciseId: string) => void;
  onRemoveSet?: (exerciseId: string, setNumber: number) => void;
  onUpdateSet?: (
    exerciseId: string,
    setId: string,
    data: {
      reps?: number;
      weight?: number;
      rir?: number;
      setType?: SetType;
      // Per-side values for a unilateral set edited in the history editor (issue #105),
      // sent with the re-derived aggregate.
      repsLeft?: number;
      repsRight?: number;
      weightLeft?: number;
      weightRight?: number;
      rirLeft?: number;
      rirRight?: number;
    },
  ) => void | Promise<void>;
  /**
   * Write-back for editors that own a *plan* and have no logging concept (allowLogging=false),
   * so a planned row can be edited without first being materialized into a logged set.
   * Addressed by set number, because a planned set is identified by its position in the plan.
   * When absent the card keeps its previous behaviour: edits stay in local state until the row
   * is logged. Callers that still fabricate a logged twin (the blueprint editors) use
   * `onUpdateSet` and are unaffected.
   */
  onUpdatePlannedSet?: (
    exerciseId: string,
    setNumber: number,
    data: {
      reps?: number;
      weight?: number;
      rir?: number;
      setType?: SetType;
      // Per-side targets for a unilateral exercise's planned set (issue #103). Sent together
      // with the re-derived reps/weight/rir aggregate so the plan row stays consistent.
      repsLeft?: number;
      repsRight?: number;
      weightLeft?: number;
      weightRight?: number;
      rirLeft?: number;
      rirRight?: number;
    },
  ) => void;

  /** Pure view mode: everything read-only, no actions, no editing of values/types/sets */
  readonly?: boolean;

  /** Start expanded instead of collapsed -- for exercises just added this session, so the user isn't left guessing they need to add sets. */
  defaultOpen?: boolean;
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
  onUpdatePlannedSet,
  readonly,
  defaultOpen,
}: ExerciseCardProps) {
  // Derive effective flags. For 'active' everything is on.
  // For 'edit' the caller decides (History: all structural/logging off; Blueprint: structural on, logging off).
  const effectiveAllowReorder = allowReorder ?? (mode === 'active');
  const effectiveAllowExerciseActions = allowExerciseActions ?? (mode === 'active');
  const effectiveAllowSetManagement = allowSetManagement ?? (mode === 'active');
  const effectiveAllowLogging = allowLogging ?? (mode === 'active');
  const isReadonly = readonly ?? false;

  const {
    removeExercise: contextRemoveExercise,
    replaceExercise: contextReplaceExercise,
    logSet,
    updateSet: contextUpdateSet,
    loading,
    activeWorkout,
    setActiveWorkoutDirectly,
    isPastWorkout,
    pastWorkoutDuration,
    isHistoryEdit,
  } = useWorkout();

  // Prefer injected handlers (for decoupled template usage, no context hijack) over context
  const removeExercise = onRemoveExercise || contextRemoveExercise;
  const replaceExercise = onReplaceExercise || contextReplaceExercise;

  const [editValues, setEditValues] = useState<{[key: number]: {weight: string, reps: string, rir: string, setType: SetType}}>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(!defaultOpen);
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
  const hasLoggedSets = (exercise.sets || []).length > 0;

  const showCheckColumn = effectiveAllowLogging;
  const colTemplate = showCheckColumn
    ? 'grid-cols-[auto_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.7fr)_auto]'
    : 'grid-cols-[auto_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.7fr)]';

  // Read-only unilateral cards render each set as an L/R breakdown rather than the rounded
  // aggregate (issue #101); the column header collapses to match. Covers logged sets and
  // planned rows (the system-template view, the start-screen preview, the cycle review step
  // -- issue #103); a legacy row with no stored sides falls back to a symmetric breakdown.
  const showPerSideRows =
    isReadonly &&
    !!exercise.isUnilateral &&
    ((exercise.sets || []).length > 0 || (exercise.plannedSets || []).length > 0);

  // Local drafts for additional/extra sets (free workouts or sets beyond planned).
  // These are UI-only (not persisted in context) – backend only cares about final logs.
  const [additionalSetNumbers, setAdditionalSetNumbers] = useState<number[]>([]);

  // Locally skipped planned set numbers (for this workout execution only).
  // Allows "deleting" (hiding the row for) unlogged planned sets via RTL swipe.
  const [skippedPlannedSetNumbers, setSkippedPlannedSetNumbers] = useState<Set<number>>(new Set());

  // Swipe state for set rows (LTR = log if unlogged, RTL = discard unlogged draft).
  const [activeSwipe, setActiveSwipe] = useState<null | { key: string | number; startX: number; startY: number; offset: number }>(null);

  const initialEditCommitDone = useRef(false);

  // A caller that writes planned sets back itself (the plan editors: template, blueprint,
  // cycle-day) rather than materializing them into logged sets.
  const ownsPlan = !!onUpdatePlannedSet;

  // Per-side entry for unilateral exercises: two labelled sub-rows reusing the weight/reps/RIR
  // columns. Active-workout logging (issue #102), the plan editors (issue #103) and the history
  // editor (issue #105) all use it; read-only surfaces render a breakdown instead (#101).
  // `perSidePlanEntry` writes straight through `onUpdatePlannedSet`; `perSideEntry` buffers a
  // draft that is aggregated on log; `perSideHistoryEdit` writes each already-logged set's
  // sides straight back via `updateSet`, re-deriving the aggregate the same way the server does.
  const perSideEntry = !!exercise.isUnilateral && !isReadonly && !isHistoryEdit && effectiveAllowLogging;
  const perSidePlanEntry = !!exercise.isUnilateral && !isReadonly && ownsPlan;
  const perSideHistoryEdit = !!exercise.isUnilateral && !isReadonly && isHistoryEdit;
  const perSideCells = perSideEntry || perSidePlanEntry;

  // Which side renders first, and its label. Per-exercise, session-only, not persisted --
  // for people who start with the right. It never moves data: the sides stay in named fields.
  const [sidesSwapped, setSidesSwapped] = useState(false);
  const sideRows: ReadonlyArray<readonly ['L' | 'R', 'left' | 'right']> = sidesSwapped
    ? [['R', 'right'], ['L', 'left']]
    : [['L', 'left'], ['R', 'right']];
  const trailingSide: 'left' | 'right' = sidesSwapped ? 'left' : 'right';

  type SideDraft = { weight: string; reps: string; rir: string };
  type SetSideDraft = { left: SideDraft; right: SideDraft; trailingTouched: boolean };
  const [sideEdits, setSideEdits] = useState<{ [setNumber: number]: SetSideDraft }>({});

  // A fresh draft for a set. A planned set seeds each side from its per-side target when it
  // carries one (issue #103) -- so a workout started from an asymmetric plan prefills both
  // sides distinctly, and a left-to-right swipe logs them -- otherwise from the symmetric
  // aggregate. An additional set starts empty. `trailingTouched` starts set only when the
  // plan's two sides actually differ, so editing the leading side keeps auto-mirroring for a
  // symmetric plan (the #97 backfill fills equal sides) but does not clobber a real imbalance.
  const seedSideDraft = useCallback((setNumber: number): SetSideDraft => {
    const planned = exercise.plannedSets?.find((ps) => ps.order === setNumber);
    if (!planned) {
      return { left: { weight: '', reps: '', rir: '' }, right: { weight: '', reps: '', rir: '' }, trailingTouched: false };
    }
    const sides = setPerSide(planned);
    const str = (n: number | null | undefined) => (n != null ? n.toString() : '');
    const sideDraft = (s: { reps: number; weight: number; rir: number | null } | undefined): SideDraft => ({
      weight: str(s ? s.weight : planned.weight),
      reps: str(s ? s.reps : planned.reps),
      rir: str(s ? s.rir : planned.rir),
    });
    const sidesDiffer =
      sides != null &&
      (sides.left.reps !== sides.right.reps ||
        sides.left.weight !== sides.right.weight ||
        sides.left.rir !== sides.right.rir);
    return {
      left: sideDraft(sides?.left),
      right: sideDraft(sides?.right),
      trailingTouched: sidesDiffer,
    };
  }, [exercise.plannedSets]);

  const getSideDraft = (setNumber: number): SetSideDraft => sideEdits[setNumber] ?? seedSideDraft(setNumber);

  const handleSideChange = (setNumber: number, side: 'left' | 'right', field: keyof SideDraft, value: string) => {
    // Compute the next draft outside the state updater so it is available synchronously for
    // the plan write-back below -- capturing it *inside* the updater only works while React
    // runs updaters eagerly, which it does not once another update is already queued.
    const base = getSideDraft(setNumber);
    const isTrailing = side === trailingSide;
    const next: SetSideDraft = {
      ...base,
      [side]: { ...base[side], [field]: value },
      trailingTouched: base.trailingTouched || isTrailing,
    };
    // Auto-mirror: a value typed on the leading side ghost-fills the trailing side
    // until the trailing side is explicitly edited.
    if (!isTrailing && !next.trailingTouched) {
      next[trailingSide] = { ...next[trailingSide], [field]: value };
    }
    setSideEdits((prev) => ({ ...prev, [setNumber]: next }));
    // Plan editors own the plan: write the sides (and the re-derived aggregate) straight back
    // rather than waiting for a log that never happens (issue #103).
    if (perSidePlanEntry) {
      commitPlannedSides(setNumber, next);
    }
  };

  // Push a per-side draft to the plan owner: the six side fields plus the reps/weight/rir
  // aggregate, re-derived (`deriveSidesFromDrafts`) so the row stays internally consistent.
  const commitPlannedSides = (setNumber: number, draft: SetSideDraft) => {
    if (!onUpdatePlannedSet) return;
    const planned = exercise.plannedSets?.find((ps) => ps.order === setNumber);
    const d = deriveSidesFromDrafts(draft.left, draft.right, {
      reps: planned?.reps ?? 0,
      weight: planned?.weight ?? 0,
    });
    onUpdatePlannedSet(exercise.id, setNumber, {
      repsLeft: d.repsLeft,
      repsRight: d.repsRight,
      weightLeft: d.weightLeft,
      weightRight: d.weightRight,
      rirLeft: d.hasRir ? (d.rirLeft as number) : undefined,
      rirRight: d.hasRir ? (d.rirRight as number) : undefined,
      reps: d.reps,
      weight: d.weight,
      // RIR on a plan is a required single target: when both sides are cleared, keep the set's
      // existing RIR rather than dropping to 0 (train-to-failure) and wiping a visible value.
      rir: d.hasRir ? (d.rir as number) : (planned?.rir ?? 0),
    });
  };

  const clearSideEdits = (setNumber: number) => {
    setSideEdits((prev) => {
      if (!(setNumber in prev)) return prev;
      const next = { ...prev };
      delete next[setNumber];
      return next;
    });
  };

  // Per-side edits for an *already-logged* unilateral set in the history editor (issue #105),
  // keyed by set id. Seeded from the set's stored sides (or a symmetric split of its aggregate
  // for a set predating the #97 backfill); each side is independent -- no leading-side mirror,
  // the values already exist and the user is correcting a record.
  const [loggedSideEdits, setLoggedSideEdits] = useState<{ [setId: string]: SetSideDraft }>({});

  const seedLoggedSideDraft = (set: SetLog): SetSideDraft => {
    const sides = setPerSide(set) ?? symmetricBreakdown(set);
    const str = (n: number | null | undefined) => (n != null ? n.toString() : '');
    return {
      left: { weight: str(sides.left.weight), reps: str(sides.left.reps), rir: str(sides.left.rir) },
      right: { weight: str(sides.right.weight), reps: str(sides.right.reps), rir: str(sides.right.rir) },
      trailingTouched: true,
    };
  };

  const getLoggedSideDraft = (set: SetLog): SetSideDraft => loggedSideEdits[set.id] ?? seedLoggedSideDraft(set);

  // Write a logged set's per-side edit straight back through `updateSet`, together with the
  // reps/weight/rir aggregate re-derived (`deriveSidesFromDrafts`) by the same rule the
  // server applies on save, so the local draft and the payload stay internally consistent.
  const handleLoggedSideChange = (set: SetLog, side: 'left' | 'right', field: keyof SideDraft, value: string) => {
    const base = getLoggedSideDraft(set);
    const next: SetSideDraft = { ...base, [side]: { ...base[side], [field]: value }, trailingTouched: true };
    setLoggedSideEdits((prev) => ({ ...prev, [set.id]: next }));

    const d = deriveSidesFromDrafts(next.left, next.right, { reps: set.reps, weight: set.weight });
    const data = {
      repsLeft: d.repsLeft,
      repsRight: d.repsRight,
      weightLeft: d.weightLeft,
      weightRight: d.weightRight,
      rirLeft: d.hasRir ? (d.rirLeft as number) : undefined,
      rirRight: d.hasRir ? (d.rirRight as number) : undefined,
      reps: d.reps,
      weight: d.weight,
      // A logged set's RIR is optional: when both sides are cleared it becomes absent, and the
      // save path emits neither side (the server rejects RIR on one side alone).
      rir: d.hasRir ? (d.rir as number) : undefined,
    };
    if (onUpdateSet) onUpdateSet(exercise.id, set.id, data);
    else contextUpdateSet(set.id, data);
  };

  // A side has values once reps is entered and weight is a number -- weight 0 is a real
  // load for a bodyweight movement, so it must not gate the log control.
  const sideFilled = (d: SideDraft) => {
    const w = parseFloat(d.weight);
    return d.weight.trim() !== '' && !Number.isNaN(w) && w >= 0 && (parseInt(d.reps) || 0) > 0;
  };
  const bothSidesReady = (setNumber: number) => {
    const d = getSideDraft(setNumber);
    return sideFilled(d.left) && sideFilled(d.right);
  };

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
    // Defensive: if this planned slot was explicitly skipped (via RTL), do not log it
    // even if a deferred handle (e.g. from edit-mode auto on past tracking) is still firing.
    if (skippedPlannedSetNumbers.has(setNumber)) {
      return;
    }

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

    let setType: SetType = SetType.WORKING;
    let plannedRestAfterSet: number | undefined;
    if (plannedSet) {
      setType = editValues[setNumber]?.setType ?? plannedSet.setType;
      plannedRestAfterSet = plannedSet.rest;
    } else {
      setType = editValues[setNumber]?.setType ?? SetType.WORKING;
      plannedRestAfterSet = 90; // sensible default for extra sets
    }

    let payload: LogSetData;
    if (perSideEntry) {
      // One tick logs the whole set: both sides together, one completion time, one rest.
      if (!bothSidesReady(setNumber)) {
        console.warn('Cannot log a unilateral set until both sides have weight and reps');
        return;
      }
      const d = getSideDraft(setNumber);
      const rirOf = (s: SideDraft) => (s.rir.trim() === '' ? undefined : parseInt(s.rir));
      const rirLeft = rirOf(d.left);
      const rirRight = rirOf(d.right);
      const bothRir = rirLeft !== undefined && !Number.isNaN(rirLeft) && rirRight !== undefined && !Number.isNaN(rirRight);
      payload = {
        setNumber,
        // Aggregates are re-derived from the sides by logSet (and again by the server).
        reps: 0,
        weight: 0,
        repsLeft: parseInt(d.left.reps) || 0,
        repsRight: parseInt(d.right.reps) || 0,
        weightLeft: parseFloat(d.left.weight) || 0,
        weightRight: parseFloat(d.right.weight) || 0,
        rirLeft: bothRir ? rirLeft : undefined,
        rirRight: bothRir ? rirRight : undefined,
        setType,
        plannedRestAfterSet,
      };
    } else {
      let values: { weight: string; reps: string; rir: string };
      if (plannedSet) {
        values = {
          weight: editValues[setNumber]?.weight ?? plannedSet.weight.toString(),
          reps: editValues[setNumber]?.reps ?? plannedSet.reps.toString(),
          rir: editValues[setNumber]?.rir ?? plannedSet.rir.toString(),
        };
      } else {
        // Additional / free set: must come from seeded editValues (from addAdditionalSet)
        const ev = editValues[setNumber];
        if (!ev) return;
        const w = parseFloat(ev.weight || '0');
        const r = parseInt(ev.reps || '0');
        // 0 kg is a real load on a bodyweight movement (dips, pull-ups); reps must still be
        // non-zero, and every other exercise keeps the strict guard.
        if (!canLogAdditionalSet({ weight: w, reps: r, equipment: exercise.equipment })) {
          console.warn('Cannot log additional set with empty weight or reps');
          return;
        }
        values = { weight: ev.weight, reps: ev.reps, rir: ev.rir };
      }
      payload = {
        setNumber,
        weight: parseFloat(values.weight) || 0,
        reps: parseInt(values.reps) || 0,
        rir: values.rir ? parseInt(values.rir) : undefined,
        setType,
        plannedRestAfterSet,
      };
    }

    try {
      await logSet(exercise.id, payload);

      // Remove from additional drafts (if it was one)
      setAdditionalSetNumbers((prev) => prev.filter((n) => n !== setNumber));

      // Clear edit state + any skip marker for this setNumber (now logged)
      setEditValues((prev) => {
        const newVals = { ...prev };
        delete newVals[setNumber];
        return newVals;
      });
      clearSideEdits(setNumber);
      setSkippedPlannedSetNumbers((prev) => {
        const next = new Set(prev);
        next.delete(setNumber);
        return next;
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

  const handleReplaceExercise = async (newExerciseId: string, newExercise?: Exercise) => {
    if (hasLoggedSets && !onReplaceExercise) {
      console.warn('Cannot replace exercise after sets have been logged');
      setShowReplaceModal(false);
      return;
    }
    try {
      await replaceExercise(exercise.id, newExerciseId, newExercise);
      setShowReplaceModal(false);
      setIsCollapsed(false);
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
  // Skip:
  // - any setNumbers that have been explicitly discarded/skipped for this session
  // - COMPLETED workouts (history edit): we only edit existing performed sets; do not auto-materialize
  //   never-performed planned sets into the saved data.
  // `ownsPlan` gates this: a caller that writes planned sets back itself must not have them
  // materialized into logged ones behind its back -- for the template editor that would
  // recreate exactly the fabricated list this indirection removes.
  //
  // The guard is *not* `effectiveAllowLogging`, even though these callers all set it false:
  // past-workout tracking is also mode='edit' with allowLogging=false, and since its check
  // column and LTR swipe are both gated on that flag, this effect is the only thing that
  // logs its sets at all. Gating on the flag would make finishing a past workout save nothing.
  //
  // `!isReadonly` matters just as much: a pure view must never write. The read-only
  // system-template view is also mode='edit' and, being read-only, passes no
  // `onUpdatePlannedSet` -- so `ownsPlan` alone does not cover it. It used to be protected by
  // accident, because the template loader fabricated a logged twin for every planned set and
  // the `getLoggedSet` check below always short-circuited. That twin is gone, so without this
  // guard, merely *opening* a system template while a workout draft exists would log its
  // planned sets into that draft.
  const isCompletedHijack = isHistoryEdit;
  useEffect(() => {
    if (mode === 'edit' && !ownsPlan && !isReadonly && hasPlannedSets && !initialEditCommitDone.current && !isCompletedHijack) {
      initialEditCommitDone.current = true;
      exercise.plannedSets!.forEach((ps) => {
        const sn = ps.order;
        if (skippedPlannedSetNumbers.has(sn)) return;
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
  }, [mode, ownsPlan, isReadonly, hasPlannedSets, skippedPlannedSetNumbers, isCompletedHijack]);

  // Bars (collapsed) and planned rows (expanded) share one derivation -- see lib/set-slots.ts.
  // They agree on the planned segment only: `setIndicatorSlots` also covers logged extras and
  // unlogged drafts, which are rendered as their own rows further down, so with extras present
  // the bar count legitimately exceeds the planned row count.
  const setIndicatorSlots = getSetIndicatorSlots({
    plannedSets: exercise.plannedSets,
    sets: exercise.sets,
    additionalSetNumbers,
    skippedSetNumbers: skippedPlannedSetNumbers,
  });

  const setRows = resolveSetRows({
    plannedSets: exercise.plannedSets,
    sets: exercise.sets,
    skippedSetNumbers: skippedPlannedSetNumbers,
  });

  // Collapsed-bar warmup/working lookup: mirrors the expanded row's `currentType` derivation
  // below (keyed by setNumber instead of row index) so the two views can't disagree -- sourced
  // from the same tested `setRows` (lib/set-slots.ts), with an in-flight edit-value override for
  // unlogged planned sets, and a raw fallback for additional/extra sets outside the planned segment.
  const setTypeByNumber = new Map(setRows.map((row) => [row.setNumber, row.setType]));
  const getSlotSetType = (setNumber: number): SetType => {
    const loggedSet = getLoggedSet(setNumber);
    if (loggedSet) return loggedSet.setType ?? SetType.WORKING;
    const plannedType = setTypeByNumber.get(setNumber);
    return editValues[setNumber]?.setType ?? plannedType ?? SetType.WORKING;
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
    if (!isReadonly && offset > SWIPE_THRESHOLD && setNumber !== undefined && !isLogged && effectiveAllowLogging) {
      handleLogSet(setNumber);
    } else if (!isReadonly && offset < -(effectiveAllowSetManagement ? 50 : SWIPE_THRESHOLD) && setNumber !== undefined && effectiveAllowSetManagement && (!isLogged || !effectiveAllowLogging)) {
      discardUnloggedSet(setNumber);
    }
    // RTL on logged: no effect (cannot delete logged sets via swipe) — except in setManagement mode (blueprint/template), where we allow swipe delete for plan sets (even if represented in 'sets') regardless of 'logged' status. In active (allowLogging), only unlogged sets are deletable via swipe.
  };

  const discardUnloggedSet = (setNumber: number) => {
    // Clear any pending edits for this setNumber (reverts planned to defaults, clears additional)
    setEditValues(prev => {
      const newVals = { ...prev };
      delete newVals[setNumber];
      return newVals;
    });
    clearSideEdits(setNumber);

    const isPlannedSlot = hasPlannedSets && exercise.plannedSets?.some(ps => ps.order === setNumber);

    if (effectiveAllowSetManagement) {
      if (onRemoveSet) {
        // Controlled usage (template editor, cycle blueprint, etc.): mutate the plan directly.
        onRemoveSet(exercise.id, setNumber);
        // A controlled remove renumbers the survivors, so every *other* buffered edit is now
        // filed under the wrong set number and would render on the wrong row. Drop the whole
        // buffer rather than the one entry: it is only a display buffer for in-flight typing,
        // and a plan-owning caller has already been told about each change as it happened.
        if (ownsPlan) {
          setEditValues({});
          setSideEdits({});
        }
        setAdditionalSetNumbers(prev => prev.filter(n => n !== setNumber));
        setSkippedPlannedSetNumbers(prev => {
          const next = new Set(prev);
          next.delete(setNumber);
          return next;
        });
        return;
      }

      // Hijack / shared execution flows (active workout, past tracking, history edit of completed):
      // - plannedSets are *initial suggestions only*. Never mutate them here.
      // - For an unlogged planned set: just mark it skipped for this session (render filter hides the row).
      // - For already-logged sets or additional drafts: remove locally from sets (fully local now --
      //   there's no server round-trip until the final save, so this is always a plain local delete).
      if (isPlannedSlot && !getLoggedSet(setNumber)) {
        // Session-level skip of a planned suggestion. Survives server re-sync because we filter on render.
        setSkippedPlannedSetNumbers(prev => {
          const next = new Set(prev);
          next.add(setNumber);
          return next;
        });
        setAdditionalSetNumbers(prev => prev.filter(n => n !== setNumber));
        return;
      }

      // Remove from local sets (covers: removing an already-logged set in supported modes,
      // or cleaning an additional draft). Fully local -- no server round-trip until save.
      if (activeWorkout && setActiveWorkoutDirectly) {
        const updatedExercises = activeWorkout.exercises.map((ex: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
          if (ex.id !== exercise.id) return ex;
          return {
            ...ex,
            // Do not touch plannedSets for execution flows (see above)
            sets: (ex.sets || []).filter((s: any) => (s.setNumber ?? s.order) !== setNumber), // eslint-disable-line @typescript-eslint/no-explicit-any
          };
        });
        setActiveWorkoutDirectly(
          {
            ...activeWorkout,
            exercises: updatedExercises,
          } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
          isPastWorkout,
          pastWorkoutDuration
        );
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
      // For unlogged planned (pure active without setManagement flag): hide via skip.
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
      // Keep the raw string locally so the field shows what was typed (a half-entered "1"
      // of "10" must not render as 1), and push the parsed value to the owner of the plan.
      updateEditValue(setNumber, field, newValStr);
      if (onUpdatePlannedSet) {
        // A cleared field is 0 in the model, never `undefined`: the plan's fields are all
        // required numbers, and an `undefined` RIR would be copied as the *previous* set's
        // value by `addPlannedSet` while the row it came from still rendered blank.
        // The blank display is preserved by the local buffer above.
        const parsed =
          field === 'reps' || field === 'rir'
            ? (parseInt(newValStr) || 0)
            : (parseFloat(newValStr) || 0);
        onUpdatePlannedSet(exercise.id, setNumber, { [field]: parsed });
      }
    }
  };

  // Two stacked L/R sub-rows -- leading side then trailing -- reusing the card's weight/reps/RIR
  // columns rather than six inputs on one line (issue #102). Spans the three value columns; the
  // type icon and the ✓ stay in the outer grid's gutter/check columns. Shared by every per-side
  // entry surface: active logging (#102), the plan editors (#103) and the history editor (#105).
  const renderSideEntryCells = (
    draft: SetSideDraft,
    onChange: (side: 'left' | 'right', field: keyof SideDraft, value: string) => void,
    opts: { disabled: boolean; footer?: ReactNode },
  ) => (
    <div className="col-span-3 flex flex-col gap-1">
      {sideRows.map(([label, side]) => (
        <div
          key={side}
          className="grid grid-cols-[0.75rem_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.7fr)] items-center gap-x-2"
        >
          <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
          <Input
            type="number"
            step="0.5"
            inputMode="decimal"
            value={draft[side].weight}
            onChange={(e) => onChange(side, 'weight', e.target.value)}
            placeholder="0"
            className="h-7 text-base md:text-sm tabular-nums"
            disabled={opts.disabled}
          />
          <Input
            type="number"
            inputMode="numeric"
            value={draft[side].reps}
            onChange={(e) => onChange(side, 'reps', e.target.value)}
            placeholder="0"
            className="h-7 text-base md:text-sm tabular-nums"
            disabled={opts.disabled}
          />
          <Input
            type="number"
            inputMode="numeric"
            value={draft[side].rir}
            onChange={(e) => onChange(side, 'rir', e.target.value)}
            placeholder=""
            className="h-7 text-base md:text-sm tabular-nums"
            disabled={opts.disabled}
          />
        </div>
      ))}
      {opts.footer}
    </div>
  );

  const renderPerSideEntryCells = (setNumber: number) =>
    renderSideEntryCells(
      getSideDraft(setNumber),
      (side, field, value) => handleSideChange(setNumber, side, field, value),
      {
        disabled: loading || isReadonly,
        footer: showCheckColumn && !bothSidesReady(setNumber) && (
          <p className="text-[10px] text-muted-foreground">
            Beide Seiten mit Gewicht und Wdh ausfüllen, um den Satz zu loggen
          </p>
        ),
      },
    );

  // Editable L/R inputs for an already-logged unilateral set in the history editor (issue
  // #105), each side written straight back through `updateSet`.
  const renderLoggedSideEntryCells = (set: SetLog) =>
    renderSideEntryCells(
      getLoggedSideDraft(set),
      (side, field, value) => handleLoggedSideChange(set, side, field, value),
      { disabled: loading },
    );

  // A logged unilateral set is shown as a read-only L/R breakdown: the active card does not
  // edit a logged set's sides (discard via RTL swipe and re-log), and a rounded aggregate
  // would hide an asymmetric 10/9 set as "x 10" (issue #101/#102).
  const renderLoggedSideCells = (breakdown: PerSideBreakdown) => (
    <div className="col-span-3 flex flex-col gap-0.5 text-sm">
      {sideRows.map(([label, side]) => {
        const s = breakdown[side];
        return (
          <div key={side} className="flex items-center gap-2">
            <span className="w-3 text-xs text-muted-foreground">{label}</span>
            <span className="font-medium text-foreground tabular-nums">{s.weight} kg × {s.reps}</span>
            {s.rir !== null && <span className="text-xs text-muted-foreground">RIR {s.rir}</span>}
          </div>
        );
      })}
    </div>
  );

  // A read-only L/R view for a unilateral set that carries no stored per-side data (a plan
  // predating #103, or a set predating the #97 backfill): both sides read the aggregate.
  const symmetricBreakdown = (s: { reps: number; weight: number; rir?: number | null }): PerSideBreakdown => ({
    left: { reps: s.reps, weight: s.weight, rir: s.rir ?? null },
    right: { reps: s.reps, weight: s.weight, rir: s.rir ?? null },
  });

  // The ✓ for an unlogged set. For a unilateral set it stays disabled -- with the reason
  // shown in the row and on hover -- until both sides carry values (issue #102).
  const renderLogCheckButton = (setNumber: number) => {
    const waitingForSides = perSideEntry && !bothSidesReady(setNumber);
    return (
      <button
        onClick={() => handleLogSet(setNumber)}
        disabled={loading || waitingForSides}
        className="p-0.5 disabled:opacity-40"
        title={waitingForSides ? 'Beide Seiten ausfüllen, um den Satz zu loggen' : 'Satz loggen (oder Swipe LTR)'}
      >
        <IconCheck className="size-4 text-muted-foreground/60 hover:text-primary" />
      </button>
    );
  };

  // Render helpers for extra rows (used to render logged extras + unlogged drafts in a single sorted-by-setNumber list)
  const renderDraftRow = (setNumber: number) => {
    const gridClass = `grid ${colTemplate} items-center gap-x-2 py-1.5 border-b border-border last:border-b-0`;
    const isWarmup = getEditSetType(setNumber) === SetType.WARMUP;

    const swipeKey = `add-${setNumber}`;
    const swipeOffset = activeSwipe && activeSwipe.key === swipeKey ? activeSwipe.offset : 0;
    const swipeClass = swipeOffset > 0 ? 'bg-primary/5' : swipeOffset < 0 ? 'bg-destructive/5' : '';

    const commitIfNeeded = () => {
      if (mode === 'edit' && !ownsPlan && !isReadonly && !getLoggedSet(setNumber) && !isCompletedHijack) {
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
              if (!isReadonly) {
                const next = isWarmup ? SetType.WORKING : SetType.WARMUP;
                updateEditValue(setNumber, 'setType', next);
              }
            }}
            disabled={loading || isReadonly}
            className="flex items-center justify-center"
            title={isWarmup ? 'Aufwärmen' : 'Arbeit'}
          >
            <Badge variant={isWarmup ? 'outline' : 'default'} className="p-0.5">
              {isWarmup ? <IconFlame className="size-4" /> : <IconBarbell className="size-4" />}
            </Badge>
          </button>

          {perSideEntry ? (
            renderPerSideEntryCells(setNumber)
          ) : (
            <>
              <Input type="number" step="0.5" inputMode="decimal" value={getEditValue(setNumber, 'weight')} onChange={(e) => handleRowValueChange(setNumber, null, 'weight', e.target.value)} onBlur={commitIfNeeded} placeholder="0" className="h-7 text-base md:text-sm tabular-nums" disabled={loading || isReadonly} readOnly={isReadonly} />
              <Input type="number" inputMode="numeric" value={getEditValue(setNumber, 'reps')} onChange={(e) => handleRowValueChange(setNumber, null, 'reps', e.target.value)} onBlur={commitIfNeeded} placeholder="0" className="h-7 text-base md:text-sm tabular-nums" disabled={loading || isReadonly} readOnly={isReadonly} />
              <Input type="number" inputMode="numeric" value={getEditValue(setNumber, 'rir')} onChange={(e) => handleRowValueChange(setNumber, null, 'rir', e.target.value)} onBlur={commitIfNeeded} placeholder="" className="h-7 text-base md:text-sm tabular-nums" disabled={loading || isReadonly} readOnly={isReadonly} />
            </>
          )}

          {showCheckColumn && (
            <div className="flex justify-end">{renderLogCheckButton(setNumber)}</div>
          )}
        </div>
      </div>
    );
  };

  const renderLoggedExtraRow = (set: SetLog) => {
    const gridClass = `grid ${colTemplate} items-center gap-x-2 py-1.5 border-b border-border last:border-b-0`;
    const isWarmup = set.setType === SetType.WARMUP;
    const isEditingThis = editingSetId === set.id;
    // A unilateral set shows both sides: `reps` is a rounded average, so a 10/9 set
    // would otherwise render as "× 10" and hide the imbalance. Read-only surfaces (#101)
    // and the active card once the set is logged (#102) render a breakdown; the history
    // editor renders editable per-side inputs instead (#105, handled below).
    const perSide =
      (perSideEntry || isReadonly) && exercise.isUnilateral
        ? setPerSide(set) ?? (isReadonly ? symmetricBreakdown(set) : null)
        : null;

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
                if (!isReadonly) {
                  const next = isWarmup ? SetType.WORKING : SetType.WARMUP;
                  if (onUpdateSet) {
                    onUpdateSet(exercise.id, set.id, { setType: next });
                  } else {
                    // contextUpdateSet requires the current reps/weight (backend validation),
                    // so we send the full current values + the setType change
                    contextUpdateSet(set.id, {
                      reps: set.reps,
                      weight: set.weight,
                      rir: set.rir,
                      setType: next,
                    });
                  }
                }
              }}
              disabled={loading || isReadonly}
              className="flex items-center justify-center"
              title={isWarmup ? 'Aufwärmen' : 'Arbeit'}
            >
              <Badge variant={isWarmup ? 'outline' : 'default'} className="p-0.5">
                {isWarmup ? <IconFlame className="size-4" /> : <IconBarbell className="size-4" />}
              </Badge>
            </button>
          </div>

          {/* Value cells - always inputs for consistent layout; live edit for logged via updateSet.
              Read-only unilateral sets replace the trio with an L/R breakdown (issue #101);
              the history editor replaces it with editable L/R inputs (issue #105). */}
          {perSideHistoryEdit ? (
            renderLoggedSideEntryCells(set)
          ) : perSide ? (
            renderLoggedSideCells(perSide)
          ) : (
            <>
              <Input
                type="number"
                step="0.5"
                inputMode="decimal"
                value={isEditingThis ? editingValues.weight : set.weight.toString()}
                onChange={(e) => handleRowValueChange(set.setNumber, set, 'weight', e.target.value)}
                placeholder="0"
                className="h-7 text-base md:text-sm tabular-nums"
                disabled={loading || isReadonly}
                readOnly={isReadonly}
              />
              <Input
                type="number"
                inputMode="numeric"
                value={isEditingThis ? editingValues.reps : set.reps.toString()}
                onChange={(e) => handleRowValueChange(set.setNumber, set, 'reps', e.target.value)}
                placeholder="0"
                className="h-7 text-base md:text-sm tabular-nums"
                disabled={loading || isReadonly}
                readOnly={isReadonly}
              />
              <Input
                type="number"
                inputMode="numeric"
                value={isEditingThis ? editingValues.rir : (set.rir != null ? set.rir.toString() : '')}
                onChange={(e) => handleRowValueChange(set.setNumber, set, 'rir', e.target.value)}
                placeholder=""
                className="h-7 text-base md:text-sm tabular-nums"
                disabled={loading || isReadonly}
                readOnly={isReadonly}
              />
            </>
          )}

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
                {setIndicatorSlots.map((slot, i) => {
                  // For blueprint/template edit (!allowLogging), always show as "unlogged" (gray) since there's no logging concept.
                  const logged = effectiveAllowLogging && !!getLoggedSet(slot);
                  const isWarmup = getSlotSetType(slot) === SetType.WARMUP;
                  return (
                    <div
                      key={i}
                      className={`h-[2.5px] rounded-[1px] transition-colors ${isWarmup ? 'w-2' : 'w-4'} ${logged ? 'bg-foreground' : 'bg-muted-foreground/30'}`}
                      title={`Satz ${slot}${isWarmup ? ' (Aufwärmen)' : ''}${logged ? ' geloggt' : ''}`}
                    />
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            {/* Swap which side is entered first (issue #102/#103). Per-exercise, session-only,
                not persisted -- it flips the display order, the sides stay in named fields. */}
            {perSideCells && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidesSwapped((v) => !v)}
                onPointerDown={(e) => e.stopPropagation()}
                className="size-8"
                aria-pressed={sidesSwapped}
                title={sidesSwapped ? 'Wieder mit links beginnen' : 'Mit rechts beginnen'}
              >
                <IconArrowsUpDown className="size-4" />
              </Button>
            )}
            {/* Replace Exercise Button - only if allowed and not readonly.
                Disabled (and blocked) once sets have been logged for this exercise,
                because the backend (and performed data model) forbids replacing after logging.
                In controlled blueprint editors (onReplaceExercise provided) we still allow it. */}
            {!isReadonly && effectiveAllowExerciseActions && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowReplaceModal(true)}
                onPointerDown={(e) => e.stopPropagation()}
                className="size-8"
                disabled={hasLoggedSets && !onReplaceExercise}
                title={hasLoggedSets && !onReplaceExercise ? 'Übung kann nicht ausgetauscht werden, wenn bereits Sätze geloggt wurden' : 'Übung austauschen'}
              >
                <IconRefresh className="size-4" />
              </Button>
            )}
            {/* Delete Exercise Button - only if allowed and not readonly */}
            {!isReadonly && effectiveAllowExerciseActions && (
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
              {showPerSideRows ? (
                <div className="col-span-3">Links / Rechts</div>
              ) : (
                <>
                  <div>Gewicht{exercise.isDoubleWeight ? ' (2x)' : ''}</div>
                  <div>Wdh</div>
                  <div>RIR</div>
                </>
              )}
              {showCheckColumn && <div className="text-center">✓</div>}
            </div>

            {/* Planned Sets as table rows (filter skipped unlogged ones) */}
            {hasPlannedSets && exercise.plannedSets!
              .filter(ps => !skippedPlannedSetNumbers.has(ps.order))
              .map((plannedSet, rowIdx) => {
              const setNumber = plannedSet.order;
              const loggedSet = getLoggedSet(setNumber);
              const isEditingThis = editingSetId === loggedSet?.id;
              // Unilateral: two entry sub-rows while unlogged, a read-only L/R breakdown once logged.
              const plannedRowPerSide = perSideEntry && loggedSet ? setPerSide(loggedSet) : null;
              // `setRows` is built from the same filtered planned list, so it is index-aligned
              // here: this row and the type resolved for it cannot come from different sets.
              const currentType = loggedSet
                ? setRows[rowIdx].setType
                : (editValues[setNumber]?.setType ?? setRows[rowIdx].setType);
              const isWarmup = currentType === SetType.WARMUP;

              const gridClass = `grid ${colTemplate} items-center gap-x-2 py-1.5 border-b border-border last:border-b-0`;

              const swipeKey = setNumber;
              const swipeOffset = activeSwipe && activeSwipe.key === swipeKey ? activeSwipe.offset : 0;
              const swipeClass = swipeOffset > 0 ? 'bg-primary/5' : swipeOffset < 0 ? 'bg-destructive/5' : '';

              const commitIfNeeded = () => {
                if (!isReadonly && mode === 'edit' && !ownsPlan && !loggedSet && !isCompletedHijack) {
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
                        if (!isReadonly) {
                          const next = isWarmup ? SetType.WORKING : SetType.WARMUP;
                          if (loggedSet) {
                            // Update already logged set (works for active after log, past tracking, template edit)
                            if (onUpdateSet) {
                              onUpdateSet(exercise.id, loggedSet.id, { setType: next });
                            } else {
                              // contextUpdateSet requires the current reps/weight (backend validation),
                              // so we send the full current values + the setType change
                              contextUpdateSet(loggedSet.id, {
                                reps: loggedSet.reps,
                                weight: loggedSet.weight,
                                rir: loggedSet.rir,
                                setType: next,
                              });
                            }
                          } else {
                            updateEditValue(setNumber, 'setType', next);
                            onUpdatePlannedSet?.(exercise.id, setNumber, { setType: next });
                          }
                        }
                      }}
                      disabled={loading || isReadonly}
                      className="flex items-center justify-center"
                      title={isWarmup ? 'Aufwärmen' : 'Arbeit'}
                    >
                      <Badge variant={isWarmup ? 'outline' : 'default'} className="p-0.5">
                        {isWarmup ? <IconFlame className="size-4" /> : <IconBarbell className="size-4" />}
                      </Badge>
                    </button>

                    {perSideEntry && plannedRowPerSide ? (
                      renderLoggedSideCells(plannedRowPerSide)
                    ) : isReadonly && exercise.isUnilateral && !loggedSet ? (
                      renderLoggedSideCells(setPerSide(plannedSet) ?? symmetricBreakdown(plannedSet))
                    ) : perSideCells && !loggedSet ? (
                      renderPerSideEntryCells(setNumber)
                    ) : (
                      <>
                        {/* Weight cell - always input style; for logged: live editable via updateSet */}
                        <Input
                          type="number"
                          step="0.5"
                          inputMode="decimal"
                          value={isEditingThis ? editingValues.weight : (loggedSet ? loggedSet.weight.toString() : getEditValue(setNumber, 'weight'))}
                          onChange={(e) => handleRowValueChange(setNumber, loggedSet ?? null, 'weight', e.target.value)}
                          onBlur={commitIfNeeded}
                          placeholder="0"
                          className="h-7 text-base md:text-sm tabular-nums"
                          disabled={loading || isReadonly}
                          readOnly={isReadonly}
                        />

                        {/* Reps cell - always input style; for logged: live editable via updateSet */}
                        <Input
                          type="number"
                          inputMode="numeric"
                          value={isEditingThis ? editingValues.reps : (loggedSet ? loggedSet.reps.toString() : getEditValue(setNumber, 'reps'))}
                          onChange={(e) => handleRowValueChange(setNumber, loggedSet ?? null, 'reps', e.target.value)}
                          onBlur={commitIfNeeded}
                          placeholder="0"
                          className="h-7 text-base md:text-sm tabular-nums"
                          disabled={loading || isReadonly}
                          readOnly={isReadonly}
                        />

                        {/* RIR cell - always input style; for logged: live editable via updateSet */}
                        <Input
                          type="number"
                          inputMode="numeric"
                          value={isEditingThis ? editingValues.rir : (loggedSet ? (loggedSet.rir != null ? loggedSet.rir.toString() : '') : getEditValue(setNumber, 'rir'))}
                          onChange={(e) => handleRowValueChange(setNumber, loggedSet ?? null, 'rir', e.target.value)}
                          onBlur={commitIfNeeded}
                          placeholder=""
                          className="h-7 text-base md:text-sm tabular-nums"
                          disabled={loading || isReadonly}
                          readOnly={isReadonly}
                        />
                      </>
                    )}

                    {/* Check / actions cell - only in active mode (no logging in edit mode).
                        Set deletion in blueprint mode is done via RTL swipe (like in active for unlogged sets). */}
                    {showCheckColumn && (
                      <div className="flex justify-end">
                        {loggedSet ? (
                          <button disabled={loading} className="p-0.5" title="Geloggt (nicht entloggen möglich; Swipe RTL zum Löschen)">
                            <IconCheck className="size-4 text-foreground stroke-[3]" />
                          </button>
                        ) : (
                          renderLogCheckButton(setNumber)
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

            {/* Add set button (table-like) - only if set management allowed and not readonly */}
            {!isReadonly && effectiveAllowSetManagement && (
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
        preselectMuscleFromExerciseId={exercise.exerciseId}
      />
    </>
  );
}
