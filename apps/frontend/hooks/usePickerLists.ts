'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { PickerItem } from '@/types';
import type { PickerTabId } from '@/components/nutrition/picker-tabs';
import { useFavoriteToggle } from './useFavoriteToggle';

/**
 * The Favoriten / Zuletzt machinery shared by the logging picker and the Mahlzeit editor's
 * Zutat search (#148), so the two cannot drift:
 *
 *  - `toggleFavorite` stars / unstars optimistically, reverting on error (via
 *    {@link useFavoriteToggle}, shared with every other favorite surface -- #193)
 *  - `effectiveFavorite` overlays those pending toggles on whatever `isFavorite` a row carries
 *  - the Favoriten and Zuletzt lists load lazily when their tab is first shown, and the
 *    Favoriten list reloads after every successful toggle (so an unstarred row leaves)
 *
 * A `null` list means "not loaded yet" -- the caller shows a loading line for that. `scope`
 * `'food'` restricts both lists to Lebensmittel: a Mahlzeit cannot be an ingredient.
 */
export function usePickerLists({
  open,
  tab,
  scope,
}: {
  open: boolean;
  tab: PickerTabId;
  scope?: 'food';
}) {
  const [favorites, setFavorites] = useState<PickerItem[] | null>(null);
  const [recents, setRecents] = useState<PickerItem[] | null>(null);
  const [favVersion, setFavVersion] = useState(0);
  const { effectiveFavorite, toggleFavorite, reset } = useFavoriteToggle(() =>
    setFavVersion((v) => v + 1),
  );

  // Fresh state every time the surface opens -- reset during render, not in an effect, so
  // the lists never briefly show stale rows (React's "you might not need an effect").
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      reset();
      setFavorites(null);
      setRecents(null);
      setFavVersion(0);
    }
  }

  useEffect(() => {
    if (!open || tab !== 'favoriten') return;
    let cancelled = false;
    apiClient
      .getPickerFavorites(scope)
      .then((data) => !cancelled && setFavorites(data.items))
      .catch(() => !cancelled && setFavorites([]));
    return () => {
      cancelled = true;
    };
  }, [open, tab, scope, favVersion]);

  useEffect(() => {
    if (!open || tab !== 'zuletzt') return;
    let cancelled = false;
    apiClient
      .getPickerRecent(scope)
      .then((data) => !cancelled && setRecents(data.items))
      .catch(() => !cancelled && setRecents([]));
    return () => {
      cancelled = true;
    };
  }, [open, tab, scope]);

  return {
    favorites,
    recents,
    effectiveFavorite,
    toggleFavorite,
  };
}
