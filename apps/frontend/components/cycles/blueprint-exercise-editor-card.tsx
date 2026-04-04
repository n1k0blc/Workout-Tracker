'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import { SetType, BlueprintSet, BlueprintExercise } from '@/types';

interface BlueprintExerciseEditorCardProps {
  exercise: BlueprintExercise;
  index: number;
  onRemove: () => void;
  onUpdate: (updates: Partial<BlueprintExercise>) => void;
  onReplace: () => void;
}

export function BlueprintExerciseCard({
  exercise,
  index,
  onRemove,
  onUpdate,
  onReplace,
}: BlueprintExerciseEditorCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: exercise.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleUpdateSet = (setIdx: number, field: keyof BlueprintSet, value: any) => {
    const updatedSets = [...exercise.sets];
    updatedSets[setIdx] = {
      ...updatedSets[setIdx],
      [field]: value,
    };
    onUpdate({ sets: updatedSets });
  };

  const handleRemoveSet = (setIdx: number) => {
    const updatedSets = exercise.sets
      .filter((_, idx) => idx !== setIdx)
      .map((set, idx) => ({ ...set, order: idx + 1 }));
    onUpdate({ sets: updatedSets });
  };

  const handleAddSet = () => {
    const lastSet = exercise.sets[exercise.sets.length - 1];
    const newSet: BlueprintSet = {
      id: `set-new-${Date.now()}`,
      order: exercise.sets.length + 1,
      setType: lastSet?.setType || 'WORKING',
      reps: lastSet?.reps || 10,
      weight: lastSet?.weight || 20,
      rir: lastSet?.rir || 2,
      restAfterSet: lastSet?.restAfterSet || 90,
    };
    onUpdate({ sets: [...exercise.sets, newSet] });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border border-gray-200 rounded-lg overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white">
        <div className="flex items-center gap-3 flex-1">
          {/* Drag Handle */}
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing touch-none p-1 hover:bg-gray-100 rounded"
          >
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 8h16M4 16h16"
              />
            </svg>
          </button>

          {/* Collapse Button */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <svg
              className={`w-5 h-5 text-gray-600 transition-transform ${
                isCollapsed ? '-rotate-90' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-500">#{index}</span>
            <h4 className="font-semibold text-gray-900">
              {exercise.exerciseName}
            </h4>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onReplace}
            className="text-blue-600 hover:text-blue-800"
            title="Übung austauschen"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </button>
          <button
            onClick={onRemove}
            className="text-red-600 hover:text-red-800"
            title="Übung entfernen"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {!isCollapsed && (
        <div className="p-4 bg-white border-t border-gray-200">
          {/* Sets List */}
          <div className="space-y-2 mb-3">
            <div className="text-sm font-medium text-gray-700 mb-2">Sätze:</div>
            {exercise.sets.map((set, setIdx) => (
              <div
                key={set.id}
                className="bg-gray-50 rounded-lg p-3 border border-gray-200"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1"></div>
                  <button
                    onClick={() => handleRemoveSet(setIdx)}
                    className="text-red-600 hover:text-red-800 text-xs"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Typ
                    </label>
                    <select
                      value={set.setType}
                      onChange={(e) => handleUpdateSet(setIdx, 'setType', e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={SetType.WORKING}>Arbeit</option>
                      <option value={SetType.WARMUP}>Aufwärmen</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      {`Wdh${exercise.isUnilateral ? ' (2x)' : ''}`}
                    </label>
                    <input
                      type="number"
                      value={set.reps ?? ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        handleUpdateSet(setIdx, 'reps', value === '' ? null : parseInt(value));
                      }}
                      min="1"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      {`Gewicht (kg)${exercise.isDoubleWeight ? ' (2x)' : ''}`}
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={set.weight ?? ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        handleUpdateSet(setIdx, 'weight', value === '' ? null : parseFloat(value));
                      }}
                      min="0"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">RIR</label>
                    <input
                      type="number"
                      value={set.rir ?? ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        handleUpdateSet(setIdx, 'rir', value === '' ? null : parseInt(value));
                      }}
                      min="0"
                      max="10"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                <div className="mt-2">
                  <label className="block text-xs text-gray-600 mb-1">
                    Pause nach Satz (s)
                  </label>
                  <input
                    type="number"
                    value={set.restAfterSet ?? ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      handleUpdateSet(setIdx, 'restAfterSet', value === '' ? null : parseInt(value));
                    }}
                    min="0"
                    step="15"
                    placeholder="90"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            ))}

            <button
              onClick={handleAddSet}
              className="w-full py-2 px-3 border border-dashed border-gray-300 text-gray-600 text-sm font-medium rounded-lg hover:border-blue-500 hover:text-blue-600"
            >
              + Satz hinzufügen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
