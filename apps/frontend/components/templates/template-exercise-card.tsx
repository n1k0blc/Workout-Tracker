'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import { Exercise } from '@/types';
import { Plus, Trash2 } from 'lucide-react';

interface TemplateSet {
  id: string;
  order: number;
  isWarmup: boolean;
  targetReps: number;
  targetWeight: number;
  targetRir: number;
}

interface TemplateExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  order: number;
  sets: TemplateSet[];
}

interface TemplateExerciseCardProps {
  exercise: TemplateExercise;
  exerciseDetails?: Exercise; // Full exercise object with isUnilateral, isDoubleWeight, etc.
  index: number;
  onRemove: () => void;
  onReplace: () => void;
  onAddSet: () => void;
  onRemoveSet: (setId: string) => void;
  onUpdateSet: (setId: string, field: keyof TemplateSet, value: any) => void;
}

export function TemplateExerciseCard({
  exercise,
  exerciseDetails,
  index,
  onRemove,
  onReplace,
  onAddSet,
  onRemoveSet,
  onUpdateSet,
}: TemplateExerciseCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border border-gray-200 rounded-lg overflow-hidden bg-white"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
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
            <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
            <h4 className="font-semibold text-gray-900">
              {exercise.exerciseName}
            </h4>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onReplace}
            className="text-blue-600 hover:text-blue-800 p-1 hover:bg-blue-50 rounded"
            title="Übung austauschen"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </button>
          <button
            onClick={onRemove}
            className="text-red-600 hover:text-red-800 p-1 hover:bg-red-50 rounded"
            title="Übung entfernen"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {!isCollapsed && (
        <div className="p-4 bg-white">
          {/* Sets */}
          <div className="space-y-3">
            <div className="text-sm font-medium text-gray-700 mb-2">Sätze:</div>
            {exercise.sets.map((set, setIndex) => (
              <div
                key={set.id}
                className="bg-gray-50 rounded-lg p-4 border border-gray-200"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">
                      Satz {setIndex + 1}
                    </span>
                    <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                      {set.isWarmup ? 'Aufwärmen' : 'Arbeitssatz'}
                    </span>
                  </div>
                  <button
                    onClick={() => onRemoveSet(set.id)}
                    className="text-red-600 hover:text-red-800"
                    title="Satz entfernen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Typ
                    </label>
                    <select
                      value={set.isWarmup ? 'warmup' : 'working'}
                      onChange={(e) =>
                        onUpdateSet(set.id, 'isWarmup', e.target.value === 'warmup')
                      }
                      className="w-full px-2 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="warmup">Aufwärmen</option>
                      <option value="working">Arbeitssatz</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Wiederholungen{exerciseDetails?.isUnilateral ? ' (2x)' : ''}
                    </label>
                    <input
                      type="number"
                      value={set.targetReps === 0 ? '' : set.targetReps}
                      onChange={(e) => {
                        const value = e.target.value;
                        onUpdateSet(
                          set.id,
                          'targetReps',
                          value === '' ? 0 : parseInt(value)
                        );
                      }}
                      min="0"
                      className="w-full px-2 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Gewicht (kg){exerciseDetails?.isDoubleWeight ? ' (2x)' : ''}
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={set.targetWeight === 0 ? '' : set.targetWeight}
                      onChange={(e) => {
                        const value = e.target.value;
                        onUpdateSet(
                          set.id,
                          'targetWeight',
                          value === '' ? 0 : parseFloat(value)
                        );
                      }}
                      min="0"
                      className="w-full px-2 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      RIR
                    </label>
                    <input
                      type="number"
                      value={set.targetRir === 0 ? '' : set.targetRir}
                      onChange={(e) => {
                        const value = e.target.value;
                        onUpdateSet(
                          set.id,
                          'targetRir',
                          value === '' ? 0 : parseInt(value)
                        );
                      }}
                      min="0"
                      max="10"
                      className="w-full px-2 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* Add Set Button */}
            <button
              onClick={onAddSet}
              className="w-full py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Satz hinzufügen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
