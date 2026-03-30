'use client';

import { ProtectedRoute } from '@/components/protected-route';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { Exercise, MuscleGroup, Equipment } from '@/types';
import CreateExerciseModal from '@/components/exercises/create-exercise-modal';

export default function ExercisesPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
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

  const handleLogout = () => {
    logout();
    router.push('/login');
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
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        {/* Navigation */}
        <nav className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <div className="flex-shrink-0 flex items-center">
                  <h1 className="text-xl font-bold text-gray-900">
                    Workout Tracker
                  </h1>
                </div>
                <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                  <Link
                    href="/dashboard"
                    className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/workout"
                    className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Workout
                  </Link>
                  <Link
                    href="/cycles"
                    className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Zyklen
                  </Link>
                  <Link
                    href="/exercises"
                    className="border-blue-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Übungen
                  </Link>
                  <Link
                    href="/history"
                    className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Verlauf
                  </Link>
                  <Link
                    href="/analytics"
                    className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Analytics
                  </Link>
                </div>
              </div>
              <div className="flex items-center">
                <span className="text-sm text-gray-700 mr-4">{user?.email}</span>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Abmelden
                </button>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="space-y-6">
              {/* Header */}
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Übungsbibliothek
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  {exercises.length} Übungen verfügbar
                </p>
              </div>

              {/* Search */}
              <div className="bg-white rounded-lg shadow p-4">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Übung suchen..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Filters */}
              <div className="bg-white rounded-lg shadow p-6 space-y-4">
                {/* Muscle Group Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Muskelgruppe
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setMuscleGroupFilter(undefined)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
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
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Equipment
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setEquipmentFilter(undefined)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
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
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
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
                className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                + Benutzerdefinierte Übung erstellen
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
                      className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">
                            {exercise.name}
                          </h3>
                          <div className="mt-2 space-y-1">
                            <div className="text-sm text-gray-600">
                              <span className="font-medium">Muskel:</span>{' '}
                              {translateMuscleGroup(exercise.muscleGroup)}
                            </div>
                            <div className="text-sm text-gray-600">
                              <span className="font-medium">Equipment:</span>{' '}
                              {translateEquipment(exercise.equipment)}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {exercise.isCustom && (
                            <>
                              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                                Custom
                              </span>
                              <button
                                onClick={() => setDeleteExerciseId(exercise.id)}
                                className="text-red-600 hover:text-red-800"
                                title="Übung löschen"
                              >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow p-12 text-center">
                  <p className="text-gray-600">Keine Übungen gefunden</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Create Exercise Modal */}
      {showCreateModal && (
        <CreateExerciseModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleExerciseCreated}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteExerciseId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Übung löschen?
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Möchten Sie diese benutzerdefinierte Übung wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteExercise}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 font-medium"
              >
                Löschen
              </button>
              <button
                onClick={() => setDeleteExerciseId(null)}
                className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 font-medium"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
