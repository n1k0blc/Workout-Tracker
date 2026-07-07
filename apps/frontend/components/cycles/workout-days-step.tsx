import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { CycleFormData, WorkoutDayData } from './cycle-wizard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface WorkoutDaysStepProps {
  formData: CycleFormData;
  updateFormData: (data: Partial<CycleFormData>) => void;
  onNext: () => void;
  onBack: () => void;
}

interface SelectedDay {
  weekday: number;
  name: string;
  plannedHomeGymId?: string;
  customGymName?: string;
}

export default function WorkoutDaysStep({
  formData,
  updateFormData,
  onNext,
  onBack,
}: WorkoutDaysStepProps) {
  const { user } = useAuth();

  const [selectedDaysList, setSelectedDaysList] = useState<SelectedDay[]>(() =>
    formData.workoutDays.map((d) => ({
      weekday: d.weekday,
      name: d.name,
      plannedHomeGymId: d.plannedHomeGymId,
    }))
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [modalWeekday, setModalWeekday] = useState<number>(1);
  const [modalName, setModalName] = useState('');
  const [modalGymId, setModalGymId] = useState('');

  // Sort home gyms alphabetically
  const homeGyms = [...(user?.homeGyms || [])].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const weekdays = [
    { value: 1, label: 'Montag' },
    { value: 2, label: 'Dienstag' },
    { value: 3, label: 'Mittwoch' },
    { value: 4, label: 'Donnerstag' },
    { value: 5, label: 'Freitag' },
    { value: 6, label: 'Samstag' },
    { value: 0, label: 'Sonntag' },
  ];

  const nameSuggestions = ['Push', 'Pull', 'Beine', 'Upper', 'Lower', 'Full Body'];

  // Load from parent when backtracking
  useEffect(() => {
    if (formData.workoutDays.length > 0) {
      setSelectedDaysList(
        formData.workoutDays.map((d) => ({
          weekday: d.weekday,
          name: d.name,
          plannedHomeGymId: d.plannedHomeGymId,
        }))
      );
    }
  }, [formData.workoutDays]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Long-press to drag (same as workout page reordering)
      activationConstraint: {
        delay: 300,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const getWeekdayLabel = (weekday: number): string => {
    return weekdays.find((w) => w.value === weekday)?.label || `Tag ${weekday}`;
  };

  const getGymDisplay = (day: SelectedDay): string => {
    if (day.customGymName) return day.customGymName;
    if (day.plannedHomeGymId) {
      const gym = homeGyms.find((g) => g.id === day.plannedHomeGymId);
      return gym?.name || 'Unbekannt';
    }
    return 'Nicht ausgewählt';
  };

  const openAddDay = () => {
    const used = new Set(selectedDaysList.map((d) => d.weekday));
    const firstAvailable = weekdays.find((w) => !used.has(w.value))?.value || 1;
    setModalWeekday(firstAvailable);
    setModalName('');
    setModalGymId(homeGyms.length > 0 ? homeGyms[0].id : '');
    setEditingIndex(null);
    setIsModalOpen(true);
  };

  const openEditDay = (index: number) => {
    const day = selectedDaysList[index];
    setModalWeekday(day.weekday);
    setModalName(day.name);
    setModalGymId(day.plannedHomeGymId || (homeGyms[0]?.id || ''));
    setEditingIndex(index);
    setIsModalOpen(true);
  };

  const removeDay = (index: number) => {
    setSelectedDaysList(selectedDaysList.filter((_, i) => i !== index));
  };

  const handleModalSave = () => {
    if (modalWeekday == null) return;

    const name = modalName.trim() || getWeekdayLabel(modalWeekday);
    const gymId = modalGymId || undefined;

    const newEntry: SelectedDay = {
      weekday: modalWeekday,
      name,
      plannedHomeGymId: gymId,
    };

    let updated: SelectedDay[];
    if (editingIndex !== null) {
      updated = [...selectedDaysList];
      updated[editingIndex] = newEntry;
    } else {
      updated = [...selectedDaysList, newEntry];
    }

    setSelectedDaysList(updated);
    setIsModalOpen(false);
    setEditingIndex(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = selectedDaysList.findIndex((d) => d.weekday === active.id);
      const newIndex = selectedDaysList.findIndex((d) => d.weekday === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        setSelectedDaysList(arrayMove(selectedDaysList, oldIndex, newIndex));
      }
    }
  };

  const handleNext = () => {
    const workoutDays: WorkoutDayData[] = selectedDaysList.map((day) => {
      const existingDay = formData.workoutDays.find((d) => d.weekday === day.weekday);
      return {
        weekday: day.weekday,
        name: day.name,
        plannedHomeGymId: day.plannedHomeGymId,
        blueprint: existingDay?.blueprint || { exercises: [] },
      };
    });

    updateFormData({ workoutDays });
    onNext();
  };

  const isValid = selectedDaysList.length > 0;

  // Sub component for sortable cards
  // Drag by long-pressing the title area (same UX as ExerciseCard reordering in workout page)
  function SortableDayCard({
    day,
    index,
    onEdit,
    onDelete,
  }: {
    day: SelectedDay;
    index: number;
    onEdit: (idx: number) => void;
    onDelete: (idx: number) => void;
  }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: day.weekday });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
      >
        <Card onClick={() => onEdit(index)} className="cursor-pointer hover:border-primary/50 transition-colors">
          <CardContent className="p-3 flex items-center justify-between gap-3">
            {/* Title area is the drag handle (long-press to reorder). touch-none is
                scoped to just this handle so the rest of the card still allows native
                horizontal swipe-scrolling on touch devices. */}
            <div
              className="flex items-center gap-3 flex-1 min-w-0 cursor-grab active:cursor-grabbing touch-none"
              {...attributes}
              {...listeners}
            >
              <div className="min-w-0">
                <div className="font-semibold text-sm text-foreground">
                  {getWeekdayLabel(day.weekday).toUpperCase()}
                </div>
                <div className="text-sm text-foreground truncate">{day.name}</div>
                <div className="text-xs text-muted-foreground truncate">{getGymDisplay(day)}</div>
              </div>
            </div>
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              {/* No pencil icon: clicking the card opens edit */}
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-destructive hover:text-destructive"
                onClick={() => onDelete(index)}
                aria-label="Entfernen"
              >
                <IconTrash className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Wähle deine Trainingstage
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Wähle die Wochentage aus, an denen du trainieren möchtest.
        </p>

        {selectedDaysList.length > 0 && (
          <div className="text-sm text-muted-foreground mb-3">
            {selectedDaysList.length} von 7 Tagen ausgewählt
            {selectedDaysList.length > 6 && (
              <span className="text-destructive ml-2 text-xs">(Mehr als 6 Tage nicht empfohlen)</span>
            )}
          </div>
        )}

        {selectedDaysList.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">Noch keine Trainingstage hinzugefügt</p>
              <p className="text-xs text-muted-foreground mt-1">
                Klicke auf das + um einen Trainingstag hinzuzufügen.
              </p>
            </CardContent>
          </Card>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={selectedDaysList.map((d) => d.weekday)}
              strategy={horizontalListSortingStrategy}
            >
              <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory -mx-1 px-1">
                {selectedDaysList.map((day, index) => (
                  <div key={day.weekday} className="snap-start min-w-[170px] flex-shrink-0">
                    <SortableDayCard
                      day={day}
                      index={index}
                      onEdit={openEditDay}
                      onDelete={removeDay}
                    />
                  </div>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <div className="flex justify-center py-3">
          <Button
            variant="outline"
            onClick={openAddDay}
            disabled={selectedDaysList.length >= 7}
            className="h-14 w-14 rounded-lg p-0"
            aria-label="Trainingstag hinzufügen"
          >
            <IconPlus className="size-7" />
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onBack} className="flex-1">
          Zurück
        </Button>
        <Button type="button" onClick={handleNext} disabled={!isValid} className="flex-1">
          Weiter
        </Button>
      </div>

      {/* Add / Edit Day Modal (styled like exercise selection modals) */}
      <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) { setIsModalOpen(false); setEditingIndex(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingIndex !== null ? 'Trainingstag bearbeiten' : 'Trainingstag hinzufügen'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Weekday chips */}
            <div>
              <Label className="mb-2 block">Wochentag *</Label>
              <div className="flex flex-wrap gap-2">
                {weekdays.map((w) => {
                  const used = new Set(selectedDaysList.map((d) => d.weekday));
                  const isUsed = used.has(w.value) && (editingIndex === null || selectedDaysList[editingIndex]?.weekday !== w.value);
                  const isActive = modalWeekday === w.value;
                  return (
                    <Button
                      key={w.value}
                      type="button"
                      variant={isActive ? 'default' : 'outline'}
                      size="sm"
                      disabled={isUsed}
                      onClick={() => setModalWeekday(w.value)}
                    >
                      {w.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Name + suggestions */}
            <div>
              <Label htmlFor="day-name">Trainingsname</Label>
              <Input
                id="day-name"
                value={modalName}
                onChange={(e) => setModalName(e.target.value)}
                placeholder="z.B. Push Day"
                className="mt-1"
              />
              <div className="mt-2">
                <div className="text-xs text-muted-foreground mb-1">Vorschläge:</div>
                <div className="flex flex-wrap gap-1">
                  {nameSuggestions.map((s) => (
                    <Button
                      key={s}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setModalName(s)}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Gym / Location - only user's home gyms, no custom option */}
            <div>
              <Label>Fitnessstudio / Ort</Label>
              <select
                value={modalGymId}
                onChange={(e) => setModalGymId(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-input bg-background text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Bitte wählen</option>
                {homeGyms.map((gym) => (
                  <option key={gym.id} value={gym.id}>
                    {gym.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setIsModalOpen(false);
                setEditingIndex(null);
              }}
            >
              Abbrechen
            </Button>
            <Button onClick={handleModalSave} disabled={modalWeekday == null || !modalName.trim()}>
              {editingIndex !== null ? 'Speichern' : 'Hinzufügen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
