'use client';

import { useState, useEffect } from 'react';
import { MuscleGroup, Equipment, Exercise } from '@/types';
import { apiClient } from '@/lib/api';
import { MUSCLE_GROUP_LABELS, createIsolationPreset, validateMusclePercentages } from '@/lib/exercise-utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IconLoader2 } from '@tabler/icons-react';

interface ExerciseEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If provided, the dialog is in "edit" or "view" mode. */
  exercise?: Exercise;
  /** When true + exercise is provided → read-only view mode */
  readonly?: boolean;
  onSuccess?: (exercise: Exercise) => void;
}

interface PercentageState {
  abdomenPercent: number;
  latissimusPercent: number;
  trapeziusPercent: number;
  lowerBackPercent: number;
  hamstringsPercent: number;
  glutesPercent: number;
  shouldersPercent: number;
  bicepsPercent: number;
  chestPercent: number;
  quadricepsPercent: number;
  calvesPercent: number;
  tricepsPercent: number;
}

const defaultPercentages: PercentageState = {
  abdomenPercent: 0,
  latissimusPercent: 0,
  trapeziusPercent: 0,
  lowerBackPercent: 0,
  hamstringsPercent: 0,
  glutesPercent: 0,
  shouldersPercent: 0,
  bicepsPercent: 0,
  chestPercent: 100,
  quadricepsPercent: 0,
  calvesPercent: 0,
  tricepsPercent: 0,
};

const muscleGroupOptions: { value: MuscleGroup; label: string }[] = [
  { value: MuscleGroup.ABDOMEN, label: 'Bauch' },
  { value: MuscleGroup.LATISSIMUS, label: 'Latissimus' },
  { value: MuscleGroup.TRAPEZIUS, label: 'Trapez' },
  { value: MuscleGroup.LOWER_BACK, label: 'Unterer Rücken' },
  { value: MuscleGroup.HAMSTRINGS, label: 'Beinbeuger' },
  { value: MuscleGroup.GLUTES, label: 'Glutes' },
  { value: MuscleGroup.SHOULDERS, label: 'Schultern' },
  { value: MuscleGroup.BICEPS, label: 'Bizeps' },
  { value: MuscleGroup.CHEST, label: 'Brust' },
  { value: MuscleGroup.QUADRICEPS, label: 'Quadrizeps' },
  { value: MuscleGroup.CALVES, label: 'Waden' },
  { value: MuscleGroup.TRICEPS, label: 'Trizeps' },
];

const equipmentOptions: { value: Equipment; label: string }[] = [
  { value: Equipment.BARBELL, label: 'Langhantel' },
  { value: Equipment.DUMBBELL, label: 'Kurzhantel' },
  { value: Equipment.CABLE, label: 'Kabel' },
  { value: Equipment.MACHINE, label: 'Maschine' },
  { value: Equipment.BODYWEIGHT, label: 'Körpergewicht' },
  { value: Equipment.SMITH_MACHINE, label: 'Smith Machine' },
  { value: Equipment.EZ_BAR, label: 'SZ-Stange' },
];

export function ExerciseEditorDialog({
  open,
  onOpenChange,
  exercise,
  readonly = false,
  onSuccess,
}: ExerciseEditorDialogProps) {
  const isEditMode = !!exercise && !readonly;
  const isViewMode = !!exercise && readonly;

  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>(MuscleGroup.CHEST);
  const [equipment, setEquipment] = useState<Equipment>(Equipment.DUMBBELL);
  const [isUnilateral, setIsUnilateral] = useState(false);
  const [isDoubleWeight, setIsDoubleWeight] = useState(false);
  const [percentages, setPercentages] = useState<PercentageState>(defaultPercentages);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validation = validateMusclePercentages(percentages as unknown as Record<string, number>);

  // Reset form when dialog opens or exercise changes
  useEffect(() => {
    if (open) {
      if (exercise) {
        // Edit mode - prefill
        setName(exercise.name);
        setMuscleGroup(exercise.muscleGroup);
        setEquipment(exercise.equipment);
        setIsUnilateral(exercise.isUnilateral);
        setIsDoubleWeight(exercise.isDoubleWeight);
        setPercentages({
          abdomenPercent: exercise.abdomenPercent,
          latissimusPercent: exercise.latissimusPercent,
          trapeziusPercent: exercise.trapeziusPercent,
          lowerBackPercent: exercise.lowerBackPercent,
          hamstringsPercent: exercise.hamstringsPercent,
          glutesPercent: exercise.glutesPercent,
          shouldersPercent: exercise.shouldersPercent,
          bicepsPercent: exercise.bicepsPercent,
          chestPercent: exercise.chestPercent,
          quadricepsPercent: exercise.quadricepsPercent,
          calvesPercent: exercise.calvesPercent,
          tricepsPercent: exercise.tricepsPercent,
        });
      } else {
        // Create mode - reset to defaults
        setName('');
        setMuscleGroup(MuscleGroup.CHEST);
        setEquipment(Equipment.DUMBBELL);
        setIsUnilateral(false);
        setIsDoubleWeight(false);
        setPercentages(defaultPercentages);
      }
      setError('');
    }
  }, [open, exercise]);

  const updatePercentage = (field: keyof PercentageState, value: number) => {
    const clamped = Math.max(0, Math.min(100, value));
    setPercentages((prev) => ({ ...prev, [field]: clamped }));
  };

  const handleIsolationPreset = () => {
    const preset = createIsolationPreset(muscleGroup);
    setPercentages(preset as unknown as PercentageState);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewMode) return;

    setError('');

    if (!name.trim()) {
      setError('Bitte gib einen Namen ein');
      return;
    }

    if (!validation.valid) {
      setError(`Muskelgruppen-Prozente müssen 100% ergeben (aktuell: ${validation.sum}%)`);
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name: name.trim(),
        muscleGroup,
        equipment,
        isUnilateral,
        isDoubleWeight,
        ...percentages,
      };

      let result: Exercise;

      if (isEditMode && exercise) {
        result = await apiClient.updateExercise(exercise.id, payload);
      } else {
        result = await apiClient.createExercise(payload);
      }

      onSuccess?.(result);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
    } finally {
      setLoading(false);
    }
  };

  const title = isViewMode
    ? 'Übung anzeigen'
    : isEditMode
    ? 'Übung bearbeiten'
    : 'Benutzerdefinierte Übung erstellen';

  const submitLabel = isEditMode
    ? loading ? 'Wird gespeichert...' : 'Speichern'
    : loading ? 'Wird erstellt...' : 'Erstellen';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. Incline Dumbbell Press"
                autoFocus
                disabled={isViewMode}
                readOnly={isViewMode}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="muscleGroup">Hauptmuskelgruppe</Label>
                <select
                  id="muscleGroup"
                  value={muscleGroup}
                  onChange={(e) => setMuscleGroup(e.target.value as MuscleGroup)}
                  disabled={isViewMode}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60"
                >
                  {muscleGroupOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="equipment">Equipment</Label>
                <select
                  id="equipment"
                  value={equipment}
                  onChange={(e) => setEquipment(e.target.value as Equipment)}
                  disabled={isViewMode}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60"
                >
                  {equipmentOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isUnilateral"
                  checked={isUnilateral}
                  onChange={(e) => setIsUnilateral(e.target.checked)}
                  disabled={isViewMode}
                  className="h-4 w-4 accent-primary disabled:opacity-60"
                />
                <Label htmlFor="isUnilateral" className="text-sm cursor-pointer">
                  Unilateral
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isDoubleWeight"
                  checked={isDoubleWeight}
                  onChange={(e) => setIsDoubleWeight(e.target.checked)}
                  disabled={isViewMode}
                  className="h-4 w-4 accent-primary disabled:opacity-60"
                />
                <Label htmlFor="isDoubleWeight" className="text-sm cursor-pointer">
                  Doppeltes Gewicht
                </Label>
              </div>
            </div>
          </div>

          {/* Muscle Distribution */}
          <div className="border-t pt-5">
            <div className="flex items-center justify-between mb-3">
              <Label>Muskelgruppen-Verteilung</Label>
              {!isViewMode && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleIsolationPreset}
                >
                  Isolation (100%)
                </Button>
              )}
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">Gesamt</span>
                <span
                  className={`font-semibold ${
                    validation.valid
                      ? 'text-foreground'
                      : validation.sum > 100
                      ? 'text-destructive'
                      : 'text-orange-600 dark:text-orange-400'
                  }`}
                >
                  {validation.sum}% / 100%
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    validation.valid
                      ? 'bg-foreground'
                      : validation.sum > 100
                      ? 'bg-destructive'
                      : 'bg-orange-500'
                  }`}
                  style={{ width: `${Math.min(100, validation.sum)}%` }}
                />
              </div>
            </div>

            {/* Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 max-h-[320px] overflow-y-auto pr-1">
              {(Object.entries(MUSCLE_GROUP_LABELS) as [MuscleGroup, string][])
                .filter(([key]) => ![MuscleGroup.ABS, MuscleGroup.BACK, MuscleGroup.LEGS].includes(key))
                .map(([key, label]) => {
                  const fieldMap: Record<MuscleGroup, keyof PercentageState> = {
                    [MuscleGroup.ABDOMEN]: 'abdomenPercent',
                    [MuscleGroup.LATISSIMUS]: 'latissimusPercent',
                    [MuscleGroup.TRAPEZIUS]: 'trapeziusPercent',
                    [MuscleGroup.LOWER_BACK]: 'lowerBackPercent',
                    [MuscleGroup.HAMSTRINGS]: 'hamstringsPercent',
                    [MuscleGroup.GLUTES]: 'glutesPercent',
                    [MuscleGroup.SHOULDERS]: 'shouldersPercent',
                    [MuscleGroup.BICEPS]: 'bicepsPercent',
                    [MuscleGroup.CHEST]: 'chestPercent',
                    [MuscleGroup.QUADRICEPS]: 'quadricepsPercent',
                    [MuscleGroup.CALVES]: 'calvesPercent',
                    [MuscleGroup.TRICEPS]: 'tricepsPercent',
                    [MuscleGroup.ABS]: 'abdomenPercent',
                    [MuscleGroup.BACK]: 'latissimusPercent',
                    [MuscleGroup.LEGS]: 'quadricepsPercent',
                  };

                  const field = fieldMap[key];
                  const value = percentages[field];

                  return (
                    <div key={key} className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium">{label}</span>
                        <span className="text-muted-foreground tabular-nums">{value}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={value}
                        onChange={(e) => updatePercentage(field, parseInt(e.target.value))}
                        disabled={isViewMode}
                        className="w-full accent-primary disabled:opacity-60 cursor-not-allowed"
                      />
                    </div>
                  );
                })}
            </div>
          </div>

          <DialogFooter className="pt-2">
            {isViewMode ? (
              <Button
                type="button"
                onClick={() => onOpenChange(false)}
              >
                Schließen
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                >
                  Abbrechen
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !name.trim() || !validation.valid}
                >
                  {loading && <IconLoader2 className="mr-2 size-4 animate-spin" />}
                  {submitLabel}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
