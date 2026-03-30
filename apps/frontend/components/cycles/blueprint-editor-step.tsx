import { useState, useEffect } from 'react';
import { CycleFormData, WorkoutDayData, BlueprintSetData } from './cycle-wizard';
import { SetType } from '@/types';
import ExerciseSelectionModal from '@/components/workout/exercise-selection-modal';
import { BlueprintExerciseCard } from './blueprint-exercise-card';
import { apiClient } from '@/lib/api/client';
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

interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
}

interface BlueprintEditorStepProps {
  formData: CycleFormData;
  updateFormData: (data: Partial<CycleFormData>) => void;
  currentDayIndex: number | null;
  setCurrentDayIndex: (index: number | null) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function BlueprintEditorStep({
  formData,
  updateFormData,
  currentDayIndex,
  setCurrentDayIndex,
  onNext,
  onBack,
}: BlueprintEditorStepProps) {
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [exercises, setExercises] = useState<Exercise[]>([]);

  // Load exercises
  useEffect(() => {
    const loadExercises = async () => {
      try {
        const data = await apiClient.getExercises({});
        setExercises(data);
      } catch (error) {
        console.error('Failed to load exercises:', error);
      }
    };
    loadExercises();
  }, []);

  // Setup sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end for reordering exercises
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || currentDayIndex === null) {
      return;
    }

    const updatedDays = [...formData.workoutDays];
    const currentExercises = [...updatedDays[currentDayIndex].blueprint.exercises];

    // Find old and new indices
    const oldIndex = currentExercises.findIndex(
      (ex) => `${ex.exerciseId}-${ex.order}` === active.id
    );
    const newIndex = currentExercises.findIndex(
      (ex) => `${ex.exerciseId}-${ex.order}` === over.id
    );

    if (oldIndex === -1 || newIndex === -1) return;

    // Reorder array
    const reorderedExercises = arrayMove(currentExercises, oldIndex, newIndex);

    // Update order numbers
    reorderedExercises.forEach((ex, idx) => {
      ex.order = idx + 1;
    });

    updatedDays[currentDayIndex].blueprint.exercises = reorderedExercises;
    updateFormData({ workoutDays: updatedDays });
  };

  useEffect(() => {
    if (currentDayIndex === null && formData.workoutDays.length > 0) {
      setCurrentDayIndex(0);
    }
  }, [currentDayIndex, formData.workoutDays.length, setCurrentDayIndex]);

  const currentDay =
    currentDayIndex !== null ? formData.workoutDays[currentDayIndex] : null;

  const addExerciseToBlueprint = (exerciseId: string, exercise?: Exercise) => {
    if (currentDayIndex === null) return;

    // If exercise object provided (e.g., newly created custom exercise), add to local list
    if (exercise && !exercises.find(ex => ex.id === exercise.id)) {
      setExercises(prev => [exercise, ...prev]);
    }

    const updatedDays = [...formData.workoutDays];
    const currentExercises = updatedDays[currentDayIndex].blueprint.exercises;

    updatedDays[currentDayIndex].blueprint.exercises = [
      ...currentExercises,
      {
        exerciseId,
        order: currentExercises.length + 1,
        sets: [
          {
            order: 1,
            setType: SetType.WORKING,
            reps: 10,
            weight: 0,
            rir: 2,
            restAfterSet: 90,
          },
        ],
      },
    ];

    updateFormData({ workoutDays: updatedDays });
    setShowExerciseModal(false);

  };

  const removeExercise = (exerciseIndex: number) => {
    if (currentDayIndex === null) return;

    const updatedDays = [...formData.workoutDays];
    const currentExercises = [...updatedDays[currentDayIndex].blueprint.exercises];
    currentExercises.splice(exerciseIndex, 1);

    // Reorder
    currentExercises.forEach((ex, idx) => {
      ex.order = idx + 1;
    });

    updatedDays[currentDayIndex].blueprint.exercises = currentExercises;
    updateFormData({ workoutDays: updatedDays });
  };

  const addSetToExercise = (exerciseIndex: number) => {
    if (currentDayIndex === null) return;

    const updatedDays = [...formData.workoutDays];
    const exercise = updatedDays[currentDayIndex].blueprint.exercises[exerciseIndex];
    
    exercise.sets.push({
      order: exercise.sets.length + 1,
      setType: SetType.WORKING,
      reps: 10,
      weight: 0,
      rir: 2,
      restAfterSet: 90,
    });

    updateFormData({ workoutDays: updatedDays });
  };

  const removeSet = (exerciseIndex: number, setIndex: number) => {
    if (currentDayIndex === null) return;

    const updatedDays = [...formData.workoutDays];
    const exercise = updatedDays[currentDayIndex].blueprint.exercises[exerciseIndex];
    
    exercise.sets.splice(setIndex, 1);
    
    // Reorder sets
    exercise.sets.forEach((set, idx) => {
      set.order = idx + 1;
    });

    updateFormData({ workoutDays: updatedDays });
  };

  const updateSet = (
    exerciseIndex: number,
    setIndex: number,
    field: keyof BlueprintSetData,
    value: number | SetType
  ) => {
    if (currentDayIndex === null) return;

    const updatedDays = [...formData.workoutDays];
    const set = updatedDays[currentDayIndex].blueprint.exercises[exerciseIndex].sets[setIndex];

    // Prevent NaN values for numeric fields
    if (field !== 'setType' && typeof value === 'number' && isNaN(value)) {
      value = 0;
    }

    (set as any)[field] = value;

    updateFormData({ workoutDays: updatedDays });
  };

  const updateExercise = (
    exerciseIndex: number,
    field: string,
    value: number
  ) => {
    if (currentDayIndex === null) return;

    const updatedDays = [...formData.workoutDays];
    const exercise = updatedDays[currentDayIndex].blueprint.exercises[exerciseIndex];

    // Prevent NaN values
    if (isNaN(value)) {
      value = 0;
    }

    (exercise as any)[field] = value;

    updateFormData({ workoutDays: updatedDays });
  };

  const getWeekday = (weekday: number): string => {
    const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    return days[weekday];
  };

  const allDaysHaveExercises = formData.workoutDays.every(
    (day) => day.blueprint.exercises.length > 0
  );

  return (
    <>
      <div className="space-y-6">
        {/* Day Tabs */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-wrap gap-2">
            {formData.workoutDays.map((day, index) => (
              <button
                key={index}
                onClick={() => setCurrentDayIndex(index)}
                className={`px-4 py-2 rounded-lg font-medium text-sm ${
                  currentDayIndex === index
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {day.name || getWeekday(day.weekday)}
                {day.blueprint.exercises.length > 0 && (
                  <span className="ml-2 text-xs">
                    ({day.blueprint.exercises.length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Blueprint Editor */}
        {currentDay && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Blueprint für {currentDay.name || getWeekday(currentDay.weekday)}
            </h3>

            {currentDay.blueprint.exercises.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={currentDay.blueprint.exercises.map(
                    (ex) => `${ex.exerciseId}-${ex.order}`
                  )}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-4 mb-4">
                    {currentDay.blueprint.exercises.map((ex, exIdx) => {
                      const exercise = exercises.find((e) => e.id === ex.exerciseId);
                      return (
                        <BlueprintExerciseCard
                          key={`${ex.exerciseId}-${ex.order}`}
                          blueprintExercise={ex}
                          exercise={exercise}
                          exerciseIndex={exIdx}
                          onRemove={() => removeExercise(exIdx)}
                          onUpdateSet={(setIdx, field, value) =>
                            updateSet(exIdx, setIdx, field, value)
                          }
                          onRemoveSet={(setIdx) => removeSet(exIdx, setIdx)}
                          onAddSet={() => addSetToExercise(exIdx)}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <p className="text-gray-600 text-center py-8 mb-4">
                Noch keine Übungen hinzugefügt
              </p>
            )}

            <button
              onClick={() => setShowExerciseModal(true)}
              className="w-full py-3 px-4 border-2 border-dashed border-gray-300 text-gray-600 font-medium rounded-lg hover:border-blue-500 hover:text-blue-600"
            >
              + Übung hinzufügen
            </button>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
          >
            Zurück
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!allDaysHaveExercises}
            className="flex-1 py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Weiter zur Überprüfung
          </button>
        </div>
      </div>

      {/* Exercise Selection Modal */}
      {showExerciseModal && (
        <ExerciseSelectionModal
          onClose={() => setShowExerciseModal(false)}
          onSelect={addExerciseToBlueprint}
        />
      )}
    </>
  );
}
