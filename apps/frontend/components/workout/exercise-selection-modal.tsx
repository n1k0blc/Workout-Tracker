'use client';

import { useState, useEffect } from 'react';
import { Exercise, MuscleGroup, Equipment } from '@/types';
import { apiClient } from '@/lib/api';
import CreateExerciseModal from '@/components/exercises/create-exercise-modal';

interface ExerciseSelectionModalProps {
  onClose: () => void;
  onSelect: (exerciseId: string, exercise?: Exercise) => void;
}

export default function ExerciseSelectionModal({
  onClose,
  onSelect,
}: ExerciseSelectionModalProps) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [muscleGroupFilter, setMuscleGroupFilter] = useState<
    MuscleGroup | undefined
  >();
  const [equipmentFilter, setEquipmentFilter] = useState<
    Equipment | undefined
  >();
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadExercises();
  }, [search, muscleGroupFilter, equipmentFilter]);

  const loadExercises = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getExercises({
        search: search || undefined,
        muscleGroup: muscleGroupFilter,
        equipment: equipmentFilter,
        includeCustom: true,
      });
      setExercises(data);
    } catch (error) {
      console.error('Failed to load exercises:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExerciseCreated = (exercise: Exercise) => {
    // Add new exercise to list and select it
    setExercises((prev) => [exercise, ...prev]);
    onSelect(exercise.id, exercise);
  };

  const muscleGroups = [
    MuscleGroup.CHEST,
    MuscleGroup.BACK,
    MuscleGroup.BICEPS,
    MuscleGroup.TRICEPS,
    MuscleGroup.ABS,
    MuscleGroup.SHOULDERS,
    MuscleGroup.LEGS,
  ];

  const equipments = [
    Equipment.CABLE,
    Equipment.MACHINE,
    Equipment.DUMBBELL,
    Equipment.BARBELL,
    Equipment.BODYWEIGHT,
    Equipment.SMITH_MACHINE,
    Equipment.EZ_BAR,
  ];

  const translateMuscleGroup = (mg: MuscleGroup): string => {
    const translations: Record<MuscleGroup, string> = {
      CHEST: 'Brust',
      BACK: 'Rücken',
      BICEPS: 'Bizeps',
      TRICEPS: 'Trizeps',
      ABS: 'Bauch',
      SHOULDERS: 'Schultern',
      LEGS: 'Beine',
    };
    return translations[mg];
  };

  const translateEquipment = (eq: Equipment): string => {
    const translations: Record<Equipment, string> = {
      CABLE: 'Kabel',
      MACHINE: 'Maschine',
      DUMBBELL: 'Kurzhantel',
      BARBELL: 'Langhantel',
      BODYWEIGHT: 'Körpergewicht',
      SMITH_MACHINE: 'Smith-Maschine',
      EZ_BAR: 'EZ-Stange',
    };
    return translations[eq];
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Übung hinzufügen
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Übung suchen..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-b border-gray-200 space-y-3">
          {/* Muscle Group Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Muskelgruppe
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setMuscleGroupFilter(undefined)}
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  !muscleGroupFilter
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Alle
              </button>
              {muscleGroups.map((mg) => (
                <button
                  key={mg}
                  onClick={() => setMuscleGroupFilter(mg)}
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    muscleGroupFilter === mg
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {translateMuscleGroup(mg)}
                </button>
              ))}
            </div>
          </div>

          {/* Equipment Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Equipment
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setEquipmentFilter(undefined)}
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  !equipmentFilter
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Alle
              </button>
              {equipments.map((eq) => (
                <button
                  key={eq}
                  onClick={() => setEquipmentFilter(eq)}
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    equipmentFilter === eq
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {translateEquipment(eq)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Create Custom Exercise Button */}
        <div className="px-6 py-3 border-b border-gray-200">
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full py-2 px-4 border-2 border-dashed border-gray-300 text-gray-600 font-medium rounded-lg hover:border-blue-500 hover:text-blue-600 transition-colors"
          >
            + Benutzerdefinierte Übung erstellen
          </button>
        </div>

        {/* Exercise List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8 text-gray-600">
              Lädt Übungen...
            </div>
          ) : exercises.length > 0 ? (
            <div className="space-y-2">
              {exercises.map((exercise) => (
                <button
                  key={exercise.id}
                  onClick={() => onSelect(exercise.id, exercise)}
                  className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                >
                  <div className="font-medium text-gray-900">
                    {exercise.name}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {translateMuscleGroup(exercise.muscleGroup)} •{' '}
                    {translateEquipment(exercise.equipment)}
                    {exercise.isCustom && (
                      <span className="ml-2 text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                        Custom
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-600">
              Keine Übungen gefunden
            </div>
          )}
        </div>
      </div>

      {/* Create Exercise Modal */}
      {showCreateModal && (
        <CreateExerciseModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleExerciseCreated}
        />
      )}
    </div>
  );
}
