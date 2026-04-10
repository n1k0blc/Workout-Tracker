'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { Exercise, MuscleGroup, Equipment } from '@/types';
import CreateExerciseModal from '@/components/exercises/create-exercise-modal';
import EditExerciseModal from '@/components/exercises/edit-exercise-modal';
import { Plus, Trash2, Pencil } from 'lucide-react';

export default function ExercisesTab() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [muscleGroupFilter, setMuscleGroupFilter] = useState<MuscleGroup | undefined>();
  const [equipmentFilter, setEquipmentFilter] = useState<Equipment | undefined>();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editExercise, setEditExercise] = useState<Exercise | null>(null);
  const [deleteExerciseId, setDeleteExerciseId] = useState<string | null>(null);

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
    setExercises((prev) => [exercise, ...prev]);
    setShowCreateModal(false);
  };

  const handleExerciseUpdated = (updatedExercise: Exercise) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.id === updatedExercise.id ? updatedExercise : ex))
    );
    setEditExercise(null);
  };

  const handleDeleteExercise = async () => {
    if (!deleteExerciseId) return;

    try {
      await apiClient.deleteExercise(deleteExerciseId);
      setExercises((prev) => prev.filter((ex) => ex.id !== deleteExerciseId));
      setDeleteExerciseId(null);
    } catch (error) {
      console.error('Failed to delete exercise:', error);
      alert('Fehler beim Löschen der Übung. Möglicherweise wird sie noch verwendet.');
    }
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
    <div className="space-y-6">
      {/* Header with count */}
      <div>
        <p className="text-sm text-gray-600">{exercises.length} Übungen verfügbar</p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Übung suchen..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
        {/* Muscle Group Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Muskelgruppe
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setMuscleGroupFilter(undefined)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
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
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
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
          <label className="block text-sm font-medium text-gray-700 mb-2">Equipment</label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setEquipmentFilter(undefined)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
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
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
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
      <button
        onClick={() => setShowCreateModal(true)}
        className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="h-5 w-5" />
        Benutzerdefinierte Übung erstellen
      </button>

      {/* Exercise List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-lg text-gray-600">Lädt Übungen...</div>
        </div>
      ) : exercises.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {exercises.map((exercise) => (
            <div
              key={exercise.id}
              className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{exercise.name}</h3>
                  <div className="mt-2 space-y-1">
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Muskel:</span>{' '}
                      {translateMuscleGroup(exercise.muscleGroup)}
                    </div>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Equipment:</span>{' '}
                      {translateEquipment(exercise.equipment)}
                    </div>
                    {(exercise.isUnilateral || exercise.isDoubleWeight) && (
                      <div className="flex gap-1 mt-2">
                        {exercise.isUnilateral && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            Unilateral
                          </span>
                        )}
                        {exercise.isDoubleWeight && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                            2x Gewicht
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {exercise.isCustom && (
                    <>
                      <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded whitespace-nowrap">
                        Custom
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditExercise(exercise)}
                          className="text-blue-600 hover:text-blue-800 transition-colors"
                          title="Übung bearbeiten"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteExerciseId(exercise.id)}
                          className="text-red-600 hover:text-red-800 transition-colors"
                          title="Übung löschen"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <p className="text-gray-600">Keine Übungen gefunden</p>
        </div>
      )}

      {/* Create Exercise Modal */}
      {showCreateModal && (
        <CreateExerciseModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleExerciseCreated}
        />
      )}

      {/* Edit Exercise Modal */}
      {editExercise && (
        <EditExerciseModal
          exercise={editExercise}
          onClose={() => setEditExercise(null)}
          onUpdated={handleExerciseUpdated}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteExerciseId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Übung löschen?</h3>
            <p className="text-sm text-gray-600 mb-6">
              Möchten Sie diese benutzerdefinierte Übung wirklich löschen? Diese Aktion kann nicht
              rückgängig gemacht werden.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteExercise}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 font-medium transition-colors"
              >
                Löschen
              </button>
              <button
                onClick={() => setDeleteExerciseId(null)}
                className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 font-medium transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
