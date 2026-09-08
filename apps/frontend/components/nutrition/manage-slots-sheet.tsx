'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  IconGripVertical,
  IconPencil,
  IconArchive,
  IconCheck,
  IconX,
  IconPlus,
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
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api';
import { MealSlot } from '@/types';

/**
 * "Abschnitte verwalten" (design screen 02): rename, reorder (drag), add and archive the
 * user's Abschnitte from a bottom sheet on the day page. Archived slots move to a separate
 * list with a "Wiederherstellen" action. Every change persists immediately and calls
 * `onChanged` so the Tagesansicht behind the sheet refreshes.
 */
export function ManageSlotsSheet({
  open,
  onOpenChange,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const [active, setActive] = useState<MealSlot[] | null>(null);
  const [archived, setArchived] = useState<MealSlot[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const refresh = useCallback(async () => {
    try {
      const list = await apiClient.getMealSlots();
      setActive(list.active);
      setArchived(list.archived);
    } catch {
      toast.error('Abschnitte konnten nicht geladen werden');
    }
  }, []);

  useEffect(() => {
    if (open) {
      setEditingId(null);
      setNewName('');
      refresh();
    }
  }, [open, refresh]);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active: dragged, over } = event;
    if (!over || dragged.id === over.id || !active) return;

    const oldIndex = active.findIndex((s) => s.id === dragged.id);
    const newIndex = active.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(active, oldIndex, newIndex);
    setActive(reordered); // optimistic
    void run(async () => {
      try {
        const list = await apiClient.reorderMealSlots(
          reordered.map((s, i) => ({ id: s.id, order: i + 1 })),
        );
        setActive(list.active);
        setArchived(list.archived);
      } catch {
        toast.error('Reihenfolge konnte nicht gespeichert werden');
        await refresh();
      }
    });
  }

  function saveRename(slot: MealSlot) {
    const name = editValue.trim();
    if (!name || name === slot.name) {
      setEditingId(null);
      return;
    }
    void run(async () => {
      try {
        await apiClient.renameMealSlot(slot.id, name);
        setActive((prev) =>
          prev ? prev.map((s) => (s.id === slot.id ? { ...s, name } : s)) : prev,
        );
        setEditingId(null);
      } catch {
        toast.error('Umbenennen fehlgeschlagen');
      }
    });
  }

  function archive(slot: MealSlot) {
    void run(async () => {
      try {
        await apiClient.setMealSlotArchived(slot.id, true);
        await refresh();
      } catch {
        // The only expected failure is the server's "keep one active" 409 (the button is
        // already disabled at one active slot, so this is the race guard).
        toast.error('Abschnitt konnte nicht archiviert werden');
      }
    });
  }

  function unarchive(slot: MealSlot) {
    void run(async () => {
      try {
        await apiClient.setMealSlotArchived(slot.id, false);
        await refresh();
      } catch {
        toast.error('Wiederherstellen fehlgeschlagen');
      }
    });
  }

  function addSlot() {
    const name = newName.trim();
    if (!name) return;
    void run(async () => {
      try {
        await apiClient.createMealSlot(name);
        setNewName('');
        await refresh();
      } catch {
        toast.error('Abschnitt konnte nicht hinzugefügt werden');
      }
    });
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-2xl">
        <DrawerHeader>
          <DrawerTitle>Abschnitte verwalten</DrawerTitle>
          <DrawerDescription>Umbenennen, sortieren, archivieren</DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-2">
          {active === null ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Lädt …</p>
          ) : (
            <div className="border">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={active.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {active.map((slot, index) => (
                    <SortableSlotRow
                      key={slot.id}
                      slot={slot}
                      isFirst={index === 0}
                      editing={editingId === slot.id}
                      editValue={editValue}
                      canArchive={active.length > 1}
                      disabled={busy}
                      dragDisabled={busy || editingId !== null}
                      onEditValueChange={setEditValue}
                      onStartEdit={() => {
                        setEditingId(slot.id);
                        setEditValue(slot.name);
                      }}
                      onCancelEdit={() => setEditingId(null)}
                      onConfirmEdit={() => saveRename(slot)}
                      onArchive={() => archive(slot)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Input
              placeholder="Neuer Abschnitt"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addSlot();
              }}
            />
            <Button variant="outline" onClick={addSlot} disabled={busy || !newName.trim()}>
              <IconPlus data-icon="inline-start" />
              Hinzufügen
            </Button>
          </div>

          {archived.length > 0 && (
            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                Archiviert · {archived.length}
              </div>
              <div className="divide-y border">
                {archived.map((slot) => (
                  <div key={slot.id} className="flex items-center gap-3 px-3 py-3">
                    <span className="flex-1 text-sm uppercase tracking-wide text-muted-foreground">
                      {slot.name}
                    </span>
                    <Button
                      variant="outline"
                      size="xs"
                      disabled={busy}
                      onClick={() => unarchive(slot)}
                    >
                      Wiederherstellen
                    </Button>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Archivierte Abschnitte bleiben in vergangenen Tagen sichtbar, erscheinen aber
                nicht mehr in der Tagesansicht.
              </p>
            </div>
          )}
        </div>

        <div className="mt-auto p-4">
          <Button className="w-full" onClick={() => onOpenChange(false)}>
            Fertig
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function SortableSlotRow({
  slot,
  isFirst,
  editing,
  editValue,
  canArchive,
  disabled,
  dragDisabled,
  onEditValueChange,
  onStartEdit,
  onCancelEdit,
  onConfirmEdit,
  onArchive,
}: {
  slot: MealSlot;
  isFirst: boolean;
  editing: boolean;
  editValue: string;
  canArchive: boolean;
  disabled: boolean;
  dragDisabled: boolean;
  onEditValueChange: (v: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onConfirmEdit: () => void;
  onArchive: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: slot.id,
    disabled: dragDisabled,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2.5 px-3 py-3 ${isFirst ? '' : 'border-t'} ${
        isDragging ? 'bg-muted' : ''
      }`}
    >
      <button
        type="button"
        aria-label="Verschieben"
        disabled={dragDisabled}
        className="shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing disabled:cursor-default disabled:opacity-40"
        {...attributes}
        {...listeners}
      >
        <IconGripVertical className="size-4" />
      </button>

      {editing ? (
        <>
          <Input
            autoFocus
            value={editValue}
            onChange={(e) => onEditValueChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onConfirmEdit();
              if (e.key === 'Escape') onCancelEdit();
            }}
            className="h-9 flex-1"
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Speichern"
            disabled={disabled || !editValue.trim()}
            onClick={onConfirmEdit}
          >
            <IconCheck />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Abbrechen"
            onClick={onCancelEdit}
          >
            <IconX />
          </Button>
        </>
      ) : (
        <>
          <span className="flex-1 text-sm font-semibold uppercase tracking-wide">
            {slot.name}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`${slot.name} umbenennen`}
            disabled={disabled}
            onClick={onStartEdit}
          >
            <IconPencil />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`${slot.name} archivieren`}
            disabled={disabled || !canArchive}
            onClick={onArchive}
          >
            <IconArchive />
          </Button>
        </>
      )}
    </div>
  );
}
