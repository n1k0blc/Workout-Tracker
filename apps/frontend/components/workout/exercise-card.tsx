'use client';

import { useState } from 'react';
import { ExerciseLog, SetType } from '@/types';
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
  IconEdit,
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
}


export default function ExerciseCard({
  exercise,
  exerciseNumber,
}: ExerciseCardProps) {
  const { 
    removeExercise, 
    replaceExercise, 
    logSet, 
    deleteSet, 
    updateSet, 
    loading, 
  } = useWorkout();

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

  const hasPlannedSets = exercise.plannedSets && exercise.plannedSets.length > 0;

  // Local drafts for additional/extra sets (free workouts or sets beyond planned).
  // These are UI-only (not persisted in context) – backend only cares about final logs.
  const [additionalSetNumbers, setAdditionalSetNumbers] = useState<number[]>([]);

  // Swipe state for set rows (LTR = log if unlogged, RTL = delete if logged). Native pointer events for touch + mouse.
  const [activeSwipe, setActiveSwipe] = useState<null | { key: string | number; startX: number; startY: number; offset: number }>(null);

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

  const handleDeleteSet = async (setLogId: string) => {
    try {
      await deleteSet(setLogId);
    } catch (error) {
      console.error('Failed to delete set:', error);
    }
  };

  const handleEditSet = (setLog: { id: string; reps: number; weight: number; rir?: number }) => {
    setEditingSetId(setLog.id);
    setEditingValues({
      reps: setLog.reps.toString(),
      weight: setLog.weight.toString(),
      rir: setLog.rir !== undefined ? setLog.rir.toString() : '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingSetId) return;

    try {
      await updateSet(editingSetId, {
        reps: parseInt(editingValues.reps) || 0,
        weight: parseFloat(editingValues.weight) || 0,
        rir: editingValues.rir ? parseInt(editingValues.rir) : undefined,
      });
      setEditingSetId(null);
      setEditingValues({ reps: '', weight: '', rir: '' });
    } catch (error) {
      console.error('Failed to update set:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingSetId(null);
    setEditingValues({ reps: '', weight: '', rir: '' });
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


  const getLoggedSet = (setNumber: number) => {
    return exercise.sets.find(s => s.setNumber === setNumber);
  };

  const updateEditValue = (setNumber: number, field: 'weight' | 'reps' | 'rir' | 'setType', value: string | SetType) => {
    setEditValues(prev => ({
      ...prev,
      [setNumber]: {
        ...prev[setNumber],
        [field]: value,
      },
    }));
  };

  const getEditValue = (setNumber: number, field: 'weight' | 'reps' | 'rir'): string => {
    // Check if we have an edit value (including empty strings)
    if (editValues[setNumber] && editValues[setNumber][field] !== undefined) {
      return editValues[setNumber][field] as string;
    }
    // Fall back to planned set value (both setNumber and order are 1-based)
    const plannedSet = exercise.plannedSets?.find(ps => ps.order === setNumber);
    if (!plannedSet) return '';
    return plannedSet[field]?.toString() || '';
  };

  const getEditSetType = (setNumber: number): SetType => {
    if (editValues[setNumber]?.setType) {
      return editValues[setNumber].setType;
    }
    // Both setNumber and order are 1-based
    const plannedSet = exercise.plannedSets?.find(ps => ps.order === setNumber);
    return plannedSet?.setType || SetType.WORKING;
  };

  const getSetIndicatorSlots = (): number[] => {
    if (hasPlannedSets && exercise.plannedSets!.length > 0) {
      return exercise.plannedSets!.map((ps) => ps.order);
    }
    const maxLogged = exercise.sets.length > 0 ? Math.max(...exercise.sets.map((s) => s.setNumber)) : 0;
    const maxDraft = additionalSetNumbers.length > 0 ? Math.max(...additionalSetNumbers) : 0;
    const total = Math.max(maxLogged, maxDraft, 0);
    if (total === 0) return [];
    return Array.from({ length: total }, (_, i) => i + 1);
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
  const endSwipe = (key: string | number, logSetNumber?: number, deleteSetId?: string) => {
    if (!activeSwipe || activeSwipe.key !== key) {
      setActiveSwipe(null);
      return;
    }
    const offset = activeSwipe.offset;
    setActiveSwipe(null);
    if (offset > SWIPE_THRESHOLD && logSetNumber !== undefined) {
      handleLogSet(logSetNumber);
    } else if (offset < -SWIPE_THRESHOLD && deleteSetId) {
      handleDeleteSet(deleteSetId);
    }
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
          {/* Name area + indicators: long-press to drag-reorder; tap name to toggle collapse */}
          <div
            {...attributes}
            {...listeners}
            className="flex flex-col cursor-grab active:cursor-grabbing"
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
                  const logged = !!getLoggedSet(slot);
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
            {/* Replace Exercise Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowReplaceModal(true)}
              onPointerDown={(e) => e.stopPropagation()}
              disabled={exercise.sets.length > 0}
              className="size-8"
              title={exercise.sets.length > 0 ? "Übung kann nicht ausgetauscht werden nachdem Sets geloggt wurden" : "Übung austauschen"}
            >
              <IconRefresh className="size-4" />
            </Button>
            {/* Delete Exercise Button */}
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
          </div>
        </div>

        {/* Sets - table layout with swipe support */}
        {!isCollapsed && (
          <CardContent className="p-2 sm:p-3">
            {/* Compact column header (optional, saves space on mobile) */}
            <div className="grid grid-cols-[auto_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.7fr)_auto] items-center gap-x-2 px-1 pb-1 text-[10px] text-muted-foreground font-medium">
              <div></div>
              <div>Gewicht</div>
              <div>Wdh</div>
              <div>RIR</div>
              <div className="text-center">✓</div>
            </div>

            {/* Planned Sets as table rows */}
            {hasPlannedSets && exercise.plannedSets!.map((plannedSet) => {
              const setNumber = plannedSet.order;
              const loggedSet = getLoggedSet(setNumber);
              const isEditingThis = editingSetId === loggedSet?.id;
              const currentType = loggedSet ? loggedSet.setType : getEditSetType(setNumber);
              const isWarmup = currentType === SetType.WARMUP;

              const gridClass = "grid grid-cols-[auto_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.7fr)_auto] items-center gap-x-2 py-1.5 border-b border-border last:border-b-0";

              const swipeKey = setNumber;
              const swipeOffset = activeSwipe && activeSwipe.key === swipeKey ? activeSwipe.offset : 0;
              const swipeClass = swipeOffset > 0 ? 'bg-primary/5' : swipeOffset < 0 ? 'bg-destructive/5' : '';

              return (
                <div
                  key={plannedSet.id}
                  onPointerDown={(e) => startSwipe(swipeKey, e.clientX, e.clientY)}
                  onPointerMove={(e) => updateSwipe(e.clientX, e.clientY)}
                  onPointerUp={() => endSwipe(swipeKey, setNumber, loggedSet?.id)}
                  onPointerLeave={() => endSwipe(swipeKey, setNumber, loggedSet?.id)}
                  onPointerCancel={() => setActiveSwipe(null)}
                  style={swipeOffset !== 0 ? { transform: `translateX(${swipeOffset}px)` } : undefined}
                  className={`${swipeClass} transition-transform touch-pan-y`}
                >
                  <div className={gridClass}>
                    {/* Type cell: tappable icon for unlogged/editing to switch type */}
                    <button
                      type="button"
                      onClick={() => {
                        if (!loggedSet || isEditingThis) {
                          const next = isWarmup ? SetType.WORKING : SetType.WARMUP;
                          updateEditValue(setNumber, 'setType', next);
                        }
                      }}
                      disabled={loading || (!!loggedSet && !isEditingThis)}
                      className="flex items-center justify-center"
                      title={isWarmup ? 'Aufwärmen' : 'Arbeit'}
                    >
                      <Badge variant={isWarmup ? 'outline' : 'default'} className="p-0.5">
                        {isWarmup ? <IconFlame className="size-4" /> : <IconBarbell className="size-4" />}
                      </Badge>
                    </button>

                    {/* Weight cell */}
                    {loggedSet && !isEditingThis ? (
                      <span className="tabular-nums text-sm font-medium text-foreground">
                        {loggedSet.weight} <span className="text-[10px] text-muted-foreground">kg</span>
                        {exercise.isDoubleWeight && <span className="text-[10px] text-muted-foreground ml-0.5">(2x)</span>}
                      </span>
                    ) : (
                      <Input
                        type="number"
                        step="0.5"
                        value={isEditingThis ? editingValues.weight : getEditValue(setNumber, 'weight')}
                        onChange={(e) => {
                          if (isEditingThis) setEditingValues(prev => ({ ...prev, weight: e.target.value }));
                          else updateEditValue(setNumber, 'weight', e.target.value);
                        }}
                        placeholder="0"
                        className="h-7 text-sm tabular-nums"
                        disabled={loading}
                      />
                    )}

                    {/* Reps cell */}
                    {loggedSet && !isEditingThis ? (
                      <span className="tabular-nums text-sm font-medium text-foreground">
                        {loggedSet.reps} <span className="text-[10px] text-muted-foreground">Wdh</span>
                        {exercise.isUnilateral && <span className="text-[10px] text-muted-foreground ml-0.5">(2x)</span>}
                      </span>
                    ) : (
                      <Input
                        type="number"
                        value={isEditingThis ? editingValues.reps : getEditValue(setNumber, 'reps')}
                        onChange={(e) => {
                          if (isEditingThis) setEditingValues(prev => ({ ...prev, reps: e.target.value }));
                          else updateEditValue(setNumber, 'reps', e.target.value);
                        }}
                        placeholder="0"
                        className="h-7 text-sm tabular-nums"
                        disabled={loading}
                      />
                    )}

                    {/* RIR cell */}
                    {loggedSet && !isEditingThis ? (
                      <span className="tabular-nums text-sm text-muted-foreground">
                        {loggedSet.rir !== undefined ? `RIR ${loggedSet.rir}` : ''}
                      </span>
                    ) : (
                      <Input
                        type="number"
                        value={isEditingThis ? editingValues.rir : getEditValue(setNumber, 'rir')}
                        onChange={(e) => {
                          if (isEditingThis) setEditingValues(prev => ({ ...prev, rir: e.target.value }));
                          else updateEditValue(setNumber, 'rir', e.target.value);
                        }}
                        placeholder=""
                        className="h-7 text-sm tabular-nums"
                        disabled={loading}
                      />
                    )}

                    {/* Check / actions cell */}
                    <div className="flex justify-end">
                      {loggedSet ? (
                        isEditingThis ? (
                          <div className="flex gap-1">
                            <Button size="sm" onClick={handleSaveEdit} disabled={loading} className="h-7 px-2 text-xs">Speichern</Button>
                            <Button size="sm" variant="outline" onClick={handleCancelEdit} disabled={loading} className="h-7 px-2 text-xs">Abbr.</Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="size-6" onClick={() => handleEditSet(loggedSet)} disabled={loading} title="Bearbeiten">
                              <IconEdit className="size-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="size-6 text-destructive hover:text-destructive" onClick={() => handleDeleteSet(loggedSet.id)} disabled={loading} title="Satz löschen">
                              <IconTrash className="size-3.5" />
                            </Button>
                            <button disabled={loading} className="p-0.5" title="Geloggt (Swipe RTL zum Löschen)">
                              <IconCheck className="size-4 text-foreground stroke-[3]" />
                            </button>
                          </div>
                        )
                      ) : (
                        <button onClick={() => handleLogSet(setNumber)} disabled={loading} className="p-0.5" title="Satz loggen (oder Swipe LTR)">
                          <IconCheck className="size-4 text-muted-foreground/60 hover:text-primary" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Additional prepare rows (free or extra) as table rows */}
            {additionalSetNumbers.filter((n) => !getLoggedSet(n)).map((setNumber) => {
              const gridClass = "grid grid-cols-[auto_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.7fr)_auto] items-center gap-x-2 py-1.5 border-b border-border last:border-b-0";
              const isWarmup = getEditSetType(setNumber) === SetType.WARMUP;

              const swipeKey = `add-${setNumber}`;
              const swipeOffset = activeSwipe && activeSwipe.key === swipeKey ? activeSwipe.offset : 0;
              const swipeClass = swipeOffset > 0 ? 'bg-primary/5' : swipeOffset < 0 ? 'bg-destructive/5' : '';

              return (
                <div
                  key={`add-${setNumber}`}
                  onPointerDown={(e) => startSwipe(swipeKey, e.clientX, e.clientY)}
                  onPointerMove={(e) => updateSwipe(e.clientX, e.clientY)}
                  onPointerUp={() => endSwipe(swipeKey, setNumber)}
                  onPointerLeave={() => endSwipe(swipeKey, setNumber)}
                  onPointerCancel={() => setActiveSwipe(null)}
                  style={swipeOffset !== 0 ? { transform: `translateX(${swipeOffset}px)` } : undefined}
                  className={`${swipeClass} transition-transform touch-pan-y`}
                >
                  <div className={gridClass}>
                    {/* Type: tappable icon */}
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

                    <Input type="number" step="0.5" value={getEditValue(setNumber, 'weight')} onChange={(e) => updateEditValue(setNumber, 'weight', e.target.value)} placeholder="0" className="h-7 text-sm tabular-nums" disabled={loading} />
                    <Input type="number" value={getEditValue(setNumber, 'reps')} onChange={(e) => updateEditValue(setNumber, 'reps', e.target.value)} placeholder="0" className="h-7 text-sm tabular-nums" disabled={loading} />
                    <Input type="number" value={getEditValue(setNumber, 'rir')} onChange={(e) => updateEditValue(setNumber, 'rir', e.target.value)} placeholder="" className="h-7 text-sm tabular-nums" disabled={loading} />

                    <div className="flex justify-end">
                      <button onClick={() => handleLogSet(setNumber)} disabled={loading} className="p-0.5" title="Satz loggen (oder Swipe LTR)">
                        <IconCheck className="size-4 text-muted-foreground/60 hover:text-primary" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Extra logged sets (free or beyond planned) as table rows */}
            {exercise.sets
              .filter((s) => !hasPlannedSets || !exercise.plannedSets!.some((p) => p.order === s.setNumber))
              .sort((a, b) => a.setNumber - b.setNumber)
              .map((set) => {
                const gridClass = "grid grid-cols-[auto_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.7fr)_auto] items-center gap-x-2 py-1.5 border-b border-border last:border-b-0";
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
                    onPointerUp={() => endSwipe(swipeKey, undefined, set.id)}
                    onPointerLeave={() => endSwipe(swipeKey, undefined, set.id)}
                    onPointerCancel={() => setActiveSwipe(null)}
                    style={swipeOffset !== 0 ? { transform: `translateX(${swipeOffset}px)` } : undefined}
                    className={`${swipeClass} transition-transform touch-pan-y`}
                  >
                    <div className={gridClass}>
                      <div className="flex items-center justify-center">
                        <Badge variant={isWarmup ? 'outline' : 'default'} className="p-0.5">
                          {isWarmup ? <IconFlame className="size-4" /> : <IconBarbell className="size-4" />}
                        </Badge>
                      </div>

                      {isEditingThis ? (
                        <>
                          <Input type="number" step="0.5" value={editingValues.weight} onChange={(e) => setEditingValues(prev => ({ ...prev, weight: e.target.value }))} placeholder="0" className="h-7 text-sm tabular-nums" disabled={loading} />
                          <Input type="number" value={editingValues.reps} onChange={(e) => setEditingValues(prev => ({ ...prev, reps: e.target.value }))} placeholder="0" className="h-7 text-sm tabular-nums" disabled={loading} />
                          <Input type="number" value={editingValues.rir} onChange={(e) => setEditingValues(prev => ({ ...prev, rir: e.target.value }))} placeholder="" className="h-7 text-sm tabular-nums" disabled={loading} />
                          <div className="flex justify-end gap-1">
                            <Button size="sm" onClick={handleSaveEdit} disabled={loading} className="h-7 px-2 text-xs">Speichern</Button>
                            <Button size="sm" variant="outline" onClick={handleCancelEdit} disabled={loading} className="h-7 px-2 text-xs">Abbr.</Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="tabular-nums text-sm font-medium text-foreground">{set.weight} <span className="text-[10px] text-muted-foreground">kg</span></span>
                          <span className="tabular-nums text-sm font-medium text-foreground">{set.reps} <span className="text-[10px] text-muted-foreground">Wdh</span></span>
                          <span className="tabular-nums text-sm text-muted-foreground">{set.rir !== undefined ? `RIR ${set.rir}` : ''}</span>
                          <div className="flex justify-end items-center gap-1">
                            <Button variant="ghost" size="icon" className="size-6" onClick={() => handleEditSet(set)} disabled={loading} title="Bearbeiten">
                              <IconEdit className="size-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="size-6 text-destructive hover:text-destructive" onClick={() => handleDeleteSet(set.id)} disabled={loading} title="Satz löschen">
                              <IconTrash className="size-3.5" />
                            </Button>
                            <button disabled={loading} className="p-0.5" title="Geloggt (Swipe RTL zum Löschen)">
                              <IconCheck className="size-4 text-foreground stroke-[3]" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

            {/* Add set button (table-like) */}
            <Button variant="outline" onClick={addAdditionalSet} disabled={loading} className="w-full mt-2 border-dashed text-muted-foreground hover:text-foreground h-8">
              <IconPlus className="size-4 mr-2" />
              Satz hinzufügen
            </Button>

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

      {/* Replace Exercise Modal */}
      {showReplaceModal && (
        <ExerciseSelectionModal
          onClose={() => setShowReplaceModal(false)}
          onSelect={handleReplaceExercise}
        />
      )}
    </>
  );
}
