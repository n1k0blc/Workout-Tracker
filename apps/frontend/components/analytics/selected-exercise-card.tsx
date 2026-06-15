'use client';

import { Exercise } from '@/types';
import { Trash2, ArrowLeftRight } from 'lucide-react';

interface SelectedExerciseCardProps {
  exercise: Exercise;
  onRemove: () => void;
  onReplace: () => void;
}

export default function SelectedExerciseCard({
  exercise,
  onRemove,
  onReplace,
}: SelectedExerciseCardProps) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 relative">
      {/* Action buttons - top right */}
      <div className="absolute top-3 right-3 flex gap-2">
        <button
          onClick={onReplace}
          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-100 transition-colors"
          title="Übung tauschen"
        >
          <ArrowLeftRight className="h-4 w-4" />
        </button>
        <button
          onClick={onRemove}
          className="p-1.5 rounded-lg text-red-600 hover:bg-red-100 transition-colors"
          title="Übung entfernen"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Exercise details */}
      <div className="pr-20">
        <h4 className="font-semibold text-gray-900">{exercise.name}</h4>
      </div>
    </div>
  );
}
