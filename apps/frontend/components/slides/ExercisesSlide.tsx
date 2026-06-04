import { IconBarbell } from '@tabler/icons-react';

interface ExercisesSlideProps {
  count: number;
}

export function ExercisesSlide({ count }: ExercisesSlideProps) {
  return (
    <div className="text-center space-y-6 animate-fadeIn">
      <div className="flex justify-center">
        <div className="p-4 bg-primary/10 rounded-full">
          <IconBarbell className="h-12 w-12 text-primary" />
        </div>
      </div>
      
      <h2 className="text-2xl font-semibold text-foreground">
        Übungen absolviert
      </h2>
      
      <div className="space-y-2">
        <div className="text-6xl font-bold text-primary">
          {count}
        </div>
        <div className="text-xl text-muted-foreground">
          {count === 1 ? 'Übung' : 'Übungen'}
        </div>
      </div>
      
      <p className="text-muted-foreground max-w-md mx-auto">
        Verschiedene Übungen in diesem Workout trainiert
      </p>
    </div>
  );
}
