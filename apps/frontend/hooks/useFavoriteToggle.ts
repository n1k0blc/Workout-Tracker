'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';

export type FavoriteKind = 'food' | 'meal';

/**
 * Optimistic star/unstar toggle for a Lebensmittel or Mahlzeit, shared by every favorite
 * surface (#148, #193) so they cannot drift: sets the star immediately, calls the matching
 * endpoint, and reverts with a toast if it fails.
 *
 * `onToggled` fires after a successful toggle -- {@link usePickerLists} uses it to reload the
 * Favoriten tab. Callers that don't need that can omit it.
 */
export function useFavoriteToggle(onToggled?: () => void) {
  const [overrides, setOverrides] = useState<Map<string, boolean>>(() => new Map());

  const effectiveFavorite = useCallback(
    (kind: FavoriteKind, id: string, fallback: boolean) =>
      overrides.get(`${kind}:${id}`) ?? fallback,
    [overrides],
  );

  const toggleFavorite = useCallback(
    async (kind: FavoriteKind, id: string, current: boolean) => {
      const key = `${kind}:${id}`;
      const next = !current;
      setOverrides((m) => new Map(m).set(key, next));
      try {
        if (kind === 'food') {
          await apiClient.setFoodFavorite(id, next);
        } else {
          await apiClient.setMealFavorite(id, next);
        }
        onToggled?.();
      } catch {
        setOverrides((m) => new Map(m).set(key, current));
        toast.error('Favorit konnte nicht gespeichert werden');
      }
    },
    [onToggled],
  );

  const reset = useCallback(() => setOverrides(new Map()), []);

  return { effectiveFavorite, toggleFavorite, reset };
}
