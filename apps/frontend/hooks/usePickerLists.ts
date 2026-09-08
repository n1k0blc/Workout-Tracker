'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { PickerItem } from '@/types';

type Kind = 'food' | 'meal';
type Tab = 'alle' | 'favoriten' | 'zuletzt';

/**
 * The Favoriten / Zuletzt machinery shared by the logging picker and the Mahlzeit editor's
 * Zutat search (#148), so the two cannot drift:
 *
 *  - `toggleFavorite` stars / unstars optimistically, reverting on error
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
  tab: Tab;
  scope?: 'food';
}) {
  const [overrides, setOverrides] = useState<Map<string, boolean>>(() => new Map());
  const [favorites, setFavorites] = useState<PickerItem[] | null>(null);
  const [recents, setRecents] = useState<PickerItem[] | null>(null);
  const [favVersion, setFavVersion] = useState(0);

  // Fresh state every time the surface opens -- reset during render, not in an effect, so
  // the lists never briefly show stale rows (React's "you might not need an effect").
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setOverrides(new Map());
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

  const effectiveFavorite = useCallback(
    (kind: Kind, id: string, fallback: boolean) =>
      overrides.get(`${kind}:${id}`) ?? fallback,
    [overrides],
  );

  const toggleFavorite = useCallback(async (kind: Kind, id: string, current: boolean) => {
    const key = `${kind}:${id}`;
    const next = !current;
    setOverrides((m) => new Map(m).set(key, next));
    try {
      if (kind === 'food') {
        await apiClient.setFoodFavorite(id, next);
      } else {
        await apiClient.setMealFavorite(id, next);
      }
      setFavVersion((v) => v + 1);
    } catch {
      setOverrides((m) => new Map(m).set(key, current));
      toast.error('Favorit konnte nicht gespeichert werden');
    }
  }, []);

  return {
    favorites,
    recents,
    effectiveFavorite,
    toggleFavorite,
  };
}
