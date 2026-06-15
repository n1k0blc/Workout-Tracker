import { formatDuration } from '@/lib/workoutStats';
import { Clock } from 'lucide-react';

interface DurationSlideProps {
  duration: number; // in seconds
}

export function DurationSlide({ duration }: DurationSlideProps) {
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  
  return (
    <div className="text-center space-y-6 animate-fadeIn">
      <div className="flex justify-center">
        <div className="p-4 bg-blue-100 rounded-full">
          <Clock className="h-12 w-12 text-blue-600" />
        </div>
      </div>
      
      <h2 className="text-2xl font-semibold text-gray-900">
        Workout-Dauer
      </h2>
      
      <div className="space-y-2">
        <div className="text-6xl font-bold text-blue-600">
          {formatDuration(duration)}
        </div>
        {seconds > 0 && (
          <div className="text-lg text-gray-500">
            ({minutes} Min {seconds} Sek)
          </div>
        )}
      </div>
      
      <p className="text-gray-500 max-w-md mx-auto">
        Zeit von Start bis Abschluss deines Workouts
      </p>
    </div>
  );
}
