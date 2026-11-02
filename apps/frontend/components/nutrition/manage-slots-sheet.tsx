'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
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
import { useSlotName } from '@/hooks/useSlotName';
import { FieldError } from '@/components/ui/field';
import { useFormErrors } from '@/hooks/useFormErrors';
import { notify } from '@/lib/toast';
import { SECTIONS_PER_USER_MAX, SECTION_NAME_MAX, checkBaseText } from '@/lib/field-rules';

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
  const t = useTranslations('ManageSlotsSheet');
  const slotName = useSlotName();
  const [active, setActive] = useState<MealSlot[] | null>(null);
  const [archived, setArchived] = useState<MealSlot[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  // Field errors for the new-name field and the one rename in progress. The count is the message's
  // `{count}`: how many active Abschnitte a user may have.
  const [form, formRef] = useFormErrors({
    fields: ['newName', 'editName'],
    messageValues: {
      newName: { max: SECTION_NAME_MAX, count: SECTIONS_PER_USER_MAX },
      editName: { max: SECTION_NAME_MAX },
    },
  });

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
      notify.error(t('loadError'));
    }
  }, [t]);

  useEffect(() => {
    if (open) {
      setEditingId(null);
      setNewName('');
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        notify.error(t('reorderError'));
        await refresh();
      }
    });
  }

  function saveRename(slot: MealSlot) {
    const name = editValue.trim();
    if (!form.setConstraints({ editName: checkBaseText(editValue, SECTION_NAME_MAX) })) return;
    if (name === slotName(slot)) {
      setEditingId(null);
      return;
    }
    void run(async () => {
      try {
        await apiClient.renameMealSlot(slot.id, name);
        setActive((prev) =>
          prev ? prev.map((s) => (s.id === slot.id ? { ...s, name, seedKey: null } : s)) : prev,
        );
        setEditingId(null);
      } catch {
        notify.error(t('renameError'));
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
        notify.error(t('archiveError'));
      }
    });
  }

  function unarchive(slot: MealSlot) {
    void run(async () => {
      try {
        await apiClient.setMealSlotArchived(slot.id, false);
        await refresh();
      } catch {
        notify.error(t('unarchiveError'));
      }
    });
  }

  function addSlot() {
    const name = newName.trim();
    const valid = form.setConstraints({
      newName:
        checkBaseText(newName, SECTION_NAME_MAX) ??
        ((active?.length ?? 0) >= SECTIONS_PER_USER_MAX ? 'arrayMaxSize' : null),
    });
    if (!valid) return;
    void run(async () => {
      try {
        await apiClient.createMealSlot(name);
        setNewName('');
        await refresh();
      } catch {
        notify.error(t('addError'));
      }
    });
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-2xl">
        <DrawerHeader>
          <DrawerTitle>{t('title')}</DrawerTitle>
          <DrawerDescription>{t('description')}</DrawerDescription>
        </DrawerHeader>

        <div ref={formRef} className="flex flex-col gap-4 overflow-y-auto px-4 pb-2">
          {active === null ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('loading')}</p>
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
                      editError={form.errors.editName}
                      canArchive={active.length > 1}
                      disabled={busy}
                      dragDisabled={busy || editingId !== null}
                      onEditValueChange={(value) => {
                        setEditValue(value);
                        form.clear('editName');
                      }}
                      onStartEdit={() => {
                        setEditingId(slot.id);
                        setEditValue(slotName(slot));
                        form.clear('editName');
                      }}
                      onCancelEdit={() => {
                        setEditingId(null);
                        form.clear('editName');
                      }}
                      onConfirmEdit={() => saveRename(slot)}
                      onArchive={() => archive(slot)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          )}

          <div>
            <div className="flex items-center gap-2">
              <Input
                placeholder={t('newSlotPlaceholder')}
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  form.clear('newName');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addSlot();
                }}
                {...form.fieldProps('newName')}
              />
              <Button variant="outline" onClick={addSlot} disabled={busy}>
                <IconPlus data-icon="inline-start" />
                {t('add')}
              </Button>
            </div>
            <FieldError id={form.errorId('newName')} className="mt-1">
              {form.errors.newName}
            </FieldError>
          </div>

          {archived.length > 0 && (
            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                {t('archivedHeading', { count: archived.length })}
              </div>
              <div className="divide-y border">
                {archived.map((slot) => (
                  <div key={slot.id} className="flex items-center gap-3 px-3 py-3">
                    <span className="flex-1 text-sm uppercase tracking-wide text-muted-foreground">
                      {slotName(slot)}
                    </span>
                    <Button
                      variant="outline"
                      size="xs"
                      disabled={busy}
                      onClick={() => unarchive(slot)}
                    >
                      {t('restore')}
                    </Button>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{t('archivedHint')}</p>
            </div>
          )}
        </div>

        <div className="mt-auto p-4">
          <Button className="w-full" onClick={() => onOpenChange(false)}>
            {t('done')}
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
  editError,
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
  editError?: string;
  canArchive: boolean;
  disabled: boolean;
  dragDisabled: boolean;
  onEditValueChange: (v: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onConfirmEdit: () => void;
  onArchive: () => void;
}) {
  const t = useTranslations('ManageSlotsSheet');
  const displayName = useSlotName()(slot);
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
        aria-label={t('move')}
        disabled={dragDisabled}
        className="shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing disabled:cursor-default disabled:opacity-40"
        {...attributes}
        {...listeners}
      >
        <IconGripVertical className="size-4" />
      </button>

      {editing ? (
        <>
          <div className="flex-1">
            <Input
              autoFocus
              value={editValue}
              onChange={(e) => onEditValueChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onConfirmEdit();
                if (e.key === 'Escape') onCancelEdit();
              }}
              className="h-9"
              aria-invalid={editError ? true : undefined}
              aria-describedby={editError ? 'editName-error' : undefined}
            />
            <FieldError id="editName-error">{editError}</FieldError>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('save')}
            disabled={disabled}
            onClick={onConfirmEdit}
          >
            <IconCheck />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('cancel')}
            onClick={onCancelEdit}
          >
            <IconX />
          </Button>
        </>
      ) : (
        <>
          <span className="flex-1 text-sm font-semibold uppercase tracking-wide">
            {displayName}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('rename', { name: displayName })}
            disabled={disabled}
            onClick={onStartEdit}
          >
            <IconPencil />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('archive', { name: displayName })}
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
