'use client';

import { MuscleGroup, Equipment, Exercise } from '@/types';
import { MUSCLE_GROUP_LABELS, validateMusclePercentages } from '@/lib/exercise-utils';

interface ViewExerciseModalProps {
  exercise: Exercise;
  onClose: () => void;
}

export default function ViewExerciseModal({
  exercise,
  onClose,
}: ViewExerciseModalProps) {
  const percentages = {
    abdomenPercent: exercise.abdomenPercent,
    latissimusPercent: exercise.latissimusPercent,
    trapeziusPercent: exercise.trapeziusPercent,
    lowerBackPercent: exercise.lowerBackPercent,
    hamstringsPercent: exercise.hamstringsPercent,
    glutesPercent: exercise.glutesPercent,
    shouldersPercent: exercise.shouldersPercent,
    bicepsPercent: exercise.bicepsPercent,
    chestPercent: exercise.chestPercent,
    quadricepsPercent: exercise.quadricepsPercent,
    calvesPercent: exercise.calvesPercent,
    tricepsPercent: exercise.tricepsPercent,
  };

  const validation = validateMusclePercentages(percentages);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6 my-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Übung anzeigen
        </h3>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700">
                {exercise.name}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hauptmuskelgruppe
                </label>
                <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700">
                  {MUSCLE_GROUP_LABELS[exercise.muscleGroup] || exercise.muscleGroup}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Equipment
                </label>
                <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700">
                  {(() => {
                    const equipmentLabels: Record<Equipment, string> = {
                      BARBELL: 'Langhantel',
                      DUMBBELL: 'Kurzhantel',
                      CABLE: 'Kabel',
                      MACHINE: 'Maschine',
                      BODYWEIGHT: 'Körpergewicht',
                      SMITH_MACHINE: 'Smith Machine',
                      EZ_BAR: 'SZ-Stange',
                    };
                    return equipmentLabels[exercise.equipment];
                  })()}
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isUnilateral"
                  checked={exercise.isUnilateral}
                  disabled
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                />
                <label htmlFor="isUnilateral" className="ml-2 text-sm text-gray-700">
                  Unilateral
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isDoubleWeight"
                  checked={exercise.isDoubleWeight}
                  disabled
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                />
                <label htmlFor="isDoubleWeight" className="ml-2 text-sm text-gray-700">
                  Doppeltes Gewicht
                </label>
              </div>
            </div>
          </div>

          {/* Muscle Distribution */}
          <div className="border-t pt-4">
            <div className="mb-3">
              <label className="text-sm font-medium text-gray-700">
                Muskelgruppen-Verteilung
              </label>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600">Gesamt</span>
                <span className={`font-semibold ${validation.valid ? 'text-green-600' : validation.sum > 100 ? 'text-red-600' : 'text-orange-600'}`}>
                  {validation.sum}% / 100%
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all ${
                    validation.valid ? 'bg-green-500' : validation.sum > 100 ? 'bg-red-500' : 'bg-orange-500'
                  }`}
                  style={{ width: `${Math.min(100, validation.sum)}%` }}
                />
              </div>
            </div>

            {/* Muscle Group Sliders (Read-Only) */}
            <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-2">
              {(Object.entries(MUSCLE_GROUP_LABELS) as [MuscleGroup, string][])
                .filter(([key]) => ![MuscleGroup.ABS, MuscleGroup.BACK, MuscleGroup.LEGS].includes(key)) // Filter legacy values
                .map(([key, label]) => {
                  const field = {
                    [MuscleGroup.ABDOMEN]: 'abdomenPercent',
                    [MuscleGroup.LATISSIMUS]: 'latissimusPercent',
                    [MuscleGroup.TRAPEZIUS]: 'trapeziusPercent',
                    [MuscleGroup.LOWER_BACK]: 'lowerBackPercent',
                    [MuscleGroup.HAMSTRINGS]: 'hamstringsPercent',
                    [MuscleGroup.GLUTES]: 'glutesPercent',
                    [MuscleGroup.SHOULDERS]: 'shouldersPercent',
                    [MuscleGroup.BICEPS]: 'bicepsPercent',
                    [MuscleGroup.CHEST]: 'chestPercent',
                    [MuscleGroup.QUADRICEPS]: 'quadricepsPercent',
                    [MuscleGroup.CALVES]: 'calvesPercent',
                    [MuscleGroup.TRICEPS]: 'tricepsPercent',
                    // Legacy values (filtered out, but needed for TypeScript)
                    [MuscleGroup.ABS]: 'abdomenPercent',
                    [MuscleGroup.BACK]: 'latissimusPercent',
                    [MuscleGroup.LEGS]: 'quadricepsPercent',
                  }[key] as keyof typeof percentages;

                  const value = percentages[field];

                  return (
                    <div key={key} className="space-y-1">
                      <label className="text-xs font-medium text-gray-700 flex justify-between">
                        <span>{label}</span>
                        <span className="text-gray-600 font-semibold">{value}%</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={value}
                        disabled
                        className="w-full opacity-60 cursor-not-allowed"
                      />
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Close Button */}
          <div className="flex justify-end pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-6 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700"
            >
              Schließen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
