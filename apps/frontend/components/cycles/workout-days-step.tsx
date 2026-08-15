import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { CycleFormData, WorkoutDayData } from './cycle-wizard';
import { sortByCycleWeekday } from '@/lib/weekday';
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
  const [editingWeekday, setEditingWeekday] = useState<number | null>(null);
  const [modalWeekday, setModalWeekday] = useState<number>(1);
  const [modalName, setModalName] = useState('');
  const [modalGymId, setModalGymId] = useState('');

  const sortedDaysList = sortByCycleWeekday(selectedDaysList, formData.startDate);

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
    setEditingWeekday(null);
    setIsModalOpen(true);
  };

  const openEditDay = (weekday: number) => {
    const day = selectedDaysList.find((d) => d.weekday === weekday);
    if (!day) return;
    setModalWeekday(day.weekday);
    setModalName(day.name);
    setModalGymId(day.plannedHomeGymId || (homeGyms[0]?.id || ''));
    setEditingWeekday(weekday);
    setIsModalOpen(true);
  };

  const removeDay = (weekday: number) => {
    setSelectedDaysList(selectedDaysList.filter((d) => d.weekday !== weekday));
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
    if (editingWeekday !== null) {
      updated = selectedDaysList.map((d) => (d.weekday === editingWeekday ? newEntry : d));
    } else {
      updated = [...selectedDaysList, newEntry];
    }

    setSelectedDaysList(updated);
    setIsModalOpen(false);
    setEditingWeekday(null);
  };

  const handleNext = () => {
    const workoutDays: WorkoutDayData[] = sortedDaysList.map((day) => {
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
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory -mx-1 px-1">
            {sortedDaysList.map((day) => (
              <div key={day.weekday} className="snap-start min-w-[170px] flex-shrink-0">
                <Card
                  onClick={() => openEditDay(day.weekday)}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                >
                  <CardContent className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-foreground">
                        {getWeekdayLabel(day.weekday).toUpperCase()}
                      </div>
                      <div className="text-sm text-foreground truncate">{day.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{getGymDisplay(day)}</div>
                    </div>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive"
                        onClick={() => removeDay(day.weekday)}
                        aria-label="Entfernen"
                      >
                        <IconTrash className="size-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
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
      <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) { setIsModalOpen(false); setEditingWeekday(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingWeekday !== null ? 'Trainingstag bearbeiten' : 'Trainingstag hinzufügen'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Weekday chips */}
            <div>
              <Label className="mb-2 block">Wochentag *</Label>
              <div className="flex flex-wrap gap-2">
                {weekdays.map((w) => {
                  const used = new Set(selectedDaysList.map((d) => d.weekday));
                  const isUsed = used.has(w.value) && editingWeekday !== w.value;
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
                setEditingWeekday(null);
              }}
            >
              Abbrechen
            </Button>
            <Button onClick={handleModalSave} disabled={modalWeekday == null || !modalName.trim()}>
              {editingWeekday !== null ? 'Speichern' : 'Hinzufügen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
