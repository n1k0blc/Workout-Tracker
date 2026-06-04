'use client';

import { useState, useEffect, useCallback } from 'react';
import { Exercise, MuscleGroup, Equipment } from '@/types';
import { apiClient } from '@/lib/api';
import { MUSCLE_GROUP_LABELS } from '@/lib/exercise-utils';
import { ExerciseEditorDialog } from '@/components/exercises/exercise-editor-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { IconPlus } from '@tabler/icons-react';

interface ExerciseSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (exerciseId: string, exercise?: Exercise) => void;
}

export default function ExerciseSelectionModal({
  open,
  onOpenChange,
  onSelect,
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

  const loadExercises = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.getExercises({
        search: search || undefined,
        muscleGroup: muscleGroupFilter,
        equipment: equipmentFilter,
        includeCustom: true,
      });
      setExercises(data);
    } catch (error) {
      console.error('Failed to load exercises:', error);
    } finally {
      setLoading(false);
    }
  }, [search, muscleGroupFilter, equipmentFilter]);

  useEffect(() => {
    loadExercises();
  }, [loadExercises]);

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
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>Übung hinzufügen</DialogTitle>
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
        <div className="px-6 py-3 border-b space-y-3 shrink-0">
          {/* Muscle Group Filter */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">
              Muskelgruppe
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={!muscleGroupFilter ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMuscleGroupFilter(undefined)}
              >
                Alle
              </Button>
              {muscleGroups.map((mg) => (
                <Button
                  key={mg}
                  variant={muscleGroupFilter === mg ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMuscleGroupFilter(mg)}
                >
                  {translateMuscleGroup(mg)}
                </Button>
              ))}
            </div>
          </div>

          {/* Equipment Filter */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">
              Equipment
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={!equipmentFilter ? 'default' : 'outline'}
                size="sm"
                onClick={() => setEquipmentFilter(undefined)}
              >
                Alle
              </Button>
              {equipments.map((eq) => (
                <Button
                  key={eq}
                  variant={equipmentFilter === eq ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEquipmentFilter(eq)}
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
          ) : exercises.length > 0 ? (
            <div className="space-y-2">
              {exercises.map((exercise) => (
                <button
                  key={exercise.id}
                  onClick={() => onSelect(exercise.id, exercise)}
                  className="w-full text-left px-4 py-3 rounded-md border border-border bg-card hover:bg-accent active:bg-accent/80 transition-colors"
                >
                  <div className="font-medium text-foreground">
                    {exercise.name}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                    {translateMuscleGroup(exercise.muscleGroup)} • {translateEquipment(exercise.equipment)}
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
