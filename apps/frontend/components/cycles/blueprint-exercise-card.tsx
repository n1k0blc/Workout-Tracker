'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import { SetType, Exercise } from '@/types';
import { BlueprintSetData } from './cycle-wizard';

interface BlueprintExercise {
  exerciseId: string;
  order: number;
  sets: BlueprintSetData[];
}

interface BlueprintExerciseCardProps {
  blueprintExercise: BlueprintExercise;
  exercise: Exercise | undefined;
  exerciseIndex: number;
  onRemove: () => void;
  onUpdateSet: (setIdx: number, field: keyof BlueprintSetData, value: any) => void;
  onRemoveSet: (setIdx: number) => void;
  onAddSet: () => void;
}

export function BlueprintExerciseCard({
  blueprintExercise,
  exercise,
  exerciseIndex,
  onRemove,
  onUpdateSet,
  onRemoveSet,
  onAddSet,
}: BlueprintExerciseCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `${blueprintExercise.exerciseId}-${blueprintExercise.order}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border border-gray-200 rounded-lg overflow-hidden"
    >
      {/* Header with Drag Handle and Collapse */}
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
            <span className="text-sm font-medium text-gray-500">
              #{blueprintExercise.order}
            </span>
            <h4 className="font-semibold text-gray-900">
              {exercise?.name || 'Übung geladen...'}
            </h4>
          </div>
        </div>

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

      {/* Expanded Content */}
      {!isCollapsed && (
        <div className="p-4 bg-white border-t border-gray-200">
          {/* Sets List */}
          <div className="space-y-2 mb-3">
            <div className="text-sm font-medium text-gray-700 mb-2">
              Sätze:
            </div>
            {blueprintExercise.sets.map((set, setIdx) => (
              <div
                key={setIdx}
                className="bg-gray-50 rounded-lg p-3 border border-gray-200"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">
                    Satz {set.order}
                  </span>
                  <button
                    onClick={() => onRemoveSet(setIdx)}
                    className="text-red-600 hover:text-red-800 text-xs"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Typ
                    </label>
                    <select
                      value={set.setType}
                      onChange={(e) =>
                        onUpdateSet(setIdx, 'setType', e.target.value as SetType)
                      }
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={SetType.WORKING}>Arbeit</option>
                      <option value={SetType.WARMUP}>Aufwärmen</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      {`Wdh${exercise?.isUnilateral ? ' (2x)' : ''}`}
                    </label>
                    <input
                      type="number"
                      value={set.reps ?? ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        onUpdateSet(setIdx, 'reps', value === '' ? null : parseInt(value));
                      }}
                      min="1"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      {`Gewicht (kg)${exercise?.isDoubleWeight ? ' (2x)' : ''}`}
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={set.weight ?? ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        onUpdateSet(setIdx, 'weight', value === '' ? null : parseFloat(value));
                      }}
                      min="0"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      RIR
                    </label>
                    <input
                      type="number"
                      value={set.rir ?? ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        onUpdateSet(setIdx, 'rir', value === '' ? null : parseInt(value));
                      }}
                      min="0"
                      max="10"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Pause (s)
                    </label>
                    <input
                      type="number"
                      value={set.restAfterSet ?? ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        onUpdateSet(setIdx, 'restAfterSet', value === '' ? null : parseInt(value));
                      }}
                      min="0"
                      step="15"
                      placeholder="90"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            ))}

            <button
              onClick={onAddSet}
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
