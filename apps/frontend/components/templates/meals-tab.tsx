'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { IconChevronRight, IconPlus } from '@tabler/icons-react';
import { apiClient } from '@/lib/api';
import { MealListItem } from '@/types';
import { formatKcal, mealIngredientPreview, withFavoriteOverrides } from '@/lib/nutrition';
import { useFavoriteToggle } from '@/hooks/useFavoriteToggle';
import { Button } from '@/components/ui/button';
import { FavoriteStar } from '@/components/nutrition/favorite-star';
import { cn } from '@/lib/utils';

export default function MealsTab() {
  const t = useTranslations('MealsTab');
  const format = useFormatter();
  const router = useRouter();
  const [meals, setMeals] = useState<MealListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [mineTotal, setMineTotal] = useState(0);
  const [mineOnly, setMineOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const { effectiveFavorite, toggleFavorite } = useFavoriteToggle();

  const rows = useMemo(
    () => withFavoriteOverrides(meals, 'meal', effectiveFavorite),
    [meals, effectiveFavorite],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.getMeals(mineOnly);
      setMeals(data.items);
      setTotal(data.total);
      setMineTotal(data.mineTotal);
    } catch (error) {
      console.error('Failed to load meals:', error);
    } finally {
      setLoading(false);
    }
  }, [mineOnly]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t('count', { total, mine: mineTotal })}
        </p>
        <Button size="sm" onClick={() => router.push('/templates/meals/new')}>
          <IconPlus data-icon="inline-start" />
          {t('new')}
        </Button>
      </div>

      <button
        type="button"
        onClick={() => setMineOnly((v) => !v)}
        className={cn(
          'h-8 border px-3 text-xs font-semibold uppercase tracking-[0.08em]',
          mineOnly
            ? 'border-transparent bg-primary text-primary-foreground'
            : 'border-border bg-transparent text-muted-foreground',
        )}
      >
        {t('mineOnly')}
      </button>

      {loading && meals.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t('loading')}</p>
      ) : meals.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          {mineOnly ? t('emptyMine') : t('empty')}
        </div>
      ) : (
        <div className="divide-y rounded-lg border bg-card">
          {rows.map((meal) => (
            <div key={meal.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
              <button
                type="button"
                onClick={() => router.push(`/templates/meals/${meal.id}/edit`)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{meal.name}</div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {mealIngredientPreview(meal.ingredientNames)}
                  </div>
                  <div className="mt-1 text-xs">{t('totals', {
                      kcal: formatKcal(meal.totals.kcal),
                      carbs: format.number(Math.round(meal.totals.carbs)),
                      protein: format.number(Math.round(meal.totals.protein)),
                      fat: format.number(Math.round(meal.totals.fat)),
                    })}</div>
                </div>
                <IconChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
              <FavoriteStar
                favorite={meal.isFavorite}
                onToggle={() => toggleFavorite('meal', meal.id, meal.isFavorite)}
                label={meal.name}
              />
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
