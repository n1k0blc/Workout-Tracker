import { Workout, SetType } from '@/types';
import { IconClipboardList, IconFlame, IconBarbell } from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';

interface SummarySlideProps {
  workout: Workout;
}

export function SummarySlide({ workout }: SummarySlideProps) {
  return (
    <div className="space-y-6 animate-fadeIn max-h-[400px] overflow-y-auto">
      <div className="text-center mb-6">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <IconClipboardList className="h-10 w-10 text-primary" />
          </div>
        </div>
        <h2 className="text-2xl font-semibold text-foreground">
          Workout-Übersicht
        </h2>
      </div>

      {/* Exercises */}
      <div className="space-y-3">
        {workout.exercises.map((exercise, idx) => (
          <div key={exercise.id} className="border border-border bg-card rounded-lg p-4">
            <div className="mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  #{idx + 1}
                </span>
                <h4 className="text-base font-semibold text-foreground">
                  {exercise.exerciseName}
                </h4>
              </div>
            </div>

            {/* Sets - consistent with ExerciseCard set type styling */}
            <div className="space-y-1.5">
              {exercise.sets
                .sort((a, b) => a.setNumber - b.setNumber)
                .map((set) => {
                  const isWarmup = set.setType === SetType.WARMUP;
                  return (
                    <div
                      key={set.id}
                      className="flex items-center justify-between p-2 rounded text-sm border border-border bg-muted/30"
                    >
                      <Badge variant={isWarmup ? 'outline' : 'default'} className="text-xs px-1.5 py-0.5">
                        {isWarmup ? (
                          <>
                            <IconFlame className="size-3 mr-1" /> Aufwärmen
                          </>
                        ) : (
                          <>
                            <IconBarbell className="size-3 mr-1" /> Arbeit
                          </>
                        )}
                      </Badge>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-foreground tabular-nums">
                          {set.weight}kg × {set.reps}
                        </span>
                        {set.rir !== undefined && set.rir !== null && (
                          <span className="text-muted-foreground text-xs">
                            RIR {set.rir}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
