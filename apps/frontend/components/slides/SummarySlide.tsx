import { Workout, SetType } from '@/types';
import { ClipboardList } from 'lucide-react';

interface SummarySlideProps {
  workout: Workout;
}

export function SummarySlide({ workout }: SummarySlideProps) {
  return (
    <div className="space-y-6 animate-fadeIn max-h-[400px] overflow-y-auto">
      <div className="text-center mb-6">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-blue-100 rounded-full">
            <ClipboardList className="h-10 w-10 text-blue-600" />
          </div>
        </div>
        <h2 className="text-2xl font-semibold text-gray-900">
          Workout-Übersicht
        </h2>
      </div>

      {/* Exercises */}
      <div className="space-y-3">
        {workout.exercises.map((exercise, idx) => (
          <div key={exercise.id} className="bg-gray-50 rounded-lg p-4">
            <div className="mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
                  #{idx + 1}
                </span>
                <h4 className="text-base font-semibold text-gray-900">
                  {exercise.exerciseName}
                </h4>
              </div>
            </div>

            {/* Sets */}
            <div className="space-y-1.5">
              {exercise.sets
                .sort((a, b) => a.setNumber - b.setNumber)
                .map((set) => (
                  <div
                    key={set.id}
                    className={`flex items-center justify-between p-2 rounded text-sm ${
                      set.setType === 'WARMUP'
                        ? 'bg-orange-50 border border-orange-200'
                        : 'bg-blue-50 border border-blue-200'
                    }`}
                  >
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        set.setType === 'WARMUP'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {set.setType === 'WARMUP' ? 'Aufwärmen' : 'Arbeit'}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-gray-900">
                        {set.weight}kg × {set.reps}
                      </span>
                      {set.rir !== undefined && set.rir !== null && (
                        <span className="text-gray-600 text-xs">
                          RIR {set.rir}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
