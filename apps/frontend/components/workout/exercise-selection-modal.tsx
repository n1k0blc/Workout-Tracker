'use client';

import { useState, useEffect, useMemo } from 'react';
import { Exercise, MuscleGroup, Equipment } from '@/types';
import { apiClient } from '@/lib/api';
import { MUSCLE_GROUP_LABELS } from '@/lib/exercise-utils';
import { ExerciseEditorDialog } from '@/components/exercises/exercise-editor-dialog';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { IconPlus, IconX } from '@tabler/icons-react';

interface ExerciseSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (exerciseId: string, exercise?: Exercise) => void;
  /**
   * When the picker opens to *swap* an exercise, this is the id of the exercise being
   * replaced. Its muscle group (the derived `primaryMuscle`) is preselected once the
   * catalogue loads, so the list opens narrowed to alternatives for the same muscle.
   * Equipment is deliberately left on "Alle" -- the usual reason to swap is that the
   * equipment is taken. Omitted for plain "add exercise" and the analytics picker.
   */
  preselectMuscleFromExerciseId?: string;
}

export default function ExerciseSelectionModal({
  open,
  onOpenChange,
  onSelect,
  preselectMuscleFromExerciseId,
}: ExerciseSelectionModalProps) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [muscleGroupFilter, setMuscleGroupFilter] = useState<
    MuscleGroup | undefined
  >();
  const [equipmentFilter, setEquipmentFilter] = useState<
    Equipment | undefined
  >();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Reset search/filters the moment `open` flips to false, so the next open starts fresh
  // regardless of how it closed (successful add, cancel, X, outside click, Escape).
  // Adjusted during render (React's recommended way to sync state to a prop change)
  // rather than in a useEffect, since this is pure state derivation, not a side effect.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) {
      setSearch('');
      setMuscleGroupFilter(undefined);
      setEquipmentFilter(undefined);
    }
  }

  // Fetch the full exercise list once per modal open (unfiltered -- the endpoint has
  // no pagination anyway, so this already covers everything). Search/filters above then
  // narrow it down purely client-side, with zero network calls while typing/toggling.
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    apiClient
      .getExercises({ includeCustom: true })
      .then((data) => {
        if (cancelled) return;
        setExercises(data);
        // Preselect the muscle group of the exercise being swapped, resolved from the
        // freshly-loaded catalogue (the exercise-log shape carries no primaryMuscle).
        if (preselectMuscleFromExerciseId) {
          const source = data.find((e) => e.id === preselectMuscleFromExerciseId);
          if (source) setMuscleGroupFilter(source.primaryMuscle);
        }
      })
      .catch((error) => {
        console.error('Failed to load exercises:', error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, preselectMuscleFromExerciseId]);

  const filteredExercises = useMemo(() => {
    const query = search.trim().toLowerCase();
    return exercises.filter((exercise) => {
      if (query && !exercise.name.toLowerCase().includes(query)) return false;
      if (muscleGroupFilter && exercise.primaryMuscle !== muscleGroupFilter) return false;
      if (equipmentFilter && exercise.equipment !== equipmentFilter) return false;
      return true;
    });
  }, [exercises, search, muscleGroupFilter, equipmentFilter]);

  const handleExerciseCreated = (exercise: Exercise) => {
    // Add new exercise to list and select it
    setExercises((prev) => [exercise, ...prev]);
    onSelect(exercise.id, exercise);
    setShowCreateDialog(false);
  };

  const muscleGroups = [
    MuscleGroup.ABDOMEN,
    MuscleGroup.LATISSIMUS,
    MuscleGroup.TRAPEZIUS,
    MuscleGroup.LOWER_BACK,
    MuscleGroup.HAMSTRINGS,
    MuscleGroup.GLUTES,
    MuscleGroup.SHOULDERS,
    MuscleGroup.BICEPS,
    MuscleGroup.CHEST,
    MuscleGroup.QUADRICEPS,
    MuscleGroup.CALVES,
    MuscleGroup.TRICEPS,
  ];

  const equipments = [
    Equipment.CABLE,
    Equipment.MACHINE,
    Equipment.DUMBBELL,
    Equipment.BARBELL,
    Equipment.BODYWEIGHT,
    Equipment.SMITH_MACHINE,
    Equipment.EZ_BAR,
  ];

  const translateMuscleGroup = (mg: MuscleGroup): string => {
    return MUSCLE_GROUP_LABELS[mg] || mg;
  };

  const translateEquipment = (eq: Equipment): string => {
    const translations: Record<Equipment, string> = {
      CABLE: 'Kabel',
      MACHINE: 'Maschine',
      DUMBBELL: 'Kurzhantel',
      BARBELL: 'Langhantel',
      BODYWEIGHT: 'Körpergewicht',
      SMITH_MACHINE: 'Smith-Maschine',
      EZ_BAR: 'EZ-Stange',
    };
    return translations[eq];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b shrink-0 relative">
          <DialogTitle>Übung hinzufügen</DialogTitle>
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2"
              aria-label="Schließen"
            >
              <IconX className="size-4" />
            </Button>
          </DialogClose>
        </DialogHeader>

        {/* Search */}
        <div className="px-6 py-4 border-b shrink-0">
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Übung suchen..."
            className="w-full"
          />
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-b shrink-0">
          {/* Muscle Group Filter - horizontal scrollable */}
          <div className="mb-3">
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">
              Muskelgruppe
            </label>
            <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1">
              <Button
                variant={!muscleGroupFilter ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMuscleGroupFilter(undefined)}
                className="flex-shrink-0 whitespace-nowrap"
              >
                Alle
              </Button>
              {muscleGroups.map((mg) => (
                <Button
                  key={mg}
                  variant={muscleGroupFilter === mg ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMuscleGroupFilter(mg)}
                  className="flex-shrink-0 whitespace-nowrap"
                >
                  {translateMuscleGroup(mg)}
                </Button>
              ))}
            </div>
          </div>

          {/* Equipment Filter - horizontal scrollable */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">
              Equipment
            </label>
            <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1">
              <Button
                variant={!equipmentFilter ? 'default' : 'outline'}
                size="sm"
                onClick={() => setEquipmentFilter(undefined)}
                className="flex-shrink-0 whitespace-nowrap"
              >
                Alle
              </Button>
              {equipments.map((eq) => (
                <Button
                  key={eq}
                  variant={equipmentFilter === eq ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEquipmentFilter(eq)}
                  className="flex-shrink-0 whitespace-nowrap"
                >
                  {translateEquipment(eq)}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Create Custom Exercise Button — uses the shared ExerciseEditorDialog */}
        <div className="px-6 py-3 border-b shrink-0">
          <Button
            variant="outline"
            onClick={() => setShowCreateDialog(true)}
            className="w-full"
          >
            <IconPlus className="mr-2 size-4" />
            Benutzerdefinierte Übung erstellen
          </Button>
        </div>

        {/* Exercise List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Lädt Übungen...
            </div>
          ) : filteredExercises.length > 0 ? (
            <div className="space-y-2">
              {filteredExercises.map((exercise) => (
                <button
                  key={exercise.id}
                  onClick={() => onSelect(exercise.id, exercise)}
                  className="w-full text-left px-4 py-3 rounded-md border border-border bg-card hover:bg-accent active:bg-accent/80 transition-colors"
                >
                  <div className="font-medium text-foreground">
                    {exercise.name}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                    {translateMuscleGroup(exercise.primaryMuscle)} • {translateEquipment(exercise.equipment)}
                    {exercise.isCustom && (
                      <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                        Custom
                      </Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Keine Übungen gefunden
            </div>
          )}
        </div>
      </DialogContent>

      {/* 
        Create custom exercise via the shared ExerciseEditorDialog component.
        On success we optimistically add it to the visible list and immediately call onSelect 
        so the newly created exercise is added to the workout / template / blueprint.
      */}
      <ExerciseEditorDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={handleExerciseCreated}
      />
    </Dialog>
  );
}
