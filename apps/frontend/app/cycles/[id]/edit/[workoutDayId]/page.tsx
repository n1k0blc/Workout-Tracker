'use client';

import { ProtectedRoute } from '@/components/protected-route';
import { useAuth } from '@/lib/auth-context';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { WorkoutCycle, Exercise, BlueprintExercise, SetType } from '@/types';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { BlueprintExerciseCard } from '../../../../../components/cycles/blueprint-exercise-editor-card';
import ExerciseSelectionModal from '@/components/workout/exercise-selection-modal';

export default function EditBlueprintPage() {
  const { user, logout } = useAuth();
  const params = useParams();
  const router = useRouter();
  const cycleId = params.id as string;
  const workoutDayId = params.workoutDayId as string;

  const [cycle, setCycle] = useState<WorkoutCycle | null>(null);
  const [workoutDayName, setWorkoutDayName] = useState<string>('');
  const [plannedWeekday, setPlannedWeekday] = useState<number>(1);
  const [exercises, setExercises] = useState<BlueprintExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [replacingExerciseId, setReplacingExerciseId] = useState<string | null>(null);

  // DnD Kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadData();
  }, [cycleId, workoutDayId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const cycleData = await apiClient.getCycle(cycleId);

      setCycle(cycleData);

      // Find the specific workout day
      const workoutDay = cycleData.workoutDays.find((d) => d.id === workoutDayId);
      if (!workoutDay) {
        throw new Error('Workout day not found');
      }

      setWorkoutDayName(workoutDay.name);
      setPlannedWeekday(workoutDay.weekday);

      if (workoutDay.blueprint) {
        setExercises(workoutDay.blueprint.exercises);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      alert('Fehler beim Laden der Daten');
      router.push('/cycles');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleAddExercise = (exerciseId: string, exercise?: Exercise) => {
    if (!exercise) return;

    const newExercise: BlueprintExercise = {
      id: `new-${Date.now()}`, // Temporary ID
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      order: exercises.length + 1,
      sets: [
        {
          id: `set-new-${Date.now()}`,
          order: 1,
          setType: SetType.WARMUP,
          reps: 10,
          weight: 20,
          rir: 3,
          restAfterSet: 90,
        },
        {
          id: `set-new-${Date.now()}-1`,
          order: 2,
          setType: SetType.WORKING,
          reps: 10,
          weight: 40,
          rir: 2,
          restAfterSet: 90,
        },
        {
          id: `set-new-${Date.now()}-2`,
          order: 3,
          setType: SetType.WORKING,
          reps: 10,
          weight: 40,
          rir: 2,
          restAfterSet: 90,
        },
      ],
    };
    setExercises([...exercises, newExercise]);
    setShowExerciseModal(false);
  };

  const handleReplaceExercise = (exerciseId: string, exercise?: Exercise) => {
    if (!replacingExerciseId || !exercise) return;

    setExercises(
      exercises.map((ex) =>
        ex.id === replacingExerciseId
          ? {
              ...ex,
              exerciseId: exercise.id,
              exerciseName: exercise.name,
            }
          : ex
      )
    );
    setShowExerciseModal(false);
    setReplacingExerciseId(null);
  };

  const handleRemoveExercise = (exerciseId: string) => {
    const updatedExercises = exercises
      .filter((ex) => ex.id !== exerciseId)
      .map((ex, idx) => ({ ...ex, order: idx + 1 }));
    setExercises(updatedExercises);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setExercises((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        const reordered = arrayMove(items, oldIndex, newIndex);
        return reordered.map((ex, idx) => ({ ...ex, order: idx + 1 }));
      });
    }
  };

  const handleUpdateExercise = (
    exerciseId: string,
    updates: Partial<BlueprintExercise>
  ) => {
    setExercises(
      exercises.map((ex) => (ex.id === exerciseId ? { ...ex, ...updates } : ex))
    );
  };

  const handleSave = async () => {
    if (!workoutDayName.trim()) {
      alert('Bitte gib einen Workout-Namen ein');
      return;
    }
    
    setSaving(true);
    try {
      // First update the workout day name and weekday
      await apiClient.updateWorkoutDay(cycleId, workoutDayId, {
        name: workoutDayName.trim(),
        weekday: plannedWeekday,
      });
      
      // Transform exercises to match API format
      const blueprintData = {
        exercises: exercises.map((ex) => ({
          exerciseId: ex.exerciseId,
          order: ex.order,
          sets: ex.sets.map((set) => ({
            order: set.order,
            setType: set.setType,
            reps: set.reps,
            weight: set.weight,
            rir: set.rir,
            restAfterSet: set.restAfterSet,
          })),
        })),
      };

      await apiClient.updateBlueprint(cycleId, workoutDayId, blueprintData);
      router.push('/cycles');
    } catch (error) {
      console.error('Failed to save blueprint:', error);
      alert('Fehler beim Speichern des Blueprints');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    router.push('/cycles');
  };

  const openReplaceModal = (exerciseId: string) => {
    setReplacingExerciseId(exerciseId);
    setShowExerciseModal(true);
  };

  const openAddModal = () => {
    setReplacingExerciseId(null);
    setShowExerciseModal(true);
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-lg text-gray-600">Lädt Blueprint...</div>
        </div>
      </ProtectedRoute>
    );
  }

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
            {/* Header */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Blueprint bearbeiten
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                {cycle?.name}
              </p>
            </div>

            {/* Workout Day Settings */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Workout-Einstellungen
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Workout-Name
                  </label>
                  <input
                    type="text"
                    value={workoutDayName}
                    onChange={(e) => setWorkoutDayName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="z.B. Push Day, Pull Day, Legs"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Geplanter Wochentag
                  </label>
                  <select
                    value={plannedWeekday}
                    onChange={(e) => setPlannedWeekday(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={1}>Montag</option>
                    <option value={2}>Dienstag</option>
                    <option value={3}>Mittwoch</option>
                    <option value={4}>Donnerstag</option>
                    <option value={5}>Freitag</option>
                    <option value={6}>Samstag</option>
                    <option value={0}>Sonntag</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Exercise List Header */}
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Übungen
              </h3>
            </div>

            {/* Exercise List */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={exercises.map((ex) => ex.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-4 mb-6">
                  {exercises.map((exercise, index) => (
                    <BlueprintExerciseCard
                      key={exercise.id}
                      exercise={exercise}
                      index={index}
                      onRemove={() => handleRemoveExercise(exercise.id)}
                      onUpdate={(updates) => handleUpdateExercise(exercise.id, updates)}
                      onReplace={() => openReplaceModal(exercise.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {/* Add Exercise Button */}
            <button
              onClick={openAddModal}
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 font-medium"
            >
              + Weitere Übung hinzufügen
            </button>

            {/* Action Buttons */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleCancel}
                disabled={saving}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSave}
                disabled={saving || exercises.length === 0}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Speichert...' : 'Speichern'}
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* Exercise Selection Modal */}
      {showExerciseModal && (
        <ExerciseSelectionModal
          onSelect={
            replacingExerciseId ? handleReplaceExercise : handleAddExercise
          }
          onClose={() => {
            setShowExerciseModal(false);
            setReplacingExerciseId(null);
          }}
        />
      )}
    </ProtectedRoute>
  );
}
