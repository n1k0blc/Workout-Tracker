'use client';

import { useCallback, useEffect, useState } from 'react';
import { IconChevronRight, IconPlus } from '@tabler/icons-react';
import { apiClient } from '@/lib/api';
import { MealListItem } from '@/types';
import { formatKcal, mealIngredientPreview } from '@/lib/nutrition';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MealEditorSheet } from './meal-editor-sheet';

function totalsLine(meal: MealListItem): string {
  const { kcal, carbs, protein, fat } = meal.totals;
  return `${formatKcal(kcal)} kcal · ${Math.round(carbs)} KH · ${Math.round(
    protein,
  )} P · ${Math.round(fat)} F`;
}

export default function MealsTab() {
  const [meals, setMeals] = useState<MealListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [mineTotal, setMineTotal] = useState(0);
  const [mineOnly, setMineOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  // 'create' | mealId | null
  const [editing, setEditing] = useState<string | 'create' | null>(null);

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
          {total.toLocaleString('de-DE')} {total === 1 ? 'Mahlzeit' : 'Mahlzeiten'} ·{' '}
          {mineTotal} eigene
        </p>
        <Button size="sm" onClick={() => setEditing('create')}>
          <IconPlus data-icon="inline-start" />
          Neu
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
        Nur meine
      </button>

      {loading && meals.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Lädt …</p>
      ) : meals.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          {mineOnly
            ? 'Du hast noch keine Mahlzeiten angelegt.'
            : 'Noch keine Mahlzeiten. Lege die erste an.'}
        </div>
      ) : (
        <div className="divide-y rounded-lg border bg-card">
          {meals.map((meal) => (
            <button
              key={meal.id}
              type="button"
              onClick={() => setEditing(meal.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{meal.name}</div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  {mealIngredientPreview(meal.ingredientNames)}
                </div>
                <div className="mt-1 text-xs">{totalsLine(meal)}</div>
              </div>
              <IconChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}

      <MealEditorSheet
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        mealId={editing && editing !== 'create' ? editing : undefined}
        onChanged={load}
      />
    </div>
  );
}
