'use client';

import { useEffect, useMemo, useState } from 'react';
import {
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api';
import { Food, FoodPortion, MealItem } from '@/types';
import {
  computeMealTotals,
  formatKcal,
  formatQuantityLabel,
  scalePer100,
} from '@/lib/nutrition';
import { QuantityStepper } from '@/components/nutrition/quantity-stepper';

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
 * Create / edit a Mahlzeit (#147). A meal is a live combination of foods with quantities:
 * the totals shown here are recomputed from the foods' current nutrients, and logging the
 * meal later expands it into snapshotted entries. Only the creator can edit -- another
 * user's meal opens read-only.
 */
export function MealEditorDialog({
  open,
  onOpenChange,
  mealId,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mealId?: string;
  onChanged: () => void;
}) {
  const isEdit = mealId != null;

  const [loading, setLoading] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [name, setName] = useState('');
  const [items, setItems] = useState<EditorItem[]>([]);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Food[]>([]);
  const [searching, setSearching] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (!open) return;
    setError('');
    setSaving(false);
    setConfirmDelete(false);
    setExpandedKey(null);
    setSearchOpen(false);
    setSearch('');
    setResults([]);

    if (!mealId) {
      setReadOnly(false);
      setName('');
      setItems([]);
      return;
    }

    setLoading(true);
    let cancelled = false;
    apiClient
      .getMeal(mealId)
      .then((meal) => {
        if (cancelled) return;
        setReadOnly(!meal.editable);
        setName(meal.name);
        setItems(meal.items.map(fromMealItem));
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
  }, [open, mealId]);

  // Food search for the "Zutat" picker.
  useEffect(() => {
    if (!searchOpen) return;
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
  }, [searchOpen, search]);

  const totals = useMemo(
    () => computeMealTotals(items.map((i) => ({ per100: i.per100, quantity: i.quantity }))),
    [items],
  );

  function addFood(food: Food) {
    setItems((prev) => [...prev, fromFood(food)]);
    setSearchOpen(false);
    setSearch('');
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
    if (expandedKey === key) setExpandedKey(null);
  }

  function setItemAmount(key: string, quantity: number, portionLabel: string | null) {
    setItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, quantity, portionLabel } : i)),
    );
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
        await apiClient.updateMeal(mealId!, input);
      } else {
        await apiClient.createMeal(input);
      }
      onChanged();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.');
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!mealId) return;
    try {
      await apiClient.deleteMeal(mealId);
      onChanged();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Löschen fehlgeschlagen.');
    }
  }

  const title = readOnly ? 'Mahlzeit' : isEdit ? 'Mahlzeit bearbeiten' : 'Neue Mahlzeit';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader className="flex-row items-center justify-between">
          <DialogTitle>{title}</DialogTitle>
          {isEdit && !readOnly && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-destructive"
              aria-label="Mahlzeit löschen"
              onClick={() => setConfirmDelete(true)}
            >
              <IconTrash />
            </Button>
          )}
        </DialogHeader>

        {error && (
          <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Lädt …</p>
        ) : (
          <div className="space-y-5">
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
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => setSearchOpen((v) => !v)}
                  >
                    <IconSearch data-icon="inline-start" />
                    Zutat
                  </Button>
                )}
              </div>

              {searchOpen && !readOnly && (
                <div className="mb-3 rounded-md border bg-muted/40 p-2">
                  <div className="flex items-center gap-2 border-b border-b-input">
                    <IconSearch className="size-4 shrink-0 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Lebensmittel suchen..."
                      className="border-b-0"
                      autoFocus
                    />
                  </div>
                  <div className="mt-2 max-h-56 overflow-y-auto">
                    {searching && results.length === 0 ? (
                      <p className="py-4 text-center text-xs text-muted-foreground">Lädt …</p>
                    ) : results.length === 0 ? (
                      <p className="py-4 text-center text-xs text-muted-foreground">
                        {search.trim() ? 'Nichts gefunden.' : 'Die Bibliothek ist leer.'}
                      </p>
                    ) : (
                      <div className="divide-y">
                        {results.map((food) => (
                          <button
                            key={food.id}
                            type="button"
                            onClick={() => addFood(food)}
                            className="flex w-full items-center gap-3 py-2 text-left hover:bg-muted/60"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm">{food.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {Math.round(food.kcal)} kcal / 100 {food.isLiquid ? 'ml' : 'g'}
                              </div>
                            </div>
                            <IconPlus className="size-4 shrink-0 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

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

            <div className="flex gap-2">
              {readOnly ? (
                <Button className="flex-1" variant="outline" onClick={() => onOpenChange(false)}>
                  Schließen
                </Button>
              ) : (
                <>
                  <Button className="flex-1" onClick={handleSave} disabled={saving}>
                    Speichern
                  </Button>
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Abbrechen
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>

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
    </Dialog>
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable(
    { id: item.key, disabled: readOnly },
  );

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
          <div className="text-sm">
            {item.foodName}
            {item.deleted && (
              <span className="ml-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                gelöscht
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">{itemSubtitle(item)}</div>
        </button>
        {!readOnly && (
          <Button
            variant="ghost"
            size="icon-sm"
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
