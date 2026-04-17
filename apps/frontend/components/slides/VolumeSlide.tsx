import { formatVolume } from '@/lib/workoutStats';
import { TrendingUp } from 'lucide-react';

interface VolumeSlideProps {
  volume: number;
}

export function VolumeSlide({ volume }: VolumeSlideProps) {
  return (
    <div className="text-center space-y-6 animate-fadeIn">
      <div className="flex justify-center">
        <div className="p-4 bg-blue-100 rounded-full">
          <TrendingUp className="h-12 w-12 text-blue-600" />
        </div>
      </div>
      
      <h2 className="text-2xl font-semibold text-gray-900">
        Gesamtvolumen
      </h2>
      
      <div className="space-y-2">
        <div className="text-6xl font-bold text-blue-600">
          {formatVolume(volume)}
        </div>
        <div className="text-xl text-gray-600">
          kg bewegt
        </div>
      </div>
      
      <p className="text-gray-500 max-w-md mx-auto">
        Das ist die Summe aller Wiederholungen × Gewicht in diesem Workout
      </p>
    </div>
  );
}
