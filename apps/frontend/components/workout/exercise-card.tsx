'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { ExerciseLog, SetLog, SetType, Exercise } from '@/types';
import { useWorkout } from '@/lib/workout-context';
import { getSetIndicatorSlots, resolveSetRows } from '@/lib/set-slots';
import { setPerSide, deriveSidesFromDrafts, type PerSideBreakdown } from '@/lib/set-sides';
import {
  checkSetForLogging,
  rirNeedsHint,
  firstEarlierUnresolvedSet,
  type SetFieldKey,
  type SetFieldValues,
  type SetProblem,
} from '@/lib/log-set-guards';
import { notify } from '@/lib/toast';
import { seedAddedSetValues } from '@/lib/add-set-seed';
import type { LogSetData } from '@/lib/workout-context';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ExerciseSelectionModal from './exercise-selection-modal';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { FieldError, FieldWarning } from '@/components/ui/field';
import { WeightInput } from './weight-input';
import { useUnits } from '@/lib/use-units';
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
  /**
   * Deletion of an *already-logged* set for a caller that owns its workout state and must not
   * reach the shared workout context -- the injected-handler counterpart to `onRemoveSet`
   * (which mutates a *plan*), completing the set of escape hatches so `ExerciseCard` never
   * writes the context behind a state-owning editor's back (issue #126). Addressed by set
   * number to match `onRemoveSet`; reached only with `allowSetManagement` on, like its
   * siblings. When absent the card falls back to the context's direct-set path, as the
   * active-workout and past-tracking flows do.
   */
  onDeleteSet?: (exerciseId: string, setNumber: number) => void;
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
  onDeleteSet,
  onUpdateSet,
  onUpdatePlannedSet,
  readonly,
  defaultOpen,
}: ExerciseCardProps) {
  const t = useTranslations('ExerciseCard');
  const units = useUnits();

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

  // Fields of an unlogged row the user has been told about (#227): after a refused log attempt,
  // or after the row switched back to working. A marked field shows its error exactly as long as
  // it stays invalid, so fixing it clears the error with no bookkeeping in the change handlers.
  const [markedFields, setMarkedFields] = useState<{ [setNumber: number]: SetFieldKey[] }>({});
  // Logged sets the user changed in the history editor. Old sets may lack RIR (the server never
  // required it), so only a set the user touches is held to the rules.
  const [touchedLoggedIds, setTouchedLoggedIds] = useState<Set<string>>(new Set());

  // A caller that writes planned sets back itself (the plan editors: template, blueprint,
  // cycle-day) rather than materializing them into logged sets.
  const ownsPlan = !!onUpdatePlannedSet;

  // A caller that edits already-logged sets in place through an injected handler and has no
  // logging concept -- i.e. the history editor (issue #126), which owns its own workout state
  // and passes `onUpdateSet` instead of touching the shared context. Past tracking also lacks
  // a logging concept but writes through the context, so `!!onUpdateSet` tells the two apart.
  const editsLoggedSets = !!onUpdateSet && !effectiveAllowLogging && !ownsPlan && !isReadonly;

  // Per-side entry for unilateral exercises: two labelled sub-rows reusing the weight/reps/RIR
  // columns. Active-workout logging (issue #102), the plan editors (issue #103) and the history
  // editor (issue #105) all use it; read-only surfaces render a breakdown instead (#101).
  // `perSidePlanEntry` writes straight through `onUpdatePlannedSet`; `perSideEntry` buffers a
  // draft that is aggregated on log; `perSideLoggedEdit` writes each already-logged set's
  // sides straight back via `onUpdateSet`/the context, re-deriving the aggregate the same way
  // the server does.
  const perSideEntry = !!exercise.isUnilateral && !isReadonly && effectiveAllowLogging;
  const perSidePlanEntry = !!exercise.isUnilateral && !isReadonly && ownsPlan;
  // Editing an already-logged set's sides in place: the history editor (issue #105) and the
  // active card once the set is logged. A logged *bilateral* set has always stayed editable
  // through its inputs; a unilateral one used to freeze into a read-only L/R breakdown here,
  // which left no way to correct a typo short of deleting and re-logging the set.
  const perSideLoggedEdit =
    !!exercise.isUnilateral && !isReadonly && (editsLoggedSets || effectiveAllowLogging);
  const perSideCells = perSideEntry || perSidePlanEntry;

  // Which side renders first, and its label. Per-exercise, session-only, not persisted --
  // for people who start with the right. It never moves data: the sides stay in named fields.
  const [sidesSwapped, setSidesSwapped] = useState(false);
  const sideLabel = { L: t('sideLeft'), R: t('sideRight') };
  const sideRows: ReadonlyArray<readonly [string, 'left' | 'right']> = sidesSwapped
    ? [[sideLabel.R, 'right'], [sideLabel.L, 'left']]
    : [[sideLabel.L, 'left'], [sideLabel.R, 'right']];
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
    // A planned working set needs an RIR on both sides; with either side cleared the plan holds
    // none (a field error shows, and the editor's save is blocked) rather than a silently filled
    // or zeroed value.
    const hasPlanRir = d.hasRir && draft.left.rir.trim() !== '' && draft.right.rir.trim() !== '';
    onUpdatePlannedSet(exercise.id, setNumber, {
      repsLeft: d.repsLeft,
      repsRight: d.repsRight,
      weightLeft: d.weightLeft,
      weightRight: d.weightRight,
      rirLeft: hasPlanRir ? (d.rirLeft as number) : undefined,
      rirRight: hasPlanRir ? (d.rirRight as number) : undefined,
      reps: d.reps,
      weight: d.weight,
      rir: hasPlanRir ? (d.rir as number) : undefined,
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
    setTouchedLoggedIds((prev) => new Set(prev).add(set.id));

    const d = deriveSidesFromDrafts(next.left, next.right, { reps: set.reps, weight: set.weight });
    // RIR is on both sides or neither (the server rejects it on one side alone). With either
    // side cleared the set has none, and the field error says so.
    const hasRir = d.hasRir && next.left.rir.trim() !== '' && next.right.rir.trim() !== '';
    const data = {
      repsLeft: d.repsLeft,
      repsRight: d.repsRight,
      weightLeft: d.weightLeft,
      weightRight: d.weightRight,
      rirLeft: hasRir ? (d.rirLeft as number) : undefined,
      rirRight: hasRir ? (d.rirRight as number) : undefined,
      reps: d.reps,
      weight: d.weight,
      rir: hasRir ? (d.rir as number) : undefined,
    };
    if (onUpdateSet) onUpdateSet(exercise.id, set.id, data);
    else contextUpdateSet(set.id, data);
  };

  // The live workout (not past tracking, not the plan editors) logs sets in order (#227).
  const enforceSetOrder = mode === 'active' && effectiveAllowLogging && !isPastWorkout;

  // --- Field feedback (#227) -------------------------------------------------------------
  // Errors come from the same guard that blocks logging; this only decides which of them a row
  // shows. The card never keeps an error of its own, it recomputes from the row's values.
  type RowFeedback = { errors: SetProblem[]; warnings: Set<SetFieldKey> };

  const markFields = (setNumber: number, fields: SetFieldKey[]) =>
    setMarkedFields((prev) => ({ ...prev, [setNumber]: [...new Set([...(prev[setNumber] ?? []), ...fields])] }));

  /** What an unlogged row currently holds: the three inputs, or both sides of a unilateral row. */
  const unloggedValues = (setNumber: number): SetFieldValues | { left: SetFieldValues; right: SetFieldValues } => {
    if (perSideEntry || perSidePlanEntry) {
      const d = getSideDraft(setNumber);
      return { left: d.left, right: d.right };
    }
    return {
      weight: getEditValue(setNumber, 'weight'),
      reps: getEditValue(setNumber, 'reps'),
      rir: getEditValue(setNumber, 'rir'),
    };
  };

  /** What a logged row currently shows, including a half-typed edit. */
  const loggedValues = (set: SetLog): SetFieldValues | { left: SetFieldValues; right: SetFieldValues } => {
    if (perSideLoggedEdit) {
      const d = getLoggedSideDraft(set);
      return { left: d.left, right: d.right };
    }
    if (editingSetId === set.id) return editingValues;
    return {
      weight: set.weight.toString(),
      reps: set.reps.toString(),
      rir: set.rir != null ? set.rir.toString() : '',
    };
  };

  const buildFeedback = (
    setType: SetType,
    values: SetFieldValues | { left: SetFieldValues; right: SetFieldValues },
    show: (problem: SetProblem) => boolean,
  ): RowFeedback => {
    const errors = isReadonly
      ? []
      : checkSetForLogging({ setType, equipment: exercise.equipment, values }).filter(show);
    const warnings = new Set<SetFieldKey>();
    if (!isReadonly) {
      if ('left' in values) {
        if (rirNeedsHint(setType, values.left.rir)) warnings.add('left.rir');
        if (rirNeedsHint(setType, values.right.rir)) warnings.add('right.rir');
      } else if (rirNeedsHint(setType, values.rir)) {
        warnings.add('rir');
      }
    }
    return { errors, warnings };
  };

  /**
   * Which problems an unlogged row shows. The plan editors show a missing RIR at all times, since
   * a planned working set needs one and nothing else makes the editor's save fail visibly; a
   * logging row shows the fields the user was already told about.
   */
  const unloggedFeedback = (setNumber: number, setType: SetType): RowFeedback =>
    buildFeedback(setType, unloggedValues(setNumber), (p) =>
      ownsPlan ? p.field.endsWith('rir') : (markedFields[setNumber] ?? []).includes(p.field),
    );

  /**
   * A logged row shows a missing RIR (reachable by switching a warm-up to working) in the live
   * flows. In the history editor an old set may lack RIR, so a set is only held to the rules
   * once the user has changed it.
   */
  const loggedFeedback = (set: SetLog): RowFeedback =>
    buildFeedback(set.setType ?? SetType.WORKING, loggedValues(set), (p) =>
      editsLoggedSets ? touchedLoggedIds.has(set.id) : p.field.endsWith('rir'),
    );

  /** Spread on an input: the red error state, or the amber warning. */
  const feedbackProps = (fb: RowFeedback, rowKey: string, field: SetFieldKey) =>
    fb.errors.some((p) => p.field === field)
      ? ({ 'aria-invalid': true, 'aria-describedby': feedbackId(rowKey, field) } as const)
      : fb.warnings.has(field)
        ? ({ 'data-warning': true } as const)
        : ({} as const);

  const feedbackId = (rowKey: string, field: SetFieldKey) => `${exercise.id}-${rowKey}-${field}-error`;

  const fieldLabel = (p: SetProblem) => {
    const base = p.field.split('.').pop();
    const label = base === 'weight' ? t('columnWeight') : base === 'reps' ? t('columnReps') : t('columnRir');
    return p.field.startsWith('left.')
      ? `${label} (${t('sideLeft')})`
      : p.field.startsWith('right.')
        ? `${label} (${t('sideRight')})`
        : label;
  };

  const problemText = (p: SetProblem) => {
    const base = p.field.split('.').pop() as 'weight' | 'reps' | 'rir';
    const key = p.kind === 'zeroWeight' ? 'weightZero' : `${base}${p.kind === 'missing' ? 'Missing' : 'Invalid'}`;
    const text = t(`errors.${key}` as 'errors.weightZero', { unit: units.unit });
    return p.field.startsWith('left.')
      ? `${t('sideLeft')}: ${text}`
      : p.field.startsWith('right.')
        ? `${t('sideRight')}: ${text}`
        : text;
  };

  const renderRowFeedback = (rowKey: string, fb: RowFeedback) =>
    fb.errors.length === 0 && fb.warnings.size === 0 ? null : (
      <div className="px-1 pb-1.5 space-y-0.5">
        {fb.errors.map((p) => (
          <FieldError key={p.field} id={feedbackId(rowKey, p.field)} className="text-xs">
            {problemText(p)}
          </FieldError>
        ))}
        {fb.warnings.size > 0 && <FieldWarning className="text-xs">{t('rirHint')}</FieldWarning>}
      </div>
    );

  /**
   * Switching a set between warm-up and working (#227). A warm-up has no RIR, so switching to it
   * clears the RIR everywhere it lives; switching back leaves RIR empty, and the empty field is an
   * error (marked on an unlogged row, derived on a logged one) until the user enters one.
   */
  const switchSetType = (setNumber: number, loggedSet: SetLog | undefined, next: SetType) => {
    if (isReadonly) return;
    const toWarmup = next === SetType.WARMUP;
    const noRir = { rir: undefined, rirLeft: undefined, rirRight: undefined };

    if (loggedSet) {
      setTouchedLoggedIds((prev) => new Set(prev).add(loggedSet.id));
      if (toWarmup) {
        setLoggedSideEdits((prev) => {
          if (!(loggedSet.id in prev)) return prev;
          const rest = { ...prev };
          delete rest[loggedSet.id];
          return rest;
        });
        if (editingSetId === loggedSet.id) setEditingValues((prev) => ({ ...prev, rir: '' }));
      }
      if (onUpdateSet) {
        onUpdateSet(exercise.id, loggedSet.id, toWarmup ? { setType: next, ...noRir } : { setType: next });
      } else {
        // contextUpdateSet requires the current reps/weight (backend validation),
        // so we send the full current values + the setType change
        contextUpdateSet(loggedSet.id, {
          reps: loggedSet.reps,
          weight: loggedSet.weight,
          rir: toWarmup ? undefined : loggedSet.rir,
          ...(toWarmup ? { rirLeft: undefined, rirRight: undefined } : {}),
          setType: next,
        });
      }
      return;
    }

    updateEditValue(setNumber, 'setType', next);
    if (toWarmup) {
      updateEditValue(setNumber, 'rir', '');
      if (perSideEntry || perSidePlanEntry) {
        const base = getSideDraft(setNumber);
        setSideEdits((prev) => ({
          ...prev,
          [setNumber]: { ...base, left: { ...base.left, rir: '' }, right: { ...base.right, rir: '' } },
        }));
      }
    } else {
      markFields(setNumber, ['rir', 'left.rir', 'right.rir']);
    }
    onUpdatePlannedSet?.(exercise.id, setNumber, toWarmup ? { setType: next, ...noRir } : { setType: next });
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

    // The new row arrives carrying the previous set's values (issue #111): the last logged set,
    // falling back to the last planned one, so a third set at the same weight x reps is one tap.
    // The set *type* is never copied -- an added set is always WORKING. With no previous set at
    // all the fields stay blank so the user types an estimate into the 0 placeholders.
    const seed = seedAddedSetValues(exercise.sets, exercise.plannedSets);
    const toStr = (n: number | null | undefined) => (n == null ? '' : n.toString());

    setAdditionalSetNumbers((prev) => [...prev, next]);
    setEditValues((prev) => ({
      ...prev,
      [next]: seed
        ? { weight: toStr(seed.weight), reps: toStr(seed.reps), rir: toStr(seed.rir), setType: SetType.WORKING }
        : { weight: '', reps: '', rir: '', setType: SetType.WORKING },
    }));

    // A unilateral card logs from the per-side draft, which seeds empty for a non-planned set --
    // so copy the previous set's sides across too, with the aggregate left for logSet to
    // re-derive. `trailingTouched` blocks the leading-side mirror from overwriting them.
    if (perSideEntry && seed) {
      setSideEdits((prev) => ({
        ...prev,
        [next]: {
          left: {
            weight: toStr(seed.weightLeft ?? seed.weight),
            reps: toStr(seed.repsLeft ?? seed.reps),
            rir: toStr(seed.rirLeft ?? seed.rir),
          },
          right: {
            weight: toStr(seed.weightRight ?? seed.weight),
            reps: toStr(seed.repsRight ?? seed.reps),
            rir: toStr(seed.rirRight ?? seed.rir),
          },
          trailingTouched: true,
        },
      }));
    }
  };

  /**
   * Logs one set. The tick, the swipe and the auto-commit when tracking a past workout all end
   * here, so they cannot disagree (#227). `silent` is the auto-commit: it fires on blur and on
   * mount, where a toast per half-filled row would only nag, so a set that fails the guard is
   * simply left unlogged.
   */
  const handleLogSet = async (setNumber: number, opts: { silent?: boolean } = {}) => {
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
    // Additional / free set: must come from seeded editValues (from addAdditionalSet)
    if (!plannedSet && !editValues[setNumber]) return;

    // In the live workout the sets of an Uebung are logged in order. A swiped-away set is no
    // longer among the slots, so it never blocks. Past tracking has no such order.
    if (enforceSetOrder) {
      const slots = getSetIndicatorSlots({
        plannedSets: exercise.plannedSets,
        sets: exercise.sets,
        additionalSetNumbers,
        skippedSetNumbers: skippedPlannedSetNumbers,
      });
      const blocking = firstEarlierUnresolvedSet(
        setNumber,
        slots,
        new Set(exercise.sets.map((s) => s.setNumber)),
      );
      if (blocking !== null) {
        if (!opts.silent) notify.warning(t('logOutOfOrder', { number: blocking }));
        return;
      }
    }

    const setType: SetType = editValues[setNumber]?.setType ?? plannedSet?.setType ?? SetType.WORKING;
    // Sensible default rest for extra sets
    const plannedRestAfterSet = plannedSet ? plannedSet.rest : 90;
    const isWarmup = setType === SetType.WARMUP;

    const values = unloggedValues(setNumber);
    const problems = checkSetForLogging({ setType, equipment: exercise.equipment, values });
    if (problems.length > 0) {
      if (!opts.silent) {
        markFields(setNumber, problems.map((p) => p.field));
        const missing = problems.filter((p) => p.kind === 'missing').map(fieldLabel);
        notify.warning(
          missing.length > 0
            ? t('logMissing', { fields: [...new Set(missing)].join(', ') })
            : t('logInvalid'),
        );
      }
      return;
    }

    let payload: LogSetData;
    if ('left' in values) {
      // One tick logs the whole set: both sides together, one completion time, one rest.
      payload = {
        setNumber,
        // Aggregates are re-derived from the sides by logSet (and again by the server).
        reps: 0,
        weight: 0,
        repsLeft: parseInt(values.left.reps),
        repsRight: parseInt(values.right.reps),
        weightLeft: parseFloat(values.left.weight),
        weightRight: parseFloat(values.right.weight),
        // A warm-up has no RIR, whatever a stale draft still holds.
        rirLeft: isWarmup ? undefined : parseInt(values.left.rir),
        rirRight: isWarmup ? undefined : parseInt(values.right.rir),
        setType,
        plannedRestAfterSet,
      };
    } else {
      payload = {
        setNumber,
        weight: parseFloat(values.weight),
        reps: parseInt(values.reps),
        rir: isWarmup ? undefined : parseInt(values.rir),
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
      setMarkedFields((prev) => {
        if (!(setNumber in prev)) return prev;
        const next = { ...prev };
        delete next[setNumber];
        return next;
      });
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
      // The in-flight typing buffer is keyed by set number, so the old exercise's half-typed
      // numbers would render on top of the incoming last-performance prefill. Drop the whole
      // buffer and its per-side twin -- the same thing a controlled plan restructure does.
      setEditValues({});
      setSideEdits({});
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
  // - the history editor (`editsLoggedSets`): it only edits existing performed sets and has no
  //   planned sets at all, so it must never auto-materialize anything into the saved data.
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
  useEffect(() => {
    if (mode === 'edit' && !ownsPlan && !isReadonly && hasPlannedSets && !initialEditCommitDone.current && !editsLoggedSets) {
      initialEditCommitDone.current = true;
      exercise.plannedSets!.forEach((ps) => {
        const sn = ps.order;
        if (skippedPlannedSetNumbers.has(sn)) return;
        if (!getLoggedSet(sn)) {
          // schedule to not run during render; the shared guard decides whether the row is
          // complete enough to log (0 kg included for Bodyweight), silently if it is not
          setTimeout(() => handleLogSet(sn, { silent: true }), 0);
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, ownsPlan, isReadonly, hasPlannedSets, skippedPlannedSetNumbers, editsLoggedSets]);

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

      // Shared execution flows (active workout, past tracking) and editors that own their
      // workout state (the history editor, via `onDeleteSet` -- issue #126):
      // - plannedSets are *initial suggestions only*. Never mutate them here.
      // - For an unlogged planned set: just mark it skipped for this session (render filter hides the row).
      // - For already-logged sets or additional drafts: remove them from the workout -- through
      //   the injected `onDeleteSet` when present, otherwise the context's direct-set path.
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
      if (onDeleteSet) {
        // Injected owner (history editor): never reach into the shared workout context.
        onDeleteSet(exercise.id, setNumber);
        setAdditionalSetNumbers(prev => prev.filter(n => n !== setNumber));
        setSkippedPlannedSetNumbers(prev => {
          const next = new Set(prev);
          next.delete(setNumber);
          return next;
        });
        return;
      }

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
      // The buffer this edit builds on: the one already open for this set, else the stored values.
      const base = editingSetId === loggedSet.id
        ? editingValues
        : {
            weight: loggedSet.weight.toString(),
            reps: loggedSet.reps.toString(),
            rir: loggedSet.rir != null ? loggedSet.rir.toString() : '',
          };
      const next = { ...base, [field]: newValStr };
      setEditingSetId(loggedSet.id);
      setEditingValues(next);
      setTouchedLoggedIds((prev) => new Set(prev).add(loggedSet.id));

      // A cleared RIR is absent (not 0, which means "to failure"); a cleared weight or reps is
      // 0, which the rules then flag as missing or invalid.
      const rirNumber = parseInt(next.rir);
      const data = {
        weight: parseFloat(next.weight) || 0,
        reps: parseInt(next.reps) || 0,
        rir: next.rir.trim() === '' || Number.isNaN(rirNumber) ? undefined : rirNumber,
      };
      if (onUpdateSet) {
        onUpdateSet(exercise.id, loggedSet.id, data);
      } else {
        contextUpdateSet(loggedSet.id, data);
      }
    } else {
      // Keep the raw string locally so the field shows what was typed (a half-entered "1"
      // of "10" must not render as 1), and push the parsed value to the owner of the plan.
      updateEditValue(setNumber, field, newValStr);
      if (onUpdatePlannedSet) {
        // A cleared reps or weight is 0 in the model. A cleared RIR is *absent*, never 0: 0 is
        // "to failure" and would be planned without the user choosing it (#227). The row shows a
        // field error until an RIR is entered, and the editor will not save without one.
        const rirNumber = parseInt(newValStr);
        const parsed =
          field === 'rir'
            ? (newValStr.trim() === '' || Number.isNaN(rirNumber) ? undefined : rirNumber)
            : field === 'reps'
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
  // A warm-up has no RIR, so its third column stays empty (#227).
  const renderSideEntryCells = (
    draft: SetSideDraft,
    onChange: (side: 'left' | 'right', field: keyof SideDraft, value: string) => void,
    opts: { disabled: boolean; showRir: boolean; feedback: RowFeedback; rowKey: string },
  ) => (
    <div className="col-span-3 flex flex-col gap-1">
      {sideRows.map(([label, side]) => (
        <div
          key={side}
          className="grid grid-cols-[0.75rem_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.7fr)] items-center gap-x-2"
        >
          <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
          <WeightInput
            inputMode="decimal"
            valueKg={draft[side].weight}
            onChangeKg={(kg) => onChange(side, 'weight', kg)}
            placeholder="0"
            className="h-7 text-base md:text-sm tabular-nums"
            disabled={opts.disabled}
            {...feedbackProps(opts.feedback, opts.rowKey, `${side}.weight`)}
          />
          <Input
            type="number"
            inputMode="numeric"
            value={draft[side].reps}
            onChange={(e) => onChange(side, 'reps', e.target.value)}
            placeholder="0"
            className="h-7 text-base md:text-sm tabular-nums"
            disabled={opts.disabled}
            {...feedbackProps(opts.feedback, opts.rowKey, `${side}.reps`)}
          />
          {opts.showRir ? (
            <Input
              type="number"
              inputMode="numeric"
              value={draft[side].rir}
              onChange={(e) => onChange(side, 'rir', e.target.value)}
              placeholder=""
              className="h-7 text-base md:text-sm tabular-nums"
              disabled={opts.disabled}
              {...feedbackProps(opts.feedback, opts.rowKey, `${side}.rir`)}
            />
          ) : (
            <span />
          )}
        </div>
      ))}
    </div>
  );

  const renderPerSideEntryCells = (setNumber: number, fb: RowFeedback, showRir: boolean) =>
    renderSideEntryCells(
      getSideDraft(setNumber),
      (side, field, value) => handleSideChange(setNumber, side, field, value),
      { disabled: loading || isReadonly, showRir, feedback: fb, rowKey: String(setNumber) },
    );

  // Editable L/R inputs for an already-logged unilateral set, each side written straight back
  // through `updateSet` (issue #105, and the active card).
  const renderLoggedSideEntryCells = (set: SetLog, fb: RowFeedback) =>
    renderSideEntryCells(
      getLoggedSideDraft(set),
      (side, field, value) => handleLoggedSideChange(set, side, field, value),
      {
        disabled: loading,
        showRir: (set.setType ?? SetType.WORKING) !== SetType.WARMUP,
        feedback: fb,
        rowKey: set.id,
      },
    );

  // A read-only L/R breakdown for surfaces that never edit (issue #101): a rounded aggregate
  // would hide an asymmetric 10/9 set as "x 10".
  const renderLoggedSideCells = (breakdown: PerSideBreakdown) => (
    <div className="col-span-3 flex flex-col gap-0.5 text-sm">
      {sideRows.map(([label, side]) => {
        const s = breakdown[side];
        return (
          <div key={side} className="flex items-center gap-2">
            <span className="w-3 text-xs text-muted-foreground">{label}</span>
            <span className="font-medium text-foreground tabular-nums">{units.weight(s.weight)} {units.unit} × {s.reps}</span>
            {s.rir !== null && <span className="text-xs text-muted-foreground">{t('rirLabel', { rir: s.rir })}</span>}
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

  // The ✓ for an unlogged set. Always active: an incomplete set answers with a toast and field
  // errors (the same guard as the swipe) instead of a dead button that cannot say why.
  const renderLogCheckButton = (setNumber: number) => (
    <button
      onClick={() => handleLogSet(setNumber)}
      disabled={loading}
      className="p-0.5 disabled:opacity-40"
      title={t('logSet')}
    >
      <IconCheck className="size-4 text-muted-foreground/60 hover:text-primary" />
    </button>
  );

  // Render helpers for extra rows (used to render logged extras + unlogged drafts in a single sorted-by-setNumber list)
  const renderDraftRow = (setNumber: number) => {
    const gridClass = `grid ${colTemplate} items-center gap-x-2 py-1.5 border-b border-border last:border-b-0`;
    const setType = getEditSetType(setNumber);
    const isWarmup = setType === SetType.WARMUP;
    const rowKey = String(setNumber);
    const fb = unloggedFeedback(setNumber, setType);

    const swipeKey = `add-${setNumber}`;
    const swipeOffset = activeSwipe && activeSwipe.key === swipeKey ? activeSwipe.offset : 0;
    const swipeClass = swipeOffset > 0 ? 'bg-primary/5' : swipeOffset < 0 ? 'bg-destructive/5' : '';

    const commitIfNeeded = () => {
      if (mode === 'edit' && !ownsPlan && !isReadonly && !getLoggedSet(setNumber) && !editsLoggedSets) {
        handleLogSet(setNumber, { silent: true });
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
            onClick={() => switchSetType(setNumber, undefined, isWarmup ? SetType.WORKING : SetType.WARMUP)}
            disabled={loading || isReadonly}
            className="flex items-center justify-center"
            title={isWarmup ? t('setTypeWarmup') : t('setTypeWorking')}
          >
            <Badge variant={isWarmup ? 'outline' : 'default'} className="p-0.5">
              {isWarmup ? <IconFlame className="size-4" /> : <IconBarbell className="size-4" />}
            </Badge>
          </button>

          {perSideEntry ? (
            renderPerSideEntryCells(setNumber, fb, !isWarmup)
          ) : (
            <>
              <WeightInput inputMode="decimal" valueKg={getEditValue(setNumber, 'weight')} onChangeKg={(kg) => handleRowValueChange(setNumber, null, 'weight', kg)} onBlur={commitIfNeeded} placeholder="0" className="h-7 text-base md:text-sm tabular-nums" disabled={loading || isReadonly} readOnly={isReadonly} {...feedbackProps(fb, rowKey, 'weight')} />
              <Input type="number" inputMode="numeric" value={getEditValue(setNumber, 'reps')} onChange={(e) => handleRowValueChange(setNumber, null, 'reps', e.target.value)} onBlur={commitIfNeeded} placeholder="0" className="h-7 text-base md:text-sm tabular-nums" disabled={loading || isReadonly} readOnly={isReadonly} {...feedbackProps(fb, rowKey, 'reps')} />
              {isWarmup ? (
                <span />
              ) : (
                <Input type="number" inputMode="numeric" value={getEditValue(setNumber, 'rir')} onChange={(e) => handleRowValueChange(setNumber, null, 'rir', e.target.value)} onBlur={commitIfNeeded} placeholder="" className="h-7 text-base md:text-sm tabular-nums" disabled={loading || isReadonly} readOnly={isReadonly} {...feedbackProps(fb, rowKey, 'rir')} />
              )}
            </>
          )}

          {showCheckColumn && (
            <div className="flex justify-end">{renderLogCheckButton(setNumber)}</div>
          )}
        </div>
        {renderRowFeedback(rowKey, fb)}
      </div>
    );
  };

  const renderLoggedExtraRow = (set: SetLog) => {
    const gridClass = `grid ${colTemplate} items-center gap-x-2 py-1.5 border-b border-border last:border-b-0`;
    const isWarmup = set.setType === SetType.WARMUP;
    const isEditingThis = editingSetId === set.id;
    const fb = loggedFeedback(set);
    // A unilateral set shows both sides: `reps` is a rounded average, so a 10/9 set
    // would otherwise render as "× 10" and hide the imbalance. Read-only surfaces render a
    // static breakdown (#101); everywhere the set is editable it gets per-side inputs
    // (#105 and the active card), handled by `perSideLoggedEdit` below.
    const perSide =
      isReadonly && exercise.isUnilateral
        ? setPerSide(set) ?? symmetricBreakdown(set)
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
              onClick={() => switchSetType(set.setNumber, set, isWarmup ? SetType.WORKING : SetType.WARMUP)}
              disabled={loading || isReadonly}
              className="flex items-center justify-center"
              title={isWarmup ? t('setTypeWarmup') : t('setTypeWorking')}
            >
              <Badge variant={isWarmup ? 'outline' : 'default'} className="p-0.5">
                {isWarmup ? <IconFlame className="size-4" /> : <IconBarbell className="size-4" />}
              </Badge>
            </button>
          </div>

          {/* Value cells - always inputs for consistent layout; live edit for logged via updateSet.
              Read-only unilateral sets replace the trio with an L/R breakdown (issue #101);
              editable ones replace it with per-side L/R inputs (issue #105). */}
          {perSideLoggedEdit ? (
            renderLoggedSideEntryCells(set, fb)
          ) : perSide ? (
            renderLoggedSideCells(perSide)
          ) : (
            <>
              <WeightInput
                inputMode="decimal"
                valueKg={isEditingThis ? editingValues.weight : set.weight.toString()}
                onChangeKg={(kg) => handleRowValueChange(set.setNumber, set, 'weight', kg)}
                placeholder="0"
                className="h-7 text-base md:text-sm tabular-nums"
                disabled={loading || isReadonly}
                readOnly={isReadonly}
                {...feedbackProps(fb, set.id, 'weight')}
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
                {...feedbackProps(fb, set.id, 'reps')}
              />
              {isWarmup ? (
                <span />
              ) : (
                <Input
                  type="number"
                  inputMode="numeric"
                  value={isEditingThis ? editingValues.rir : (set.rir != null ? set.rir.toString() : '')}
                  onChange={(e) => handleRowValueChange(set.setNumber, set, 'rir', e.target.value)}
                  placeholder=""
                  className="h-7 text-base md:text-sm tabular-nums"
                  disabled={loading || isReadonly}
                  readOnly={isReadonly}
                  {...feedbackProps(fb, set.id, 'rir')}
                />
              )}
            </>
          )}

          {/* Check cell - fat only, no buttons (delete via swipe) */}
          {showCheckColumn && (
            <div className="flex justify-end">
              <button disabled={loading} className="p-0.5" title={t('loggedTitle')}>
                <IconCheck className="size-4 text-foreground stroke-[3]" />
              </button>
            </div>
          )}
        </div>
        {renderRowFeedback(set.id, fb)}
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
                      title={
                        isWarmup
                          ? (logged ? t('setLabelWarmupLogged', { number: slot }) : t('setLabelWarmup', { number: slot }))
                          : (logged ? t('setLabelLogged', { number: slot }) : t('setLabel', { number: slot }))
                      }
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
                title={sidesSwapped ? t('unswapSides') : t('swapSides')}
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
                title={hasLoggedSets && !onReplaceExercise ? t('replaceExerciseDisabled') : t('replaceExercise')}
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
                title={t('removeExercise')}
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
                <div className="col-span-3">{t('columnSides')}</div>
              ) : (
                <>
                  <div>{exercise.isDoubleWeight ? t('columnWeightDouble') : t('columnWeight')}</div>
                  <div>{t('columnReps')}</div>
                  <div>{t('columnRir')}</div>
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
              // `setRows` is built from the same filtered planned list, so it is index-aligned
              // here: this row and the type resolved for it cannot come from different sets.
              const currentType = loggedSet
                ? setRows[rowIdx].setType
                : (editValues[setNumber]?.setType ?? setRows[rowIdx].setType);
              const isWarmup = currentType === SetType.WARMUP;
              const rowKey = String(setNumber);
              const fb = loggedSet ? loggedFeedback(loggedSet) : unloggedFeedback(setNumber, currentType);

              const gridClass = `grid ${colTemplate} items-center gap-x-2 py-1.5 border-b border-border last:border-b-0`;

              const swipeKey = setNumber;
              const swipeOffset = activeSwipe && activeSwipe.key === swipeKey ? activeSwipe.offset : 0;
              const swipeClass = swipeOffset > 0 ? 'bg-primary/5' : swipeOffset < 0 ? 'bg-destructive/5' : '';

              const commitIfNeeded = () => {
                if (!isReadonly && mode === 'edit' && !ownsPlan && !loggedSet && !editsLoggedSets) {
                  handleLogSet(setNumber, { silent: true });
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
                      onClick={() => switchSetType(setNumber, loggedSet, isWarmup ? SetType.WORKING : SetType.WARMUP)}
                      disabled={loading || isReadonly}
                      className="flex items-center justify-center"
                      title={isWarmup ? t('setTypeWarmup') : t('setTypeWorking')}
                    >
                      <Badge variant={isWarmup ? 'outline' : 'default'} className="p-0.5">
                        {isWarmup ? <IconFlame className="size-4" /> : <IconBarbell className="size-4" />}
                      </Badge>
                    </button>

                    {/* Unilateral: two entry sub-rows while unlogged, the same two as editable
                        per-side inputs once logged -- a logged row must stay correctable here
                        exactly as it is on the extra-set rows below. */}
                    {perSideLoggedEdit && loggedSet ? (
                      renderLoggedSideEntryCells(loggedSet, fb)
                    ) : isReadonly && exercise.isUnilateral && !loggedSet ? (
                      renderLoggedSideCells(setPerSide(plannedSet) ?? symmetricBreakdown(plannedSet))
                    ) : perSideCells && !loggedSet ? (
                      renderPerSideEntryCells(setNumber, fb, !isWarmup)
                    ) : (
                      <>
                        {/* Weight cell - always input style; for logged: live editable via updateSet */}
                        <WeightInput
                          inputMode="decimal"
                          valueKg={isEditingThis ? editingValues.weight : (loggedSet ? loggedSet.weight.toString() : getEditValue(setNumber, 'weight'))}
                          onChangeKg={(kg) => handleRowValueChange(setNumber, loggedSet ?? null, 'weight', kg)}
                          onBlur={commitIfNeeded}
                          placeholder="0"
                          className="h-7 text-base md:text-sm tabular-nums"
                          disabled={loading || isReadonly}
                          readOnly={isReadonly}
                          {...feedbackProps(fb, rowKey, 'weight')}
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
                          {...feedbackProps(fb, rowKey, 'reps')}
                        />

                        {/* RIR cell - always input style; for logged: live editable via updateSet.
                            A warm-up has no RIR, so it has no field. */}
                        {isWarmup ? (
                          <span />
                        ) : (
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
                            {...feedbackProps(fb, rowKey, 'rir')}
                          />
                        )}
                      </>
                    )}

                    {/* Check / actions cell - only in active mode (no logging in edit mode).
                        Set deletion in blueprint mode is done via RTL swipe (like in active for unlogged sets). */}
                    {showCheckColumn && (
                      <div className="flex justify-end">
                        {loggedSet ? (
                          <button disabled={loading} className="p-0.5" title={t('loggedTitle')}>
                            <IconCheck className="size-4 text-foreground stroke-[3]" />
                          </button>
                        ) : (
                          renderLogCheckButton(setNumber)
                        )}
                      </div>
                    )}
                  </div>
                  {renderRowFeedback(rowKey, fb)}
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
                {t('addSet')}
              </Button>
            )}

            {!hasPlannedSets && exercise.sets.length === 0 && additionalSetNumbers.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-2">{t('noSetsLogged')}</p>
            )}
          </CardContent>
        )}
      </Card>

      {/* Delete Confirmation (AlertDialog, no X button, consistent with other modals) */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={(open) => !open && setShowDeleteConfirm(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.rich('deleteDialog.description', {
                name: exercise.exerciseName,
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveExercise}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? t('deleteDialog.confirming') : t('deleteDialog.confirm')}
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
