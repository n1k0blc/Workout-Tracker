import { HomeGym } from '@/types';

interface GymTagProps {
  homeGym?: { id: string; name: string } | HomeGym | null;
  className?: string;
}

/**
 * Consistent Gym location tag.
 * - Named HomeGym → violet pill
 * - null / "Anderes Gym" → gray pill
 *
 * Follows the exact pattern used in workout history and cycle workout lists.
 */
export function GymTag({ homeGym, className = '' }: GymTagProps) {
  if (homeGym?.name) {
    return (
      <span
        className={`text-xs bg-violet-100 text-violet-800 px-2 py-1 rounded whitespace-nowrap ${className}`}
      >
        {homeGym.name}
      </span>
    );
  }

  return (
    <span
      className={`text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded whitespace-nowrap ${className}`}
    >
      Anderes Gym
    </span>
  );
}