import { PersonalRecord } from '@/types';
import { formatPRType, formatPRValue } from '@/lib/prUtils';
import { GymTag } from './GymTag';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PersonalRecordCardProps {
  pr: PersonalRecord;
  /** Show the date line (default: true) */
  showDate?: boolean;
  /** Additional classes for density adjustments (e.g. in tight grids) */
  className?: string;
}

/**
 * Unified Personal Record card with the preferred gradient design
 * + consistent Gym Tag below the exercise name.
 *
 * Used on: Dashboard, Analytics, Cycle Detail, and Post-Workout Celebration.
 */
export function PersonalRecordCard({
  pr,
  showDate = true,
  className = '',
}: PersonalRecordCardProps) {
  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="font-semibold">{pr.exerciseName}</div>

            {/* Gym Tag directly below exercise name */}
            <div className="mt-1.5">
              <GymTag homeGym={pr.homeGym} />
            </div>

            {showDate && (
              <div className="text-sm text-muted-foreground mt-2">
                {formatPRType(pr.type)} PR • {formatDate(pr.date)}
              </div>
            )}
          </div>

          <div className="text-right shrink-0">
            <div className="text-2xl font-bold text-primary">
              {formatPRValue(pr)}
            </div>
            {pr.details?.weight && pr.details?.reps && (
              <div className="text-sm text-muted-foreground mt-1">
                {pr.details.weight} kg × {pr.details.reps}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}