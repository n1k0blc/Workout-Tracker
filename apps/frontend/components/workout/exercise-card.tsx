'use client';

import { useState } from 'react';
import { ExerciseLog, SetType } from '@/types';
import { useWorkout } from '@/lib/workout-context';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ExerciseSelectionModal from './exercise-selection-modal';

interface ExerciseCardProps {
  exercise: ExerciseLog;
  exerciseNumber: number;
}

interface UnplannedSet {
  id: string;
  setNumber: number;
  weight: string;
  reps: string;
  rir: string;
  setType: SetType;
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
    removedPlannedSets, 
    markPlannedSetAsRemoved,
    unplannedSets: contextUnplannedSets,
    addUnplannedSet: addUnplannedSetToContext,
    removeUnplannedSet: removeUnplannedSetFromContext,
  } = useWorkout();

  const [editValues, setEditValues] = useState<{[key: number]: {weight: string, reps: string, rir: string, setType: SetType}}>({});
  const [unplannedSets, setUnplannedSets] = useState<UnplannedSet[]>([]);
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

  const handleLogSet = async (setNumber: number, isUnplanned: boolean = false) => {
    let values;
    let setType: SetType = SetType.WORKING;
    let plannedRestAfterSet: number | undefined;

    if (isUnplanned) {
      const unplannedSet = unplannedSets.find(s => s.setNumber === setNumber);
      if (!unplannedSet) return;
      values = {
        weight: unplannedSet.weight,
        reps: unplannedSet.reps,
        rir: unplannedSet.rir,
      };
      setType = unplannedSet.setType;
      plannedRestAfterSet = 90; // Default for unplanned sets
    } else {
      const plannedSet = exercise.plannedSets?.[setNumber - 1];
      if (!plannedSet) return;

      // Merge edited values with planned set values
      values = {
        weight: editValues[setNumber]?.weight ?? plannedSet.weight.toString(),
        reps: editValues[setNumber]?.reps ?? plannedSet.reps.toString(),
        rir: editValues[setNumber]?.rir ?? plannedSet.rir.toString(),
      };
      setType = editValues[setNumber]?.setType ?? plannedSet.setType;
      plannedRestAfterSet = plannedSet.restAfterSet;
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

      // If this was an unplanned set, remove it from context tracking
      if (isUnplanned) {
        removeUnplannedSetFromContext(exercise.id, setNumber);
      }

      // Clear edit state
      setEditValues(prev => {
        const newVals = {...prev};
        delete newVals[setNumber];
        return newVals;
      });
    } catch (error) {
      console.error('Failed to log set:', error);
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

  const addUnplannedSet = () => {
    const nextSetNumber = Math.max(
      hasPlannedSets ? exercise.plannedSets!.length : 0,
      ...unplannedSets.map(s => s.setNumber),
      ...exercise.sets.map(s => s.setNumber)
    ) + 1;

    setUnplannedSets(prev => [...prev, {
      id: `unplanned-${Date.now()}`,
      setNumber: nextSetNumber,
      weight: '',
      reps: '',
      rir: '',
      setType: SetType.WORKING,
    }]);
    
    // Track in context for validation
    addUnplannedSetToContext(exercise.id, nextSetNumber);
  };

  const removeUnplannedSet = (id: string) => {
    // Find the set to get its setNumber before removing
    const setToRemove = unplannedSets.find(s => s.id === id);
    if (setToRemove) {
      removeUnplannedSetFromContext(exercise.id, setToRemove.setNumber);
    }
    setUnplannedSets(prev => prev.filter(s => s.id !== id));
  };

  const updateUnplannedSet = (id: string, field: keyof UnplannedSet, value: string | SetType) => {
    setUnplannedSets(prev => prev.map(s => 
      s.id === id ? { ...s, [field]: value } : s
    ));
  };

  const removePlannedSet = (setNumber: number) => {
    // Mark the set as removed in the context
    markPlannedSetAsRemoved(exercise.id, setNumber);
    // Remove from editValues if it was being edited
    setEditValues(prev => {
      const newVals = {...prev};
      delete newVals[setNumber];
      return newVals;
    });
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
    // Fall back to planned set value
    const plannedSet = exercise.plannedSets?.[setNumber - 1];
    if (!plannedSet) return '';
    return plannedSet[field]?.toString() || '';
  };

  const getEditSetType = (setNumber: number): SetType => {
    if (editValues[setNumber]?.setType) {
      return editValues[setNumber].setType;
    }
    const plannedSet = exercise.plannedSets?.[setNumber - 1];
    return plannedSet?.setType || SetType.WORKING;
  };

  // Check if all sets for this exercise are logged
  const isExerciseComplete = (): boolean => {
    // Get all set numbers that should exist
    const setsToLog: Set<number> = new Set();
    
    // Add planned sets (that aren't removed)
    const removedSets = removedPlannedSets.get(exercise.id) || new Set();
    if (hasPlannedSets) {
      exercise.plannedSets?.forEach((_, index) => {
        const setNumber = index + 1;
        if (!removedSets.has(setNumber)) {
          setsToLog.add(setNumber);
        }
      });
    }
    
    // Add unplanned sets (both those in local state and in context)
    const contextUnplannedForExercise = contextUnplannedSets.get(exercise.id) || new Set();
    contextUnplannedForExercise.forEach(setNum => setsToLog.add(setNum));
    
    // For free workouts (no planned sets): consider complete if there are logged sets
    // and no pending unplanned sets
    if (!hasPlannedSets) {
      const hasLoggedSets = exercise.sets && exercise.sets.length > 0;
      const noPendingUnplannedSets = contextUnplannedForExercise.size === 0;
      return hasLoggedSets && noPendingUnplannedSets;
    }
    
    // If there are no sets to log, exercise is not complete
    if (setsToLog.size === 0) {
      return false;
    }
    
    // Check if every set that should exist has been logged
    const loggedSetNumbers = new Set(exercise.sets.map(s => s.setNumber));
    for (const setNum of setsToLog) {
      if (!loggedSetNumbers.has(setNum)) {
        return false;
      }
    }
    
    return true;
  };

  const exerciseComplete = isExerciseComplete();

  return (
    <>
      <div 
        ref={setNodeRef} 
        style={style} 
        className={`rounded-lg shadow-sm overflow-hidden ${
          exerciseComplete 
            ? 'bg-green-50/50 ring-2 ring-green-200' 
            : 'bg-white'
        }`}
      >
        {/* Exercise Header */}
        <div className={`px-4 py-3 flex items-center justify-between ${
          exerciseComplete ? 'bg-green-100/50' : 'bg-gray-100'
        }`}>
          <div className="flex items-center gap-3">
            {/* Drag Handle */}
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-gray-500">
              #{exerciseNumber}
            </span>
            <h3 className="font-semibold text-gray-900">
              {exercise.exerciseName}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {/* Collapse Button */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="text-gray-600 hover:text-gray-800"
            >
              <svg 
                className={`w-5 h-5 transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {/* Replace Exercise Button */}
            <button
              onClick={() => setShowReplaceModal(true)}
              disabled={exercise.sets.length > 0}
              className="text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
              title={exercise.sets.length > 0 ? "Übung kann nicht ausgetauscht werden nachdem Sets geloggt wurden" : "Übung austauschen"}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-red-600 hover:text-red-800"
              title="Übung entfernen"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Sets */}
        {!isCollapsed && (
          <div className="p-4 space-y-2">
          {/* Planned Sets */}
          {hasPlannedSets && exercise.plannedSets!
            .filter(plannedSet => {
              // Filter out removed sets
              const removedSets = removedPlannedSets.get(exercise.id);
              return !removedSets || !removedSets.has(plannedSet.order);
            })
            .map((plannedSet, idx) => {
            const setNumber = plannedSet.order;
            const loggedSet = getLoggedSet(setNumber);

            return (
              <div
                key={plannedSet.id}
                className={
                  `border rounded-lg p-3 ${
                    loggedSet
                      ? 'bg-green-50 border-green-200'
                      : plannedSet.setType === SetType.WARMUP
                      ? 'bg-orange-50 border-orange-200'
                      : 'bg-blue-50 border-blue-200'
                  }`
                }
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <div className="mt-1">
                    {loggedSet ? (
                      <div className="w-5 h-5 bg-green-600 rounded flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleLogSet(setNumber)}
                        disabled={loading}
                        className="w-5 h-5 border-2 border-gray-400 rounded hover:border-blue-600 disabled:opacity-50"
                      />
                    )}
                  </div>

                  {/* Set Content */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      {/* Trash icon for unlogged planned sets */}
                      <div className="flex-1"></div>
                      {!loggedSet && (
                        <button
                          onClick={() => removePlannedSet(setNumber)}
                          className="text-red-600 hover:text-red-800"
                          title="Geplanten Satz entfernen"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {loggedSet ? (
                      editingSetId === loggedSet.id ? (
                        // Edit mode
                        <div className="space-y-2">
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                {`Gewicht (kg)${exercise.isDoubleWeight ? ' (2x)' : ''}`}
                              </label>
                              <input
                                type="number"
                                step="0.5"
                                value={editingValues.weight}
                                onChange={(e) => setEditingValues(prev => ({ ...prev, weight: e.target.value }))}
                                placeholder="0"
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                {`Wdh${exercise.isUnilateral ? ' (2x)' : ''}`}
                              </label>
                              <input
                                type="number"
                                value={editingValues.reps}
                                onChange={(e) => setEditingValues(prev => ({ ...prev, reps: e.target.value }))}
                                placeholder="0"
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                RIR
                              </label>
                              <input
                                type="number"
                                value={editingValues.rir}
                                onChange={(e) => setEditingValues(prev => ({ ...prev, rir: e.target.value }))}
                                placeholder="0"
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={handleSaveEdit}
                              disabled={loading}
                              className="flex-1 bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                            >
                              Speichern
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              disabled={loading}
                              className="flex-1 bg-gray-200 text-gray-700 px-3 py-1.5 rounded text-sm hover:bg-gray-300 disabled:opacity-50"
                            >
                              Abbrechen
                            </button>
                          </div>
                        </div>
                      ) : (
                        // Display mode
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              loggedSet.setType === SetType.WARMUP
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {loggedSet.setType === SetType.WARMUP ? 'Aufwärmen' : 'Arbeit'}
                            </span>
                            <span className="text-sm font-semibold text-gray-900">
                              {loggedSet.weight}kg × {loggedSet.reps} Wdh
                            </span>
                            {loggedSet.rir !== undefined && (
                              <span className="text-sm text-gray-600">RIR {loggedSet.rir}</span>
                            )}
                          </div>
                          <button
                            onClick={() => handleEditSet(loggedSet)}
                            disabled={loading}
                            className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                            title="Bearbeiten"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                        </div>
                      )
                    ) : (
                      <div className="space-y-2">
                        {/* SetType Dropdown */}
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Satztyp
                          </label>
                          <select
                            value={getEditSetType(setNumber)}
                            onChange={(e) => updateEditValue(setNumber, 'setType', e.target.value as SetType)}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value={SetType.WORKING}>Arbeitssatz</option>
                            <option value={SetType.WARMUP}>Aufwärmsatz</option>
                          </select>
                        </div>

                        {/* Input Fields */}
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              {`Gewicht (kg)${exercise.isDoubleWeight ? ' (2x)' : ''}`}
                            </label>
                            <input
                              type="number"
                              step="0.5"
                              value={getEditValue(setNumber, 'weight')}
                              onChange={(e) => updateEditValue(setNumber, 'weight', e.target.value)}
                              placeholder="0"
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              {`Wdh${exercise.isUnilateral ? ' (2x)' : ''}`}
                            </label>
                            <input
                              type="number"
                              value={getEditValue(setNumber, 'reps')}
                              onChange={(e) => updateEditValue(setNumber, 'reps', e.target.value)}
                              placeholder="0"
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              RIR
                            </label>
                            <input
                              type="number"
                              value={getEditValue(setNumber, 'rir')}
                              onChange={(e) => updateEditValue(setNumber, 'rir', e.target.value)}
                              placeholder="0"
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
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

          {/* Ungeplante Sätze */}
          {unplannedSets.map((unplannedSet) => {
            const loggedSet = getLoggedSet(unplannedSet.setNumber);

            return (
              <div
                key={unplannedSet.id}
                className="border rounded-lg p-3 bg-gray-50 border-gray-300"
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <div className="mt-1">
                    {loggedSet ? (
                      <div className="w-5 h-5 bg-green-600 rounded flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleLogSet(unplannedSet.setNumber, true)}
                        disabled={loading}
                        className="w-5 h-5 border-2 border-gray-400 rounded hover:border-blue-600 disabled:opacity-50"
                      />
                    )}
                  </div>

                  {/* Set Content */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        <span className="text-xs text-gray-500">(ungeplant)</span>
                      </span>
                      {!loggedSet && (
                        <button
                          onClick={() => removeUnplannedSet(unplannedSet.id)}
                          className="text-red-600 hover:text-red-800"
                          title="Satz entfernen"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {loggedSet ? (
                      editingSetId === loggedSet.id ? (
                        // Edit mode
                        <div className="space-y-2">
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                {`Gewicht (kg)${exercise.isDoubleWeight ? ' (2x)' : ''}`}
                              </label>
                              <input
                                type="number"
                                step="0.5"
                                value={editingValues.weight}
                                onChange={(e) => setEditingValues(prev => ({ ...prev, weight: e.target.value }))}
                                placeholder="0"
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                {`Wdh${exercise.isUnilateral ? ' (2x)' : ''}`}
                              </label>
                              <input
                                type="number"
                                value={editingValues.reps}
                                onChange={(e) => setEditingValues(prev => ({ ...prev, reps: e.target.value }))}
                                placeholder="0"
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                RIR
                              </label>
                              <input
                                type="number"
                                value={editingValues.rir}
                                onChange={(e) => setEditingValues(prev => ({ ...prev, rir: e.target.value }))}
                                placeholder="0"
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={handleSaveEdit}
                              disabled={loading}
                              className="flex-1 bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                            >
                              Speichern
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              disabled={loading}
                              className="flex-1 bg-gray-200 text-gray-700 px-3 py-1.5 rounded text-sm hover:bg-gray-300 disabled:opacity-50"
                            >
                              Abbrechen
                            </button>
                          </div>
                        </div>
                      ) : (
                        // Display mode
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              loggedSet.setType === SetType.WARMUP
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {loggedSet.setType === SetType.WARMUP ? 'Aufwärmen' : 'Arbeit'}
                            </span>
                            <span className="text-sm font-semibold text-gray-900">
                              {loggedSet.weight}kg × {loggedSet.reps} Wdh
                            </span>
                            {loggedSet.rir !== undefined && (
                              <span className="text-sm text-gray-600">RIR {loggedSet.rir}</span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditSet(loggedSet)}
                              disabled={loading}
                              className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                              title="Bearbeiten"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteSet(loggedSet.id)}
                              disabled={loading}
                              className="text-red-600 hover:text-red-800 disabled:opacity-50"
                              title="Satz löschen"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="space-y-2">
                        {/* SetType Dropdown */}
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Satztyp
                          </label>
                          <select
                            value={unplannedSet.setType}
                            onChange={(e) => updateUnplannedSet(unplannedSet.id, 'setType', e.target.value as SetType)}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value={SetType.WORKING}>Arbeitssatz</option>
                            <option value={SetType.WARMUP}>Aufwärmsatz</option>
                          </select>
                        </div>

                        {/* Input Fields */}
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              {`Gewicht (kg)${exercise.isDoubleWeight ? ' (2x)' : ''}`}
                            </label>
                            <input
                              type="number"
                              step="0.5"
                              value={unplannedSet.weight}
                              onChange={(e) => updateUnplannedSet(unplannedSet.id, 'weight', e.target.value)}
                              placeholder="0"
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              {`Wdh${exercise.isUnilateral ? ' (2x)' : ''}`}
                            </label>
                            <input
                              type="number"
                              value={unplannedSet.reps}
                              onChange={(e) => updateUnplannedSet(unplannedSet.id, 'reps', e.target.value)}
                              placeholder="0"
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              RIR
                            </label>
                            <input
                              type="number"
                              value={unplannedSet.rir}
                              onChange={(e) => updateUnplannedSet(unplannedSet.id, 'rir', e.target.value)}
                              placeholder="0"
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
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

          {/* Freie Workouts ohne geplante Sätze */}
          {!hasPlannedSets && unplannedSets.length === 0 && exercise.sets.length > 0 && (
            exercise.sets.map((set) => (
              <div
                key={set.id}
                className="bg-green-50 border border-green-200 px-4 py-3 rounded-lg"
              >
                {editingSetId === set.id ? (
                  // Edit mode
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 bg-green-600 rounded flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          {`Gewicht (kg)${exercise.isDoubleWeight ? ' (2x)' : ''}`}
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          value={editingValues.weight}
                          onChange={(e) => setEditingValues(prev => ({ ...prev, weight: e.target.value }))}
                          placeholder="0"
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          {`Wdh${exercise.isUnilateral ? ' (2x)' : ''}`}
                        </label>
                        <input
                          type="number"
                          value={editingValues.reps}
                          onChange={(e) => setEditingValues(prev => ({ ...prev, reps: e.target.value }))}
                          placeholder="0"
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          RIR
                        </label>
                        <input
                          type="number"
                          value={editingValues.rir}
                          onChange={(e) => setEditingValues(prev => ({ ...prev, rir: e.target.value }))}
                          placeholder="0"
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveEdit}
                        disabled={loading}
                        className="flex-1 bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                      >
                        Speichern
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        disabled={loading}
                        className="flex-1 bg-gray-200 text-gray-700 px-3 py-1.5 rounded text-sm hover:bg-gray-300 disabled:opacity-50"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                ) : (
                  // Display mode
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-5 h-5 bg-green-600 rounded flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          set.setType === SetType.WARMUP
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {set.setType === SetType.WARMUP ? 'Aufwärmen' : 'Arbeit'}
                        </span>
                        <span className="font-semibold text-gray-900">
                          {set.weight}kg × {set.reps} Wdh
                        </span>
                        {set.rir !== undefined && (
                          <span className="text-gray-600">RIR {set.rir}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditSet(set)}
                        disabled={loading}
                        className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                        title="Bearbeiten"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteSet(set.id)}
                        disabled={loading}
                        className="text-red-600 hover:text-red-800 disabled:opacity-50"
                        title="Satz löschen"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}

          {/* Add Unplanned Set Button */}
          <button
            onClick={addUnplannedSet}
            disabled={loading}
            className="w-full py-2 px-4 border-2 border-dashed border-gray-300 text-gray-600 rounded-lg hover:border-blue-500 hover:text-blue-600 disabled:opacity-50 text-sm font-medium"
          >
            + Satz hinzufügen
          </button>

          {!hasPlannedSets && unplannedSets.length === 0 && exercise.sets.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-2">
              Noch keine Sätze geloggt
            </p>
          )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Übung entfernen?
            </h3>
            <p className="text-gray-600 mb-6">
              Möchtest du <strong>{exercise.exerciseName}</strong> und alle
              zugehörigen Sätze entfernen?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                onClick={handleRemoveExercise}
                disabled={loading}
                className="flex-1 py-2 px-4 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Wird entfernt...' : 'Entfernen'}
              </button>
            </div>
          </div>
        </div>
      )}

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
