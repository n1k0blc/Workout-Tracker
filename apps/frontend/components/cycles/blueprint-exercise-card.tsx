'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import { SetType, Exercise } from '@/types';
import { BlueprintSetData } from './cycle-wizard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { IconGripVertical, IconTrash, IconPlus, IconFlame, IconBarbell } from '@tabler/icons-react';

interface BlueprintExercise {
  exerciseId: string;
  order: number;
  sets: BlueprintSetData[];
}

interface BlueprintExerciseCardProps {
  blueprintExercise: BlueprintExercise;
  exercise: Exercise | undefined;
  exerciseIndex: number;
  onRemove: () => void;
  onUpdateSet: (setIdx: number, field: keyof BlueprintSetData, value: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
  onRemoveSet: (setIdx: number) => void;
  onAddSet: () => void;
}

export function BlueprintExerciseCard({
  blueprintExercise,
  exercise,
  exerciseIndex,
  onRemove,
  onUpdateSet,
  onRemoveSet,
  onAddSet,
}: BlueprintExerciseCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `${blueprintExercise.exerciseId}-${blueprintExercise.order}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="overflow-hidden"
    >
      {/* Header with Drag + Collapse + Remove (sera style) */}
      <div className="flex items-center justify-between p-4 bg-muted border-b border-border">
        <div className="flex items-center gap-3 flex-1">
          {/* Drag Handle */}
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing touch-none p-1 hover:bg-muted-foreground/10 rounded"
            aria-label="Übung verschieben"
          >
            <IconGripVertical className="size-4 text-muted-foreground" />
          </button>

          <div>
            <div className="font-medium text-foreground">
              {exercise?.name || 'Übung'}
            </div>
            <div className="text-xs text-muted-foreground">
              {blueprintExercise.sets.length} Sätze
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="size-8"
            aria-label={isCollapsed ? 'Aufklappen' : 'Zuklappen'}
          >
            {isCollapsed ? '▼' : '▲'}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="size-8 text-destructive hover:text-destructive"
            aria-label="Übung entfernen"
          >
            <IconTrash className="size-4" />
          </Button>
        </div>
      </div>

      {/* Expanded Content (sera) */}
      {!isCollapsed && (
        <CardContent className="p-4 bg-background border-t border-border space-y-3">
          {blueprintExercise.sets.map((set, setIdx) => (
            <div key={setIdx} className="border border-border rounded-md p-3 bg-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Satz {set.order}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveSet(setIdx)}
                  className="h-6 px-2 text-destructive hover:text-destructive text-xs"
                >
                  <IconTrash className="size-3 mr-1" /> Entfernen
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Typ</Label>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={set.setType === 'WARMUP' ? 'outline' : 'default'}
                      className="cursor-pointer"
                      onClick={() => onUpdateSet(setIdx, 'setType', set.setType === 'WARMUP' ? 'WORKING' : 'WARMUP')}
                    >
                      {set.setType === 'WARMUP' ? <IconFlame className="size-3 mr-1" /> : <IconBarbell className="size-3 mr-1" />}
                      {set.setType === 'WARMUP' ? 'Aufwärmen' : 'Arbeit'}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Gewicht (kg)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={set.weight}
                    onChange={(e) => onUpdateSet(setIdx, 'weight', parseFloat(e.target.value) || 0)}
                    className="h-8 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Wiederholungen</Label>
                  <Input
                    type="number"
                    value={set.reps}
                    onChange={(e) => onUpdateSet(setIdx, 'reps', parseInt(e.target.value) || 0)}
                    className="h-8 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">RIR</Label>
                  <Input
                    type="number"
                    value={set.rir}
                    onChange={(e) => onUpdateSet(setIdx, 'rir', parseInt(e.target.value) || 0)}
                    className="h-8 text-sm"
                  />
                </div>

                <div className="col-span-2 space-y-1">
                  <Label className="text-xs text-muted-foreground">Pause nach Satz (s)</Label>
                  <Input
                    type="number"
                    value={set.restAfterSet}
                    onChange={(e) => onUpdateSet(setIdx, 'restAfterSet', parseInt(e.target.value) || 90)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>
          ))}

          <Button
            variant="outline"
            onClick={onAddSet}
            className="w-full"
          >
            <IconPlus className="size-4 mr-2" /> Satz hinzufügen
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
