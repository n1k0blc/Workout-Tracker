'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { IconBarcode, IconChevronRight, IconPlus, IconSearch } from '@tabler/icons-react';
import { apiClient } from '@/lib/api';
import { Food } from '@/types';
import { foodSourceLabel, withFavoriteOverrides } from '@/lib/nutrition';
import { useFavoriteToggle } from '@/hooks/useFavoriteToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FavoriteStar } from '@/components/nutrition/favorite-star';
import { FoodEditorDialog } from './food-editor-dialog';
import { BarcodeScannerSheet } from '@/components/nutrition/barcode-scanner-sheet';

function subtitle(food: Food): string {
  const unit = food.isLiquid ? 'ml' : 'g';
  const base = `${Math.round(food.kcal)} kcal / 100 ${unit}`;
  const def = food.portions.find((p) => p.isDefault);
  return def ? `${base} · ${def.label} = ${Math.round(def.grams)} ${unit}` : base;
}

export default function FoodsTab() {
  const t = useTranslations('FoodsTab');
  const format = useFormatter();
  const [foods, setFoods] = useState<Food[]>([]);
  // Totals for the whole library, not the capped page the list renders (#146).
  const [totals, setTotals] = useState({ total: 0, ownTotal: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  // 'create' | Food | null
  const [editing, setEditing] = useState<Food | 'create' | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  // A scanned code that matched nothing: the create form opens with it prefilled (#149).
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const { effectiveFavorite, toggleFavorite } = useFavoriteToggle();

  const rows = useMemo(
    () => withFavoriteOverrides(foods, 'food', effectiveFavorite),
    [foods, effectiveFavorite],
  );

  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await apiClient.getFoods(search.trim() || undefined);
        if (!cancelled) {
          setFoods(data.items);
          setTotals({ total: data.total, ownTotal: data.ownTotal });
        }
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
      const data = await apiClient.getFoods(search.trim() || undefined);
      setFoods(data.items);
      setTotals({ total: data.total, ownTotal: data.ownTotal });
    } catch (error) {
      console.error('Failed to reload foods:', error);
    }
  };


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t('count', { total: format.number(totals.total), own: totals.ownTotal })}
          {totals.total > foods.length && ` · ${t('shown', { shown: foods.length })}`}
        </p>
        <Button size="sm" onClick={() => setEditing('create')}>
          <IconPlus data-icon="inline-start" />
          {t('new')}
        </Button>
      </div>

      <div className="flex items-center gap-2 border-b border-b-input">
        <IconSearch className="size-4 shrink-0 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="border-b-0"
        />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('scanBarcode')}
          onClick={() => setScannerOpen(true)}
        >
          <IconBarcode />
        </Button>
      </div>

      {loading && foods.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t('loading')}</p>
      ) : foods.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          {search.trim() ? t('noResults') : t('empty')}
        </div>
      ) : (
        <div className="divide-y rounded-lg border bg-card">
          {rows.map((food) => {
            const badge = foodSourceLabel(food, {
              own: t('sourceOwn'),
              system: t('sourceSystem'),
              openFoodFacts: t('sourceOpenFoodFacts'),
            });
            return (
              <div key={food.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                <button
                  type="button"
                  onClick={() => setEditing(food)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
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
                <FavoriteStar
                  favorite={food.isFavorite}
                  onToggle={() => toggleFavorite('food', food.id, food.isFavorite)}
                  label={food.name}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* ODbL attribution for the imported products (#146). */}
      <p className="text-xs text-muted-foreground">
        {t.rich('attribution', {
          link: (chunks) => (
            <a
              href="https://world.openfoodfacts.org"
              target="_blank"
              rel="noreferrer noopener"
              className="underline underline-offset-2"
            >
              {chunks}
            </a>
          ),
        })}
      </p>

      {/* A hit opens the food rather than logging it -- this tab is library management. */}
      <BarcodeScannerSheet
        open={scannerOpen}
        // The scan result has its own favorite star (#193), separate from this list's -- reload
        // on close so a toggle made there is reflected here without waiting for an edit save.
        onOpenChange={(next) => {
          setScannerOpen(next);
          if (!next) reload();
        }}
        mode={{
          kind: 'pick',
          label: t('open'),
          // An imported food opens read-only, so "check it" is the honest word for it.
          openFoodFactsLabel: t('check'),
          onPick: (food) => {
            setScannerOpen(false);
            setEditing(food);
          },
        }}
        onCreateFood={(barcode) => {
          setScannerOpen(false);
          setScannedBarcode(barcode);
          setEditing('create');
        }}
      />

      <FoodEditorDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            setScannedBarcode(null);
          }
        }}
        food={editing === 'create' || editing === null ? undefined : editing}
        initialBarcode={scannedBarcode ?? undefined}
        onChanged={reload}
      />
    </div>
  );
}
