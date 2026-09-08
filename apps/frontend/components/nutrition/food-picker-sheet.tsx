'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { IconBarcode, IconMinus, IconPlus, IconSearch, IconStar } from '@tabler/icons-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Food } from '@/types';
import {
  buildQuantityStops,
  defaultQuantityStopIndex,
  foodSourceLabel,
  formatKcal,
  formatQuantityLabel,
  scalePer100,
} from '@/lib/nutrition';
import { QuantityStepper } from './quantity-stepper';

const TABS = [
  { id: 'alle', label: 'Alle' },
  { id: 'favoriten', label: 'Favoriten' },
  { id: 'zuletzt', label: 'Zuletzt' },
] as const;
type TabId = (typeof TABS)[number]['id'];

interface BasketItem {
  key: string;
  foodId: string;
  grams: number;
  label: string;
}

let basketSeq = 0;

function rowSubtitle(food: Food): string {
  const unit = food.isLiquid ? 'ml' : 'g';
  const def = food.portions.find((p) => p.isDefault);
  if (def) {
    const kcal = Math.round(scalePer100(food, def.grams).kcal);
    return `${formatQuantityLabel(def.label, def.grams, food.isLiquid)} · ${kcal} kcal`;
  }
  return `100 ${unit} · ${Math.round(food.kcal)} kcal`;
}

export function FoodPickerSheet({
  open,
  onOpenChange,
  slotId,
  slotName,
  date,
  onCommitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slotId: string;
  slotName: string;
  date: string;
  onCommitted: () => void;
}) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<TabId>('alle');
  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [committing, setCommitting] = useState(false);

  useEffect(() => {
    if (open) {
      setSearch('');
      setTab('alle');
      setExpandedId(null);
      setBasket([]);
      setCommitting(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || tab !== 'alle') return;
    let cancelled = false;
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await apiClient.getFoods(search.trim() || undefined);
        if (!cancelled) setFoods(data);
      } catch {
        if (!cancelled) toast.error('Lebensmittel konnten nicht geladen werden');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [open, tab, search]);

  function addToBasket(foodId: string, grams: number, label: string) {
    setBasket((prev) => [...prev, { key: `b${++basketSeq}`, foodId, grams, label }]);
    setExpandedId(null);
  }

  async function commit() {
    if (basket.length === 0 || committing || !slotId) return;
    setCommitting(true);
    try {
      await apiClient.createDiaryEntriesBatch({
        mealSlotId: slotId,
        localDate: date,
        items: basket.map((b) => ({
          foodId: b.foodId,
          grams: b.grams,
          quantityLabel: b.label,
        })),
      });
      onOpenChange(false);
      onCommitted();
    } catch {
      toast.error('Einträge konnten nicht gespeichert werden');
      setCommitting(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto flex h-[88vh] max-w-2xl flex-col">
        <DrawerHeader className="flex-row items-center justify-between">
          <DrawerTitle>Hinzufügen</DrawerTitle>
          <span className="text-xs text-muted-foreground">{slotName}</span>
        </DrawerHeader>

        <div className="flex flex-col gap-3 px-4">
          <div className="flex items-center gap-2 border-b border-b-input">
            <IconSearch className="size-4 shrink-0 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Lebensmittel suchen..."
              className="border-b-0"
            />
            {/* Scanner is #149 -- icon only. */}
            <IconBarcode className="size-4 shrink-0 text-muted-foreground/50" />
          </div>

          <div className="flex gap-1 border-b">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'relative px-3 py-2 text-xs font-semibold uppercase tracking-[0.05em]',
                  tab === t.id ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {t.label}
                {tab === t.id && (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 bg-foreground" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {tab !== 'alle' ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {tab === 'favoriten' ? 'Favoriten' : 'Zuletzt'} folgen in Kürze.
            </p>
          ) : loading && foods.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Lädt …</p>
          ) : foods.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {search.trim() ? 'Nichts gefunden.' : 'Die Bibliothek ist noch leer.'}
            </p>
          ) : (
            <div className="divide-y rounded-lg border">
              {foods.map((food) => (
                <PickerRow
                  key={food.id}
                  food={food}
                  expanded={expandedId === food.id}
                  basketCount={basket.filter((b) => b.foodId === food.id).length}
                  onToggle={() =>
                    setExpandedId((id) => (id === food.id ? null : food.id))
                  }
                  onAdd={(grams, label) => addToBasket(food.id, grams, label)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="mt-auto flex gap-2 border-t p-4">
          <Button className="flex-1" onClick={commit} disabled={basket.length === 0 || committing}>
            {basket.length === 1
              ? '1 Eintrag übernehmen'
              : `${basket.length} Einträge übernehmen`}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function PickerRow({
  food,
  expanded,
  basketCount,
  onToggle,
  onAdd,
}: {
  food: Food;
  expanded: boolean;
  basketCount: number;
  onToggle: () => void;
  onAdd: (grams: number, label: string) => void;
}) {
  const sourceLabel = foodSourceLabel(food);

  return (
    <div className={cn(expanded && 'bg-muted/50')}>
      <div className="flex items-center gap-3 px-3.5 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-sm font-medium">{food.name}</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Lebensmittel
              {sourceLabel && ` · ${sourceLabel}`}
            </span>
            {basketCount > 0 && (
              <span className="text-[10px] font-semibold text-foreground">
                {basketCount}× im Korb
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">{rowSubtitle(food)}</div>
        </div>
        {/* Favorites are #148 -- star is inert. */}
        <IconStar className="size-4 shrink-0 text-muted-foreground/40" />
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={expanded ? 'Schließen' : `${food.name} hinzufügen`}
          onClick={onToggle}
        >
          {expanded ? <IconMinus /> : <IconPlus />}
        </Button>
      </div>

      {expanded && <ExpandedRow food={food} onAdd={onAdd} />}
    </div>
  );
}

function ExpandedRow({
  food,
  onAdd,
}: {
  food: Food;
  onAdd: (grams: number, label: string) => void;
}) {
  const stops = useMemo(() => buildQuantityStops(food.portions), [food.portions]);
  const [amount, setAmount] = useState(() => {
    const i = defaultQuantityStopIndex(
      stops,
      food.portions.find((p) => p.isDefault)?.label ?? null,
    );
    return { grams: stops[i]?.grams ?? 100, portionLabel: stops[i]?.label ?? null };
  });

  const totals = scalePer100(food, amount.grams);
  const label = formatQuantityLabel(amount.portionLabel, amount.grams, food.isLiquid);

  return (
    <div className="space-y-3 px-3.5 pb-4">
      <QuantityStepper
        portions={food.portions}
        isLiquid={food.isLiquid}
        grams={amount.grams}
        portionLabel={amount.portionLabel}
        onChange={(grams, portionLabel) => setAmount({ grams, portionLabel })}
      />

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {formatKcal(totals.kcal)} kcal · {Math.round(totals.carbs)} KH ·{' '}
          {Math.round(totals.protein)} P · {Math.round(totals.fat)} F
        </span>
        <Button size="sm" onClick={() => onAdd(amount.grams, label)}>
          Übernehmen
        </Button>
      </div>
    </div>
  );
}
