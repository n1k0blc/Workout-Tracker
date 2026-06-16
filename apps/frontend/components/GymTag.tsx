import { HomeGym } from '@/types';
import { Badge } from '@/components/ui/badge';

interface GymTagProps {
  homeGym?: { id: string; name: string } | HomeGym | null;
  className?: string;
}

/**
 * Consistent Gym location tag using shadcn Badge.
 */
export function GymTag({ homeGym, className = '' }: GymTagProps) {
  if (homeGym?.name) {
    return (
      <Badge variant="secondary" className={className}>
        {homeGym.name}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={className}>
      Anderes Gym
    </Badge>
  );
}