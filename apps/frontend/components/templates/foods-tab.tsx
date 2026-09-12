'use client';

import { useEffect, useState } from 'react';
import { IconBarcode, IconChevronRight, IconPlus, IconSearch } from '@tabler/icons-react';
import { apiClient } from '@/lib/api';
import { Food } from '@/types';
import { foodSourceLabel } from '@/lib/nutrition';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FoodEditorDialog } from './food-editor-dialog';
import { BarcodeScannerSheet } from '@/components/nutrition/barcode-scanner-sheet';

function subtitle(food: Food): string {
  const unit = food.isLiquid ? 'ml' : 'g';
  const base = `${Math.round(food.kcal)} kcal / 100 ${unit}`;
  const def = food.portions.find((p) => p.isDefault);
  return def ? `${base} · ${def.label} = ${Math.round(def.grams)} ${unit}` : base;
}

export default function FoodsTab() {
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
          {totals.total.toLocaleString('de-DE')} Lebensmittel · {totals.ownTotal} eigene
          {totals.total > foods.length && ` · ${foods.length} angezeigt`}
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
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Barcode scannen"
          onClick={() => setScannerOpen(true)}
        >
          <IconBarcode />
        </Button>
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
            const badge = foodSourceLabel(food);
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

      {/* ODbL attribution for the imported products (#146). */}
      <p className="text-xs text-muted-foreground">
        Produktdaten teilweise aus{' '}
        <a
          href="https://world.openfoodfacts.org"
          target="_blank"
          rel="noreferrer noopener"
          className="underline underline-offset-2"
        >
          Open Food Facts
        </a>
        , Lizenz ODbL.
      </p>

      {/* A hit opens the food rather than logging it -- this tab is library management. */}
      <BarcodeScannerSheet
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        mode={{
          kind: 'pick',
          label: 'Öffnen',
          // An imported food opens read-only, so "check it" is the honest word for it.
          openFoodFactsLabel: 'Prüfen',
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
