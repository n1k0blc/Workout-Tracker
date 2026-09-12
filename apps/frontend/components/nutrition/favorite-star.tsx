'use client';

import { IconStar, IconStarFilled } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

/**
 * The star that toggles a Lebensmittel or Mahlzeit favorite from any picker row (#148).
 * Filled when starred, hollow when not. The parent owns the (optimistic) state and the API
 * call -- see `usePickerFavorites`; this is presentation only.
 */
export function FavoriteStar({
  favorite,
  onToggle,
  label,
  className,
}: {
  favorite: boolean;
  onToggle: () => void;
  /** The item's name, for the accessible label ("Haferflocken zu Favoriten hinzufügen"). */
  label: string;
  className?: string;
}) {
  const Icon = favorite ? IconStarFilled : IconStar;
  return (
    <button
      type="button"
      aria-pressed={favorite}
      aria-label={
        favorite ? `${label} aus Favoriten entfernen` : `${label} zu Favoriten hinzufügen`
      }
      onClick={onToggle}
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-md transition-colors',
        favorite
          ? 'text-foreground'
          : 'text-muted-foreground/50 hover:text-muted-foreground',
        className,
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}
