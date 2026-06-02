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
import { Label } from '@/components/ui/label';
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

        {/* Sets */}
        {!isCollapsed && (
          <CardContent className="p-4 space-y-2">
          {/* Planned Sets (prepare rows or logged display) */}
          {hasPlannedSets && exercise.plannedSets!.map((plannedSet) => {
            // setNumber and order are both 1-based in the database
            const setNumber = plannedSet.order;
            const loggedSet = getLoggedSet(setNumber);

            return (
              <div
                key={plannedSet.id}
                className="border rounded-md p-3 bg-muted/30 border-border"
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox / Status (neutral, no green "complete" cue) */}
                  <div className="mt-1">
                    {loggedSet ? (
                      <div className="flex size-5 items-center justify-center rounded bg-muted text-muted-foreground">
                        <IconCheck className="size-3.5" />
                      </div>
                    ) : (
                      <button
                        onClick={() => handleLogSet(setNumber)}
                        disabled={loading}
                        className="flex size-5 items-center justify-center rounded border-2 border-muted-foreground/40 hover:border-primary disabled:opacity-50"
                      />
                    )}
                  </div>

                  {/* Set Content */}
                  <div className="flex-1">
                    {loggedSet ? (
                      editingSetId === loggedSet.id ? (
                        // Edit mode for logged set (planned origin)
                        <div className="space-y-3">
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <Label className="text-xs">{`Gewicht (kg)${exercise.isDoubleWeight ? ' (2x)' : ''}`}</Label>
                              <Input
                                type="number"
                                step="0.5"
                                value={editingValues.weight}
                                onChange={(e) => setEditingValues(prev => ({ ...prev, weight: e.target.value }))}
                                placeholder="0"
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">{`Wdh${exercise.isUnilateral ? ' (2x)' : ''}`}</Label>
                              <Input
                                type="number"
                                value={editingValues.reps}
                                onChange={(e) => setEditingValues(prev => ({ ...prev, reps: e.target.value }))}
                                placeholder="0"
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">RIR</Label>
                              <Input
                                type="number"
                                value={editingValues.rir}
                                onChange={(e) => setEditingValues(prev => ({ ...prev, rir: e.target.value }))}
                                placeholder="0"
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={handleSaveEdit} disabled={loading} className="flex-1" size="sm">
                              Speichern
                            </Button>
                            <Button onClick={handleCancelEdit} disabled={loading} variant="outline" className="flex-1" size="sm">
                              Abbrechen
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // Display mode for logged set
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge variant={loggedSet.setType === SetType.WARMUP ? 'outline' : 'default'} className="p-0.5" title={loggedSet.setType === SetType.WARMUP ? 'Aufwärmen' : 'Arbeit'}>
                              {loggedSet.setType === SetType.WARMUP ? <IconFlame className="size-4" /> : <IconBarbell className="size-4" />}
                            </Badge>
                            <span className="text-sm font-semibold text-foreground">
                              {loggedSet.weight}kg × {loggedSet.reps} Wdh
                            </span>
                            {loggedSet.rir !== undefined && (
                              <span className="text-sm text-muted-foreground">RIR {loggedSet.rir}</span>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={() => handleEditSet(loggedSet)}
                              disabled={loading}
                              title="Bearbeiten"
                            >
                              <IconEdit className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteSet(loggedSet.id)}
                              disabled={loading}
                              title="Satz löschen"
                            >
                              <IconTrash className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="space-y-2">
                        {/* SetType select */}
                        <div>
                          <Label className="text-xs">Satztyp</Label>
                          <select
                            value={getEditSetType(setNumber)}
                            onChange={(e) => updateEditValue(setNumber, 'setType', e.target.value as SetType)}
                            className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          >
                            <option value={SetType.WORKING}>Arbeitssatz</option>
                            <option value={SetType.WARMUP}>Aufwärmsatz</option>
                          </select>
                        </div>

                        {/* Input Fields */}
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-xs">{`Gewicht (kg)${exercise.isDoubleWeight ? ' (2x)' : ''}`}</Label>
                            <Input
                              type="number"
                              step="0.5"
                              value={getEditValue(setNumber, 'weight')}
                              onChange={(e) => updateEditValue(setNumber, 'weight', e.target.value)}
                              placeholder="0"
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">{`Wdh${exercise.isUnilateral ? ' (2x)' : ''}`}</Label>
                            <Input
                              type="number"
                              value={getEditValue(setNumber, 'reps')}
                              onChange={(e) => updateEditValue(setNumber, 'reps', e.target.value)}
                              placeholder="0"
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">RIR</Label>
                            <Input
                              type="number"
                              value={getEditValue(setNumber, 'rir')}
                              onChange={(e) => updateEditValue(setNumber, 'rir', e.target.value)}
                              placeholder="0"
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Additional prepare rows (free workouts or sets beyond the planned blueprint) */}
          {additionalSetNumbers
            .filter((n) => !getLoggedSet(n))
            .map((setNumber) => (
              <div
                key={`add-${setNumber}`}
                className="border rounded-md p-3 bg-muted/30 border-border"
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox for additional */}
                  <div className="mt-1">
                    <button
                      onClick={() => handleLogSet(setNumber)}
                      disabled={loading}
                      className="flex size-5 items-center justify-center rounded border-2 border-muted-foreground/40 hover:border-primary disabled:opacity-50"
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    {/* SetType */}
                    <div>
                      <Label className="text-xs">Satztyp</Label>
                      <select
                        value={getEditSetType(setNumber)}
                        onChange={(e) => updateEditValue(setNumber, 'setType', e.target.value as SetType)}
                        className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value={SetType.WORKING}>Arbeitssatz</option>
                        <option value={SetType.WARMUP}>Aufwärmsatz</option>
                      </select>
                    </div>
                    {/* Inputs */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">{`Gewicht (kg)${exercise.isDoubleWeight ? ' (2x)' : ''}`}</Label>
                        <Input
                          type="number"
                          step="0.5"
                          value={getEditValue(setNumber, 'weight')}
                          onChange={(e) => updateEditValue(setNumber, 'weight', e.target.value)}
                          placeholder="0"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">{`Wdh${exercise.isUnilateral ? ' (2x)' : ''}`}</Label>
                        <Input
                          type="number"
                          value={getEditValue(setNumber, 'reps')}
                          onChange={(e) => updateEditValue(setNumber, 'reps', e.target.value)}
                          placeholder="0"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">RIR</Label>
                        <Input
                          type="number"
                          value={getEditValue(setNumber, 'rir')}
                          onChange={(e) => updateEditValue(setNumber, 'rir', e.target.value)}
                          placeholder="0"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

          {/* Extra logged sets (all for free workouts, or sets added beyond planned) */}
          {exercise.sets
            .filter((s) => !hasPlannedSets || !exercise.plannedSets!.some((p) => p.order === s.setNumber))
            .sort((a, b) => a.setNumber - b.setNumber)
            .map((set) => (
              <div key={set.id} className="border rounded-md p-3 bg-card border-border">
                {editingSetId === set.id ? (
                  // Edit form (shared structure with planned-logged edit)
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">{`Gewicht (kg)${exercise.isDoubleWeight ? ' (2x)' : ''}`}</Label>
                        <Input
                          type="number"
                          step="0.5"
                          value={editingValues.weight}
                          onChange={(e) => setEditingValues(prev => ({ ...prev, weight: e.target.value }))}
                          placeholder="0"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">{`Wdh${exercise.isUnilateral ? ' (2x)' : ''}`}</Label>
                        <Input
                          type="number"
                          value={editingValues.reps}
                          onChange={(e) => setEditingValues(prev => ({ ...prev, reps: e.target.value }))}
                          placeholder="0"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">RIR</Label>
                        <Input
                          type="number"
                          value={editingValues.rir}
                          onChange={(e) => setEditingValues(prev => ({ ...prev, rir: e.target.value }))}
                          placeholder="0"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSaveEdit} disabled={loading} className="flex-1" size="sm">
                        Speichern
                      </Button>
                      <Button onClick={handleCancelEdit} disabled={loading} variant="outline" className="flex-1" size="sm">
                        Abbrechen
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex size-5 items-center justify-center rounded bg-muted text-muted-foreground">
                        <IconCheck className="size-3.5" />
                      </div>
                      <Badge variant={set.setType === SetType.WARMUP ? 'outline' : 'default'} className="p-0.5" title={set.setType === SetType.WARMUP ? 'Aufwärmen' : 'Arbeit'}>
                        {set.setType === SetType.WARMUP ? <IconFlame className="size-4" /> : <IconBarbell className="size-4" />}
                      </Badge>
                      <span className="text-sm font-semibold text-foreground">
                        {set.weight}kg × {set.reps} Wdh
                      </span>
                      {set.rir !== undefined && (
                        <span className="text-sm text-muted-foreground">RIR {set.rir}</span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => handleEditSet(set)}
                        disabled={loading}
                        title="Bearbeiten"
                      >
                        <IconEdit className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteSet(set.id)}
                        disabled={loading}
                        title="Satz löschen"
                      >
                        <IconTrash className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}

          {/* Add additional set (works for free + for adding beyond planned) */}
          <Button
            variant="outline"
            onClick={addAdditionalSet}
            disabled={loading}
            className="w-full border-dashed text-muted-foreground hover:text-foreground"
          >
            <IconPlus className="size-4 mr-2" />
            Satz hinzufügen
          </Button>

          {!hasPlannedSets && exercise.sets.length === 0 && additionalSetNumbers.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-2">
              Noch keine Sätze geloggt
            </p>
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
