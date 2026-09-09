'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  IconArrowLeft,
  IconBarcode,
  IconGripVertical,
  IconPlus,
  IconSearch,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ProtectedRoute } from '@/components/protected-route';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api';
import { Food, FoodPortion, MealItem, PickerItem } from '@/types';
import {
  computeMealTotals,
  formatKcal,
  formatQuantityLabel,
  scalePer100,
  sortFavoritesFirst,
} from '@/lib/nutrition';
import { QuantityStepper } from '@/components/nutrition/quantity-stepper';
import { FavoriteStar } from '@/components/nutrition/favorite-star';
import {
  PickerTabBar,
  PickerTabPlaceholder,
  ZUTAT_PICKER_TABS,
  FAVORITEN_EMPTY,
  ZULETZT_EMPTY,
  PICKER_LOADING,
  type PickerTabId,
} from '@/components/nutrition/picker-tabs';
import { usePickerLists } from '@/hooks/usePickerLists';
import { ScanFlow } from '@/components/nutrition/scan-flow';

/** Where Speichern, Abbrechen and Löschen all return to. */
const MEALS_TAB = '/templates?tab=meals';

/** An ingredient being edited: the food's live nutrients plus the chosen amount. */
interface EditorItem {
  key: string;
  foodId: string;
  foodName: string;
  isLiquid: boolean;
  deleted: boolean;
  per100: { kcal: number; carbs: number; protein: number; fat: number };
  portions: FoodPortion[];
  quantity: number;
  portionLabel: string | null;
}

let itemKeySeq = 0;
const newItemKey = () => `mi${++itemKeySeq}`;

/** The portion whose grams match this amount, if any -- so a loaded item keeps its label. */
function portionLabelFor(
  quantity: number,
  portions: { label: string; grams: number }[],
): string | null {
  const p = portions.find((x) => Math.round(x.grams) === Math.round(quantity));
  return p ? p.label : null;
}

function fromMealItem(item: MealItem): EditorItem {
  return {
    key: newItemKey(),
    foodId: item.foodId,
    foodName: item.foodName,
    isLiquid: item.isLiquid,
    deleted: item.deleted,
    per100: item.per100,
    portions: item.portions,
    quantity: item.quantity,
    portionLabel: portionLabelFor(item.quantity, item.portions),
  };
}

function fromFood(food: Food): EditorItem {
  const def = food.portions.find((p) => p.isDefault) ?? food.portions[0];
  return {
    key: newItemKey(),
    foodId: food.id,
    foodName: food.name,
    isLiquid: food.isLiquid,
    deleted: food.deleted,
    per100: { kcal: food.kcal, carbs: food.carbs, protein: food.protein, fat: food.fat },
    portions: food.portions,
    quantity: def ? def.grams : 100,
    portionLabel: def ? def.label : null,
  };
}

function itemSubtitle(item: EditorItem): string {
  const kcal = Math.round(scalePer100(item.per100, item.quantity).kcal);
  return `${formatQuantityLabel(item.portionLabel, item.quantity, item.isLiquid)} · ${kcal} kcal`;
}

/**
 * What a save would send. Compared against the loaded Mahlzeit to answer "is this dirty?" --
 * reordering counts, and so does an amount change, because both are part of the payload.
 */
function signature(name: string, items: EditorItem[]): string {
  return JSON.stringify([name.trim(), items.map((i) => [i.foodId, i.quantity])]);
}

/**
 * Create / edit a Mahlzeit (#147), as a page rather than the bottom sheet it shipped as.
 *
 * A Mahlzeit is a live combination of Lebensmittel with quantities: the totals here are
 * recomputed from the foods' current nutrients, and logging it later expands it into
 * snapshotted Einträge. Only the creator can edit -- another user's Mahlzeit opens read-only.
 *
 * `/templates/meals/new` and `/templates/meals/[id]/edit` both render this, so creating and
 * editing are the same screen. It was a bottom sheet until the drawer proved awkward on a
 * phone: the Zutat search and the ingredient list had to share one 92vh sheet, and the drag
 * handles fought the sheet's own drag-to-dismiss.
 */
export default function MealEditorScreen({ mealId }: { mealId?: string }) {
  const router = useRouter();
  const isEdit = mealId != null;

  const [loading, setLoading] = useState(isEdit);
  const [readOnly, setReadOnly] = useState(false);
  const [name, setName] = useState('');
  const [items, setItems] = useState<EditorItem[]>([]);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // The payload as loaded. Null until the Mahlzeit arrives, so a slow load cannot look dirty.
  const [baseline, setBaseline] = useState<string | null>(isEdit ? null : signature('', []));

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTab, setSearchTab] = useState<PickerTabId>('lebensmittel');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Food[]>([]);
  const [searching, setSearching] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  // Favoriten / Zuletzt for the Zutat search -- foods only, a meal cannot be an ingredient.
  const fav = usePickerLists({ open: searchOpen, tab: searchTab, scope: 'food' });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (!mealId) return;
    let cancelled = false;
    setLoading(true);
    apiClient
      .getMeal(mealId)
      .then((meal) => {
        if (cancelled) return;
        setReadOnly(!meal.editable);
        setName(meal.name);
        const loaded = meal.items.map(fromMealItem);
        setItems(loaded);
        setBaseline(signature(meal.name, loaded));
      })
      .catch(() => {
        if (!cancelled) setError('Mahlzeit konnte nicht geladen werden.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mealId]);

  // Food search for the "Zutat" picker -- only the Lebensmittel tab queries; Favoriten /
  // Zuletzt are served by usePickerLists (#148). No Mahlzeiten tab here: a Mahlzeit cannot be
  // an ingredient of another one (#155).
  useEffect(() => {
    if (!searchOpen || searchTab !== 'lebensmittel') return;
    let cancelled = false;
    const id = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await apiClient.getFoods(search.trim() || undefined);
        if (!cancelled) setResults(data.items);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [searchOpen, searchTab, search]);

  const dirty = !readOnly && baseline !== null && signature(name, items) !== baseline;

  // Covers a reload, a closed tab and a followed link out of the app. In-app navigation is
  // guarded by `leave()` below. The browser's own back button and the iOS swipe-back gesture
  // are *not* intercepted -- the App Router has no supported hook for that.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const totals = useMemo(
    () => computeMealTotals(items.map((i) => ({ per100: i.per100, quantity: i.quantity }))),
    [items],
  );

  /** Back to the Mahlzeiten tab, asking first when there is unsaved work. */
  const leave = useCallback(() => {
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    router.push(MEALS_TAB);
  }, [dirty, router]);

  function openSearch() {
    setSearchOpen(true);
    setSearchTab('lebensmittel');
    setSearch('');
    setResults([]);
  }

  function addFood(food: Food) {
    setItems((prev) => [...prev, fromFood(food)]);
    toast.success(`${food.name} hinzugefügt`);
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
    if (expandedKey === key) setExpandedKey(null);
  }

  function setItemAmount(key: string, quantity: number, portionLabel: string | null) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, quantity, portionLabel } : i)));
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const from = prev.findIndex((i) => i.key === active.id);
      const to = prev.findIndex((i) => i.key === over.id);
      return from === -1 || to === -1 ? prev : arrayMove(prev, from, to);
    });
  }

  async function handleSave() {
    setError('');
    if (!name.trim()) {
      setError('Bitte gib einen Namen ein.');
      return;
    }
    if (items.length === 0) {
      setError('Eine Mahlzeit braucht mindestens eine Zutat.');
      return;
    }
    const input = {
      name: name.trim(),
      items: items.map((i) => ({ foodId: i.foodId, quantity: i.quantity })),
    };
    setSaving(true);
    try {
      if (isEdit) {
        await apiClient.updateMeal(mealId, input);
      } else {
        await apiClient.createMeal(input);
      }
      // Match the baseline before navigating, so the guard does not fire on the way out.
      setBaseline(signature(name, items));
      toast.success(isEdit ? 'Mahlzeit gespeichert' : 'Mahlzeit angelegt');
      router.push(MEALS_TAB);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.');
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!mealId) return;
    try {
      await apiClient.deleteMeal(mealId);
      setBaseline(signature(name, items));
      toast.success('Mahlzeit gelöscht');
      router.push(MEALS_TAB);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Löschen fehlgeschlagen.');
    }
  }

  const title = searchOpen
    ? 'Zutat'
    : readOnly
      ? 'Mahlzeit'
      : isEdit
        ? 'Bearbeiten'
        : 'Neue Mahlzeit';

  return (
    <ProtectedRoute>
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col">
        <header className="relative flex h-16 shrink-0 items-center justify-between border-b px-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Zurück"
            onClick={searchOpen ? () => setSearchOpen(false) : leave}
          >
            <IconArrowLeft />
          </Button>
          <div className="absolute left-1/2 max-w-[60%] -translate-x-1/2 truncate text-lg font-semibold uppercase tracking-[0.05em]">
            {title}
          </div>
          {isEdit && !readOnly && !searchOpen ? (
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              aria-label="Mahlzeit löschen"
              onClick={() => setConfirmDelete(true)}
            >
              <IconTrash />
            </Button>
          ) : (
            <div className="w-10" />
          )}
        </header>

        {searchOpen ? (
          <FoodSearchView
            tab={searchTab}
            onTab={setSearchTab}
            search={search}
            onSearch={setSearch}
            results={results}
            searching={searching}
            addedFoodIds={new Set(items.map((i) => i.foodId))}
            onAdd={addFood}
            onDone={() => setSearchOpen(false)}
            onScanRequest={() => setScannerOpen(true)}
            fav={fav}
          />
        ) : (
          <>
            <div className="flex-1 px-4 pb-2">
              {error && (
                <div className="mt-4 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {loading ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Lädt …</p>
              ) : (
                <div className="space-y-5 pt-5">
                  <label className="block">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                      Name
                    </span>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={readOnly}
                      autoFocus={!isEdit}
                    />
                  </label>

                  <div>
                    <div className="mb-2.5 flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                        Zutaten · {items.length}
                      </span>
                      {!readOnly && (
                        <Button variant="outline" size="xs" onClick={openSearch}>
                          <IconSearch data-icon="inline-start" />
                          Zutat
                        </Button>
                      )}
                    </div>

                    {items.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Noch keine Zutaten. Füge welche über „Zutat“ hinzu.
                      </p>
                    ) : (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={onDragEnd}
                      >
                        <SortableContext
                          items={items.map((i) => i.key)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="divide-y rounded-md border">
                            {items.map((item) => (
                              <IngredientRow
                                key={item.key}
                                item={item}
                                readOnly={readOnly}
                                expanded={expandedKey === item.key}
                                onToggle={() =>
                                  setExpandedKey((k) => (k === item.key ? null : item.key))
                                }
                                onRemove={() => removeItem(item.key)}
                                onAmountChange={(g, label) => setItemAmount(item.key, g, label)}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    )}
                  </div>

                  <div className="rounded-lg border bg-card p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                      Summe der Mahlzeit
                    </div>
                    <div className="mt-2 flex items-baseline gap-1.5">
                      <span className="text-2xl font-bold leading-none">
                        {formatKcal(totals.kcal)}
                      </span>
                      <span className="text-xs text-muted-foreground">kcal</span>
                    </div>
                    <div className="mt-3.5 grid grid-cols-3 gap-3">
                      {[
                        { label: 'Kohlenh.', value: totals.carbs },
                        { label: 'Protein', value: totals.protein },
                        { label: 'Fett', value: totals.fat },
                      ].map((m) => (
                        <div key={m.label}>
                          <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                            {m.label}
                          </div>
                          <div className="mt-1 text-sm font-semibold">
                            {m.value.toLocaleString('de-DE', {
                              minimumFractionDigits: 1,
                              maximumFractionDigits: 1,
                            })}{' '}
                            g
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 mt-auto flex gap-2 border-t bg-background p-4">
              {readOnly ? (
                <Button className="flex-1" variant="outline" onClick={leave}>
                  Schließen
                </Button>
              ) : (
                <>
                  <Button className="flex-1" onClick={handleSave} disabled={saving || loading}>
                    {saving ? 'Speichert …' : 'Speichern'}
                  </Button>
                  <Button variant="outline" onClick={leave}>
                    Abbrechen
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Page level, so no drawer or dialog is ever above the scanner. A scanned Zutat takes
          the same miss chain as logging: hit -> add, miss -> Open Food Facts -> add, double
          miss -> create the Lebensmittel -> add. */}
      <ScanFlow
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        mode={{
          kind: 'pick',
          label: 'Als Zutat',
          onPick: (food) => {
            addFood(food);
            setScannerOpen(false);
          },
        }}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mahlzeit löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Mahlzeit verschwindet aus der Liste und dem Picker. Bereits protokollierte
              Einträge bleiben unverändert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Änderungen verwerfen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Mahlzeit hat ungespeicherte Änderungen. Beim Verlassen gehen sie verloren.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Weiter bearbeiten</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => router.push(MEALS_TAB)}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Verwerfen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ProtectedRoute>
  );
}

function FoodSearchView({
  tab,
  onTab,
  search,
  onSearch,
  results,
  searching,
  addedFoodIds,
  onAdd,
  onDone,
  onScanRequest,
  fav,
}: {
  tab: PickerTabId;
  onTab: (t: PickerTabId) => void;
  search: string;
  onSearch: (v: string) => void;
  results: Food[];
  searching: boolean;
  addedFoodIds: Set<string>;
  onAdd: (food: Food) => void;
  onDone: () => void;
  onScanRequest: () => void;
  fav: ReturnType<typeof usePickerLists>;
}) {
  const foodsOf = (items: PickerItem[] | null) =>
    (items ?? []).flatMap((i) => (i.kind === 'food' ? [i.food] : []));

  const lebensmittelFoods = sortFavoritesFirst(
    results.map((f) => ({ ...f, isFavorite: fav.effectiveFavorite('food', f.id, f.isFavorite) })),
  );
  const favoriteFoods = foodsOf(fav.favorites).filter((f) =>
    fav.effectiveFavorite('food', f.id, true),
  );
  const recentFoods = foodsOf(fav.recents);

  const placeholder = (message: string) => <PickerTabPlaceholder>{message}</PickerTabPlaceholder>;

  const foodRows = (foods: Food[]) => (
    <div className="divide-y rounded-lg border">
      {foods.map((food) => (
        <div key={food.id} className="flex items-center gap-3 px-3.5 py-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{food.name}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {Math.round(food.kcal)} kcal / 100 {food.isLiquid ? 'ml' : 'g'}
            </div>
          </div>
          <FavoriteStar
            favorite={fav.effectiveFavorite('food', food.id, food.isFavorite)}
            onToggle={() =>
              fav.toggleFavorite(
                'food',
                food.id,
                fav.effectiveFavorite('food', food.id, food.isFavorite),
              )
            }
            label={food.name}
          />
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={`${food.name} hinzufügen`}
            onClick={() => onAdd(food)}
          >
            <IconPlus />
          </Button>
          {addedFoodIds.has(food.id) && (
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              drin
            </span>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <>
      <div className="flex flex-col gap-3 px-4 pt-4">
        <div className="flex items-center gap-2 border-b border-b-input">
          <IconSearch className="size-4 shrink-0 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Lebensmittel suchen..."
            className="border-b-0"
            autoFocus
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
        <PickerTabBar tab={tab} onTab={onTab} tabs={ZUTAT_PICKER_TABS} />
      </div>

      <div className="flex-1 px-4 py-3">
        {tab === 'lebensmittel' &&
          (searching && results.length === 0
            ? placeholder(PICKER_LOADING)
            : lebensmittelFoods.length === 0
              ? placeholder(search.trim() ? 'Nichts gefunden.' : 'Die Bibliothek ist noch leer.')
              : foodRows(lebensmittelFoods))}

        {tab === 'favoriten' &&
          (fav.favorites === null
            ? placeholder(PICKER_LOADING)
            : favoriteFoods.length === 0
              ? placeholder(FAVORITEN_EMPTY)
              : foodRows(favoriteFoods))}

        {tab === 'zuletzt' &&
          (fav.recents === null
            ? placeholder(PICKER_LOADING)
            : recentFoods.length === 0
              ? placeholder(ZULETZT_EMPTY)
              : foodRows(recentFoods))}
      </div>

      <div className="sticky bottom-0 mt-auto border-t bg-background p-4">
        <Button className="w-full" onClick={onDone}>
          Fertig
        </Button>
      </div>
    </>
  );
}

function IngredientRow({
  item,
  readOnly,
  expanded,
  onToggle,
  onRemove,
  onAmountChange,
}: {
  item: EditorItem;
  readOnly: boolean;
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onAmountChange: (grams: number, portionLabel: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.key,
    disabled: readOnly,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'bg-muted' : expanded ? 'bg-muted/40' : ''}
    >
      <div className="flex items-center gap-2.5 px-3 py-3">
        {!readOnly && (
          <button
            type="button"
            aria-label="Verschieben"
            className="shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <IconGripVertical className="size-4" />
          </button>
        )}
        <button
          type="button"
          onClick={readOnly ? undefined : onToggle}
          className="min-w-0 flex-1 text-left"
        >
          <div className="truncate text-sm">
            {item.foodName}
            {item.deleted && (
              <span className="ml-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                gelöscht
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{itemSubtitle(item)}</div>
        </button>
        {!readOnly && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            aria-label={`${item.foodName} entfernen`}
            onClick={onRemove}
          >
            <IconX />
          </Button>
        )}
      </div>

      {expanded && !readOnly && (
        <div className="px-3 pb-3">
          <QuantityStepper
            portions={item.portions}
            isLiquid={item.isLiquid}
            grams={item.quantity}
            portionLabel={item.portionLabel}
            onChange={onAmountChange}
          />
        </div>
      )}
    </div>
  );
}
