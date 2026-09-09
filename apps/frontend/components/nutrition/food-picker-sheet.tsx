'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { IconBarcode, IconMinus, IconPlus, IconSearch } from '@tabler/icons-react';
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
import { Food, MealListItem, PickerItem } from '@/types';
import {
  buildQuantityStops,
  defaultQuantityStopIndex,
  foodSourceLabel,
  formatFactor,
  formatKcal,
  formatQuantityLabel,
  mealIngredientPreview,
  scaleMacros,
  scalePer100,
  sortFavoritesFirst,
  QUANTITY_FACTORS,
} from '@/lib/nutrition';
import { usePickerLists } from '@/hooks/usePickerLists';
import { QuantityStepper } from './quantity-stepper';
import { FavoriteStar } from './favorite-star';
import {
  PickerTabBar,
  PickerTabPlaceholder,
  LOGGING_PICKER_TABS,
  FAVORITEN_EMPTY,
  ZULETZT_EMPTY,
  PICKER_LOADING,
  type PickerTabId,
} from './picker-tabs';

interface FoodBasketItem {
  key: string;
  kind: 'food';
  title: string;
  foodId: string;
  grams: number;
  label: string;
}
interface MealBasketItem {
  key: string;
  kind: 'meal';
  title: string;
  mealId: string;
  factor: number;
}
type BasketItem = FoodBasketItem | MealBasketItem;

type PickerRow =
  | { kind: 'food'; key: string; name: string; food: Food }
  | { kind: 'meal'; key: string; name: string; meal: MealListItem };

/** A Favoriten / Zuletzt list item in the same shape the "Alle" rows use. */
function toPickerRow(item: PickerItem): PickerRow {
  return item.kind === 'food'
    ? { kind: 'food', key: `food:${item.food.id}`, name: item.food.name, food: item.food }
    : { kind: 'meal', key: `meal:${item.meal.id}`, name: item.meal.name, meal: item.meal };
}

let basketSeq = 0;

function foodRowSubtitle(food: Food): string {
  const unit = food.isLiquid ? 'ml' : 'g';
  const def = food.portions.find((p) => p.isDefault);
  if (def) {
    const kcal = Math.round(scalePer100(food, def.grams).kcal);
    return `${formatQuantityLabel(def.label, def.grams, food.isLiquid)} · ${kcal} kcal`;
  }
  return `100 ${unit} · ${Math.round(food.kcal)} kcal`;
}

function mealRowSubtitle(meal: MealListItem): string {
  const zutaten = `${meal.itemCount} ${meal.itemCount === 1 ? 'Zutat' : 'Zutaten'}`;
  return `${mealIngredientPreview(meal.ingredientNames)} · ${zutaten} · ${formatKcal(
    meal.totals.kcal,
  )} kcal`;
}

export function FoodPickerSheet({
  open,
  onOpenChange,
  slotId,
  slotName,
  date,
  onCommitted,
  onScanRequest,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slotId: string;
  slotName: string;
  date: string;
  onCommitted: () => void;
  /**
   * The scan button. The scanner itself belongs to the page, not in here -- see the comment on
   * `ScanToLog`. This only reports the tap.
   */
  onScanRequest: () => void;
}) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<PickerTabId>('lebensmittel');
  const [foods, setFoods] = useState<Food[]>([]);
  const [meals, setMeals] = useState<MealListItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [committing, setCommitting] = useState(false);

  const { favorites, recents, effectiveFavorite, toggleFavorite } = usePickerLists({
    open,
    tab,
  });

  useEffect(() => {
    if (open) {
      setSearch('');
      setTab('lebensmittel');
      setExpandedKey(null);
      setBasket([]);
      setCommitting(false);
    }
  }, [open]);

  // Meals are a short list -- load them once per open and filter client-side.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    apiClient
      .getMeals()
      .then((data) => !cancelled && setMeals(data.items))
      .catch(() => !cancelled && setMeals([]));
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || tab !== 'lebensmittel') return;
    let cancelled = false;
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await apiClient.getFoods(search.trim() || undefined);
        if (!cancelled) setFoods(data.items);
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

  // Lebensmittel and Mahlzeiten are separate tabs (#155): at ~180k imported foods a handful
  // of meals is unfindable in a merged list, and the two are logged differently anyway (a
  // Menge vs. a Faktor). Search filters within the active tab only.

  // Foods keep the server's source ranking (#155) -- no client re-sort -- with starred rows
  // floating to the top (#148).
  const foodRows: PickerRow[] = useMemo(
    () =>
      sortFavoritesFirst(
        foods.map((f) => ({
          kind: 'food' as const,
          key: `food:${f.id}`,
          name: f.name,
          food: f,
          isFavorite: effectiveFavorite('food', f.id, f.isFavorite),
        })),
      ),
    [foods, effectiveFavorite],
  );

  const mealRows: PickerRow[] = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matched = (meals ?? [])
      .filter(
        (m) =>
          !term ||
          m.name.toLowerCase().includes(term) ||
          m.ingredientNames.some((n) => n.toLowerCase().includes(term)),
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))
      .map((m) => ({
        kind: 'meal' as const,
        key: `meal:${m.id}`,
        name: m.name,
        meal: m,
        isFavorite: effectiveFavorite('meal', m.id, m.isFavorite),
      }));
    return sortFavoritesFirst(matched);
  }, [meals, search, effectiveFavorite]);

  const favoriteRows = useMemo(
    () =>
      (favorites ?? [])
        .map(toPickerRow)
        .filter((r) =>
          r.kind === 'food'
            ? effectiveFavorite('food', r.food.id, true)
            : effectiveFavorite('meal', r.meal.id, true),
        ),
    [favorites, effectiveFavorite],
  );
  const recentRows = useMemo(() => (recents ?? []).map(toPickerRow), [recents]);

  function addFood(food: Food, grams: number, label: string) {
    setBasket((prev) => [
      ...prev,
      { key: `b${++basketSeq}`, kind: 'food', title: food.name, foodId: food.id, grams, label },
    ]);
    setExpandedKey(null);
  }

  function addMeal(meal: MealListItem, factor: number) {
    setBasket((prev) => [
      ...prev,
      {
        key: `b${++basketSeq}`,
        kind: 'meal',
        title: meal.name,
        mealId: meal.id,
        factor,
      },
    ]);
    setExpandedKey(null);
  }

  async function commit() {
    if (basket.length === 0 || committing || !slotId) return;
    setCommitting(true);
    try {
      const foodItems = basket.filter((b): b is FoodBasketItem => b.kind === 'food');
      const mealItems = basket.filter((b): b is MealBasketItem => b.kind === 'meal');
      // Foods go in one batch request; each meal expands server-side in its own request.
      await Promise.all([
        ...(foodItems.length > 0
          ? [
              apiClient.createDiaryEntriesBatch({
                mealSlotId: slotId,
                localDate: date,
                items: foodItems.map((b) => ({
                  foodId: b.foodId,
                  grams: b.grams,
                  quantityLabel: b.label,
                })),
              }),
            ]
          : []),
        ...mealItems.map((m) =>
          apiClient.createDiaryEntriesFromMeal({
            mealSlotId: slotId,
            localDate: date,
            mealId: m.mealId,
            factor: m.factor,
          }),
        ),
      ]);
      onOpenChange(false);
      onCommitted();
    } catch {
      toast.error('Einträge konnten nicht gespeichert werden');
      setCommitting(false);
    }
  }

  function renderRows(list: PickerRow[]) {
    return (
      <div className="divide-y rounded-lg border">
        {list.map((row) =>
          row.kind === 'food' ? (
            <FoodPickerRow
              key={row.key}
              food={row.food}
              favorite={effectiveFavorite('food', row.food.id, row.food.isFavorite)}
              onToggleFavorite={() =>
                toggleFavorite(
                  'food',
                  row.food.id,
                  effectiveFavorite('food', row.food.id, row.food.isFavorite),
                )
              }
              expanded={expandedKey === row.key}
              basketCount={
                basket.filter((b) => b.kind === 'food' && b.foodId === row.food.id).length
              }
              onToggle={() => setExpandedKey((k) => (k === row.key ? null : row.key))}
              onAdd={(grams, label) => addFood(row.food, grams, label)}
            />
          ) : (
            <MealPickerRow
              key={row.key}
              meal={row.meal}
              favorite={effectiveFavorite('meal', row.meal.id, row.meal.isFavorite)}
              onToggleFavorite={() =>
                toggleFavorite(
                  'meal',
                  row.meal.id,
                  effectiveFavorite('meal', row.meal.id, row.meal.isFavorite),
                )
              }
              expanded={expandedKey === row.key}
              basketCount={
                basket.filter((b) => b.kind === 'meal' && b.mealId === row.meal.id).length
              }
              onToggle={() => setExpandedKey((k) => (k === row.key ? null : row.key))}
              onAdd={(factor) => addMeal(row.meal, factor)}
            />
          ),
        )}
      </div>
    );
  }

  const placeholder = (message: string) => (
    <PickerTabPlaceholder>{message}</PickerTabPlaceholder>
  );

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
              placeholder="Lebensmittel oder Mahlzeit suchen..."
              className="border-b-0"
            />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Barcode scannen"
              onClick={onScanRequest}
            >
              <IconBarcode />
            </Button>
          </div>

          <PickerTabBar tab={tab} onTab={setTab} tabs={LOGGING_PICKER_TABS} />
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {tab === 'lebensmittel' &&
            (loading && foodRows.length === 0
              ? placeholder(PICKER_LOADING)
              : foodRows.length === 0
                ? placeholder(
                    search.trim() ? 'Nichts gefunden.' : 'Die Bibliothek ist noch leer.',
                  )
                : renderRows(foodRows))}

          {tab === 'mahlzeiten' &&
            (meals === null
              ? placeholder(PICKER_LOADING)
              : mealRows.length === 0
                ? placeholder(
                    search.trim()
                      ? 'Keine Mahlzeit gefunden.'
                      : 'Noch keine Mahlzeiten. Lege welche in den Vorlagen an.',
                  )
                : renderRows(mealRows))}

          {tab === 'favoriten' &&
            (favorites === null
              ? placeholder(PICKER_LOADING)
              : favoriteRows.length === 0
                ? placeholder(FAVORITEN_EMPTY)
                : renderRows(favoriteRows))}

          {tab === 'zuletzt' &&
            (recents === null
              ? placeholder(PICKER_LOADING)
              : recentRows.length === 0
                ? placeholder(ZULETZT_EMPTY)
                : renderRows(recentRows))}
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

function FoodPickerRow({
  food,
  favorite,
  onToggleFavorite,
  expanded,
  basketCount,
  onToggle,
  onAdd,
}: {
  food: Food;
  favorite: boolean;
  onToggleFavorite: () => void;
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
          <div className="mt-0.5 text-xs text-muted-foreground">{foodRowSubtitle(food)}</div>
        </div>
        <FavoriteStar favorite={favorite} onToggle={onToggleFavorite} label={food.name} />
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={expanded ? 'Schließen' : `${food.name} hinzufügen`}
          onClick={onToggle}
        >
          {expanded ? <IconMinus /> : <IconPlus />}
        </Button>
      </div>

      {expanded && <ExpandedFoodRow food={food} onAdd={onAdd} />}
    </div>
  );
}

function ExpandedFoodRow({
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

function MealPickerRow({
  meal,
  favorite,
  onToggleFavorite,
  expanded,
  basketCount,
  onToggle,
  onAdd,
}: {
  meal: MealListItem;
  favorite: boolean;
  onToggleFavorite: () => void;
  expanded: boolean;
  basketCount: number;
  onToggle: () => void;
  onAdd: (factor: number) => void;
}) {
  const [factor, setFactor] = useState(1);

  const scaled = scaleMacros(meal.totals, factor);

  return (
    <div className={cn(expanded && 'bg-muted/50')}>
      <div className="flex items-center gap-3 px-3.5 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-sm font-medium">{meal.name}</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-foreground">
              Mahlzeit
            </span>
            {meal.editable && (
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                · Meine
              </span>
            )}
            {basketCount > 0 && (
              <span className="text-[10px] font-semibold text-foreground">
                {basketCount}× im Korb
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {mealRowSubtitle(meal)}
          </div>
        </div>
        <FavoriteStar favorite={favorite} onToggle={onToggleFavorite} label={meal.name} />
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={expanded ? 'Schließen' : `${meal.name} hinzufügen`}
          onClick={onToggle}
        >
          {expanded ? <IconMinus /> : <IconPlus />}
        </Button>
      </div>

      {expanded && (
        <div className="space-y-3 px-3.5 pb-4">
          <div className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Faktor
            </span>
            <div className="flex border">
              {QUANTITY_FACTORS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFactor(f)}
                  className={cn(
                    'h-9 px-3.5 text-xs font-semibold tracking-[0.08em]',
                    f === factor
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-transparent text-muted-foreground',
                  )}
                >
                  {formatFactor(f)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {formatKcal(scaled.kcal)} kcal · {Math.round(scaled.carbs)} KH ·{' '}
              {Math.round(scaled.protein)} P · {Math.round(scaled.fat)} F
            </span>
            <Button size="sm" onClick={() => onAdd(factor)}>
              Übernehmen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
