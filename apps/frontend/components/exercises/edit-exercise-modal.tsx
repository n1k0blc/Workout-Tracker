'use client';

import { useState } from 'react';
import { MuscleGroup, Equipment, Exercise } from '@/types';
import { apiClient } from '@/lib/api';
import { MUSCLE_GROUP_LABELS, createIsolationPreset, validateMusclePercentages } from '@/lib/exercise-utils';

interface EditExerciseModalProps {
  exercise: Exercise;
  onClose: () => void;
  onUpdated: (exercise: Exercise) => void;
}

export default function EditExerciseModal({
  exercise,
  onClose,
  onUpdated,
}: EditExerciseModalProps) {
  const [name, setName] = useState(exercise.name);
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>(exercise.muscleGroup);
  const [equipment, setEquipment] = useState<Equipment>(exercise.equipment);
  const [isUnilateral, setIsUnilateral] = useState(exercise.isUnilateral);
  const [isDoubleWeight, setIsDoubleWeight] = useState(exercise.isDoubleWeight);
  
  // Initialize with existing percentages
  const [percentages, setPercentages] = useState({
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
  });
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validation = validateMusclePercentages(percentages);

  const updatePercentage = (field: keyof typeof percentages, value: number) => {
    const clamped = Math.max(0, Math.min(100, value));
    setPercentages(prev => ({ ...prev, [field]: clamped }));
  };

  const handleIsolationPreset = () => {
    const preset = createIsolationPreset(muscleGroup);
    setPercentages(preset as typeof percentages);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Bitte gib einen Namen ein');
      return;
    }

    if (!validation.valid) {
      setError(`Muskelgruppen-Prozente müssen 100% ergeben (aktuell: ${validation.sum}%)`);
      return;
    }

    setLoading(true);
    try {
      const updated = await apiClient.updateExercise(exercise.id, {
        name: name.trim(),
        muscleGroup,
        equipment,
        isUnilateral,
        isDoubleWeight,
        ...percentages,
      });
      onUpdated(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Aktualisieren der Übung');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6 my-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Übung bearbeiten
        </h3>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. Incline Dumbbell Press"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hauptmuskelgruppe
                </label>
                <select
                  value={muscleGroup}
                  onChange={(e) => setMuscleGroup(e.target.value as MuscleGroup)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={MuscleGroup.ABDOMEN}>Bauch</option>
                  <option value={MuscleGroup.LATISSIMUS}>Latissimus</option>
                  <option value={MuscleGroup.TRAPEZIUS}>Trapez</option>
                  <option value={MuscleGroup.LOWER_BACK}>Unterer Rücken</option>
                  <option value={MuscleGroup.HAMSTRINGS}>Beinbeuger</option>
                  <option value={MuscleGroup.GLUTES}>Glutes</option>
                  <option value={MuscleGroup.SHOULDERS}>Schultern</option>
                  <option value={MuscleGroup.BICEPS}>Bizeps</option>
                  <option value={MuscleGroup.CHEST}>Brust</option>
                  <option value={MuscleGroup.QUADRICEPS}>Quadrizeps</option>
                  <option value={MuscleGroup.CALVES}>Waden</option>
                  <option value={MuscleGroup.TRICEPS}>Trizeps</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Equipment
                </label>
                <select
                  value={equipment}
                  onChange={(e) => setEquipment(e.target.value as Equipment)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={Equipment.BARBELL}>Langhantel</option>
                  <option value={Equipment.DUMBBELL}>Kurzhantel</option>
                  <option value={Equipment.CABLE}>Kabel</option>
                  <option value={Equipment.MACHINE}>Maschine</option>
                  <option value={Equipment.BODYWEIGHT}>Körpergewicht</option>
                  <option value={Equipment.SMITH_MACHINE}>Smith Machine</option>
                  <option value={Equipment.EZ_BAR}>SZ-Stange</option>
                </select>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isUnilateral"
                  checked={isUnilateral}
                  onChange={(e) => setIsUnilateral(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="isUnilateral" className="ml-2 text-sm text-gray-700">
                  Unilateral
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isDoubleWeight"
                  checked={isDoubleWeight}
                  onChange={(e) => setIsDoubleWeight(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="isDoubleWeight" className="ml-2 text-sm text-gray-700">
                  Doppeltes Gewicht
                </label>
              </div>
            </div>
          </div>

          {/* Muscle Distribution */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">
                Muskelgruppen-Verteilung
              </label>
              <button
                type="button"
                onClick={handleIsolationPreset}
                className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50"
              >
                Isolation (100%)
              </button>
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

            {/* Muscle Group Inputs */}
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
                        onChange={(e) => updatePercentage(field, parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim() || !validation.valid}
              className="flex-1 py-2 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Wird gespeichert...' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
