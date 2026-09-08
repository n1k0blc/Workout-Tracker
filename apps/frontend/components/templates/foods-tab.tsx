'use client';

import { useEffect, useState } from 'react';
import { IconChevronRight, IconPlus, IconSearch } from '@tabler/icons-react';
import { apiClient } from '@/lib/api';
import { Food } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FoodEditorDialog } from './food-editor-dialog';

function sourceBadge(food: Food): string | null {
  if (food.editable) return 'Eigenes';
  if (food.source === 'SEED') return 'System';
  if (food.source === 'OPEN_FOOD_FACTS') return 'Open Food Facts';
  return null; // another user's food -- no byline
}

function subtitle(food: Food): string {
  const unit = food.isLiquid ? 'ml' : 'g';
  const base = `${Math.round(food.kcal)} kcal / 100 ${unit}`;
  const def = food.portions.find((p) => p.isDefault);
  return def ? `${base} · ${def.label} = ${Math.round(def.grams)} ${unit}` : base;
}

export default function FoodsTab() {
  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  // 'create' | Food | null
  const [editing, setEditing] = useState<Food | 'create' | null>(null);

  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await apiClient.getFoods(search.trim() || undefined);
        if (!cancelled) setFoods(data);
      } catch (error) {
        console.error('Failed to load foods:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [search]);

  const reload = async () => {
    try {
      setFoods(await apiClient.getFoods(search.trim() || undefined));
    } catch (error) {
      console.error('Failed to reload foods:', error);
    }
  };

  const ownCount = foods.filter((f) => f.editable).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {foods.length} Lebensmittel · {ownCount} eigene
        </p>
        <Button size="sm" onClick={() => setEditing('create')}>
          <IconPlus data-icon="inline-start" />
          Neu
        </Button>
      </div>

      <div className="flex items-center gap-2 border-b border-b-input">
        <IconSearch className="size-4 shrink-0 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Lebensmittel suchen..."
          className="border-b-0"
        />
      </div>

      {loading && foods.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Lädt …</p>
      ) : foods.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          {search.trim()
            ? 'Keine Lebensmittel gefunden.'
            : 'Noch keine Lebensmittel. Lege das erste an.'}
        </div>
      ) : (
        <div className="divide-y rounded-lg border bg-card">
          {foods.map((food) => {
            const badge = sourceBadge(food);
            return (
              <button
                key={food.id}
                type="button"
                onClick={() => setEditing(food)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{food.name}</span>
                    {badge && (
                      <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                        {badge}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{subtitle(food)}</div>
                </div>
                <IconChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            );
          })}
        </div>
      )}

      <FoodEditorDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        food={editing === 'create' || editing === null ? undefined : editing}
        onChanged={reload}
      />
    </div>
  );
}
