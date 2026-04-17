import { Dumbbell } from 'lucide-react';

interface ExercisesSlideProps {
  count: number;
}

export function ExercisesSlide({ count }: ExercisesSlideProps) {
  return (
    <div className="text-center space-y-6 animate-fadeIn">
      <div className="flex justify-center">
        <div className="p-4 bg-blue-100 rounded-full">
          <Dumbbell className="h-12 w-12 text-blue-600" />
        </div>
      </div>
      
      <h2 className="text-2xl font-semibold text-gray-900">
        Übungen absolviert
      </h2>
      
      <div className="space-y-2">
        <div className="text-6xl font-bold text-blue-600">
          {count}
        </div>
        <div className="text-xl text-gray-600">
          {count === 1 ? 'Übung' : 'Übungen'}
        </div>
      </div>
      
      <p className="text-gray-500 max-w-md mx-auto">
        Verschiedene Übungen in diesem Workout trainiert
      </p>
    </div>
  );
}
