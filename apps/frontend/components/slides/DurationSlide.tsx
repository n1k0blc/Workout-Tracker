import { formatDuration } from '@/lib/workoutStats';
import { IconClock } from '@tabler/icons-react';

interface DurationSlideProps {
  duration: number; // in seconds
}

export function DurationSlide({ duration }: DurationSlideProps) {
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  
  return (
    <div className="text-center space-y-6 animate-fadeIn">
      <div className="flex justify-center">
        <div className="p-4 bg-primary/10 rounded-full">
          <IconClock className="h-12 w-12 text-primary" />
        </div>
      </div>
      
      <h2 className="text-2xl font-semibold text-foreground">
        Workout-Dauer
      </h2>
      
      <div className="space-y-2">
        <div className="text-6xl font-bold text-primary">
          {formatDuration(duration)}
        </div>
        {seconds > 0 && (
          <div className="text-lg text-muted-foreground">
            ({minutes} Min {seconds} Sek)
          </div>
        )}
      </div>
      
      <p className="text-muted-foreground max-w-md mx-auto">
        Zeit von Start bis Abschluss deines Workouts
      </p>
    </div>
  );
}
