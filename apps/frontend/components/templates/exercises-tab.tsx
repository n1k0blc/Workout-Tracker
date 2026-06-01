'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { Exercise, MuscleGroup, Equipment } from '@/types';
import { ExerciseEditorDialog } from '@/components/exercises/exercise-editor-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { IconPlus, IconTrash, IconEdit } from '@tabler/icons-react';

export default function ExercisesTab() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [muscleGroupFilter, setMuscleGroupFilter] = useState<MuscleGroup | undefined>();
  const [equipmentFilter, setEquipmentFilter] = useState<Equipment | undefined>();
  // 'create' | Exercise | null
  const [editingExercise, setEditingExercise] = useState<Exercise | 'create' | null>(null);
  const [viewExercise, setViewExercise] = useState<Exercise | null>(null);
  const [deleteExerciseId, setDeleteExerciseId] = useState<string | null>(null);

  useEffect(() => {
    loadExercises();
  }, [search, muscleGroupFilter, equipmentFilter]);

  const loadExercises = async () => {
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
  };

  const handleExerciseSaved = (exercise: Exercise) => {
    setExercises((prev) => {
      const exists = prev.some((ex) => ex.id === exercise.id);
      if (exists) {
        return prev.map((ex) => (ex.id === exercise.id ? exercise : ex));
      } else {
        return [exercise, ...prev];
      }
    });
    setEditingExercise(null);
  };

  const handleDeleteExercise = async () => {
    if (!deleteExerciseId) return;

    try {
      await apiClient.deleteExercise(deleteExerciseId);
      setExercises((prev) => prev.filter((ex) => ex.id !== deleteExerciseId));
      setDeleteExerciseId(null);
    } catch (error) {
      console.error('Failed to delete exercise:', error);
      alert('Fehler beim Löschen der Übung. Möglicherweise wird sie noch verwendet.');
    }
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
    const translations: Record<MuscleGroup, string> = {
      // Legacy groups (kept for backwards compatibility)
      CHEST: 'Brust',
      BACK: 'Rücken',
      BICEPS: 'Bizeps',
      TRICEPS: 'Trizeps',
      ABS: 'Bauch',
      SHOULDERS: 'Schultern',
      LEGS: 'Beine',
      // New granular muscle groups
      ABDOMEN: 'Bauch',
      LATISSIMUS: 'Latissimus',
      TRAPEZIUS: 'Trapez',
      LOWER_BACK: 'Unterer Rücken',
      HAMSTRINGS: 'Beinbeuger',
      GLUTES: 'Glutes',
      QUADRICEPS: 'Quadrizeps',
      CALVES: 'Waden',
    };
    return translations[mg] || mg;
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
    <div className="space-y-6">
      {/* Header with count */}
      <div>
        <p className="text-sm text-muted-foreground">{exercises.length} Übungen verfügbar</p>
      </div>

      {/* Search */}
      <div className="bg-card border rounded-lg p-4">
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Übung suchen..."
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6 space-y-6">
          {/* Muscle Group Filter */}
          <div>
            <div className="text-sm font-medium text-muted-foreground mb-3">
              Muskelgruppe
            </div>
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
            <div className="text-sm font-medium text-muted-foreground mb-3">
              Equipment
            </div>
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
        </CardContent>
      </Card>

      {/* Create Custom Exercise Button */}
      <Button
        onClick={() => setEditingExercise('create')}
        className="w-full"
        size="lg"
      >
        <IconPlus className="mr-2 size-5" />
        Benutzerdefinierte Übung erstellen
      </Button>

      {/* Exercise List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-lg text-muted-foreground">Lädt Übungen...</div>
        </div>
      ) : exercises.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {exercises.map((exercise) => (
            <Card
              key={exercise.id}
              className={!exercise.isCustom ? 'cursor-pointer hover:shadow-sm transition-shadow' : ''}
              onClick={() => !exercise.isCustom && setViewExercise(exercise)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{exercise.name}</h3>
                    <div className="mt-2 space-y-1 text-sm">
                      <div className="text-muted-foreground">
                        <span className="font-medium text-foreground">Muskel:</span>{' '}
                        {translateMuscleGroup(exercise.muscleGroup)}
                      </div>
                      <div className="text-muted-foreground">
                        <span className="font-medium text-foreground">Equipment:</span>{' '}
                        {translateEquipment(exercise.equipment)}
                      </div>
                      {(exercise.isUnilateral || exercise.isDoubleWeight) && (
                        <div className="flex gap-1.5 mt-2">
                          {exercise.isUnilateral && (
                            <Badge variant="outline" className="text-xs">Unilateral</Badge>
                          )}
                          {exercise.isDoubleWeight && (
                            <Badge variant="outline" className="text-xs">2x Gewicht</Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {exercise.isCustom && (
                      <>
                        <Badge variant="secondary" className="text-xs">Custom</Badge>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => setEditingExercise(exercise)}
                            title="Übung bearbeiten"
                          >
                            <IconEdit className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteExerciseId(exercise.id)}
                            title="Übung löschen"
                          >
                            <IconTrash className="size-4" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">Keine Übungen gefunden</p>
          </CardContent>
        </Card>
      )}

      {/* Exercise Editor (Create + Edit) */}
      <ExerciseEditorDialog
        open={editingExercise !== null}
        onOpenChange={(open) => {
          if (!open) setEditingExercise(null);
        }}
        exercise={editingExercise === 'create' ? undefined : editingExercise ?? undefined}
        onSuccess={handleExerciseSaved}
      />

      {/* View Exercise (readonly) */}
      <ExerciseEditorDialog
        open={!!viewExercise}
        onOpenChange={(open) => {
          if (!open) setViewExercise(null);
        }}
        exercise={viewExercise ?? undefined}
        readonly
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteExerciseId} onOpenChange={(open) => !open && setDeleteExerciseId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Übung löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie diese benutzerdefinierte Übung wirklich löschen? Diese Aktion kann nicht
              rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteExercise}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
