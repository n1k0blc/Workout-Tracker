'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';

interface CycleWorkoutDay {
  workoutDayId: string;
  workoutDayName: string;
  weekday: number;
  isSuggested: boolean;
  exerciseCount: number;
}

interface CurrentCycleWorkouts {
  cycleId: string;
  cycleName: string;
  workoutDays: CycleWorkoutDay[];
}

interface CycleWorkoutSelectionModalProps {
  onClose: () => void;
  onSelect: (cycleId: string, workoutDayId: string) => void;
}

export default function CycleWorkoutSelectionModal({
  onClose,
  onSelect,
}: CycleWorkoutSelectionModalProps) {
  const [cycleWorkouts, setCycleWorkouts] = useState<CurrentCycleWorkouts | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCycleWorkouts = async () => {
      try {
        const data = await apiClient.getCurrentCycleWorkouts();
        setCycleWorkouts(data);
      } catch (error) {
        console.error('Failed to load cycle workouts:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCycleWorkouts();
  }, []);

  const getWeekdayName = (weekday: number): string => {
    const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    return days[weekday];
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Workout aus aktuellem Zyklus wählen
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {cycleWorkouts && (
            <p className="text-sm text-gray-600 mt-1">
              {cycleWorkouts.cycleName}
            </p>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8 text-gray-600">
              Lädt Workouts...
            </div>
          ) : cycleWorkouts && cycleWorkouts.workoutDays.length > 0 ? (
            <div className="space-y-3">
              {cycleWorkouts.workoutDays.map((workoutDay) => (
                <button
                  key={workoutDay.workoutDayId}
                  onClick={() => onSelect(cycleWorkouts.cycleId, workoutDay.workoutDayId)}
                  className={`w-full text-left px-4 py-4 border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors ${
                    workoutDay.isSuggested
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">
                          {workoutDay.workoutDayName}
                        </h3>
                        {workoutDay.isSuggested && (
                          <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded font-medium">
                            Heute empfohlen
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {getWeekdayName(workoutDay.weekday)} • {workoutDay.exerciseCount} Übungen
                      </div>
                    </div>
                    <svg 
                      className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1"
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-600">
              Keine Workouts im aktuellen Zyklus verfügbar
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}
