import { formatVolume } from '@/lib/workoutStats';
import { IconTrendingUp } from '@tabler/icons-react';

interface VolumeSlideProps {
  volume: number;
}

export function VolumeSlide({ volume }: VolumeSlideProps) {
  return (
    <div className="text-center space-y-6 animate-fadeIn">
      <div className="flex justify-center">
        <div className="p-4 bg-primary/10 rounded-full">
          <IconTrendingUp className="h-12 w-12 text-primary" />
        </div>
      </div>
      
      <h2 className="text-2xl font-semibold text-foreground">
        Gesamtvolumen
      </h2>
      
      <div className="space-y-2">
        <div className="text-6xl font-bold text-primary">
          {formatVolume(volume)}
        </div>
        <div className="text-xl text-muted-foreground">
          kg bewegt
        </div>
      </div>
      
      <p className="text-muted-foreground max-w-md mx-auto">
        Das ist die Summe aller Wiederholungen × Gewicht in diesem Workout
      </p>
    </div>
  );
}
