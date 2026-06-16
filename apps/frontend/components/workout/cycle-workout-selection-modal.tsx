'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { IconChevronRight } from '@tabler/icons-react';

interface CycleWorkoutDay {
  workoutDayId: string;
  workoutDayName: string;
  weekday: number;
  isSuggested: boolean;
  exerciseCount: number;
}

interface CurrentCycleWorkouts {
  cycleId: string;
  cycleName: string;
  workoutDays: CycleWorkoutDay[];
}

interface CycleWorkoutSelectionModalProps {
  onClose: () => void;
  onSelect: (cycleId: string, workoutDayId: string) => void;
  /** When provided, the modal acts in "selection + confirm" mode (used for past workout tracking) */
  onProceedToDetails?: (cycleId: string, workoutDayId: string) => void;
}

export default function CycleWorkoutSelectionModal({
  onClose,
  onSelect,
  onProceedToDetails,
}: CycleWorkoutSelectionModalProps) {
  const [cycleWorkouts, setCycleWorkouts] = useState<CurrentCycleWorkouts | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedWorkoutDayId, setSelectedWorkoutDayId] = useState<string | null>(null);

  useEffect(() => {
    const loadCycleWorkouts = async () => {
      try {
        const data = await apiClient.getCurrentCycleWorkouts();
        setCycleWorkouts(data);
      } catch (error) {
        console.error('Failed to load cycle workouts:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCycleWorkouts();
  }, []);

  const getWeekdayName = (weekday: number): string => {
    const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    return days[weekday];
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Workout aus aktuellem Zyklus wählen</DialogTitle>
          {cycleWorkouts && (
            <p className="text-sm text-muted-foreground mt-1">
              {cycleWorkouts.cycleName}
            </p>
          )}
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Lädt Workouts...
            </div>
          ) : cycleWorkouts && cycleWorkouts.workoutDays.length > 0 ? (
            <div className="space-y-3">
              {cycleWorkouts.workoutDays.map((workoutDay) => {
                const isSelected = selectedWorkoutDayId === workoutDay.workoutDayId;
                const isHighlighted = workoutDay.isSuggested || isSelected;

                return (
                  <button
                    key={workoutDay.workoutDayId}
                    onClick={() => {
                      if (onProceedToDetails) {
                        // In "proceed" mode (past workout), just select
                        setSelectedWorkoutDayId(workoutDay.workoutDayId);
                      } else {
                        onSelect(cycleWorkouts.cycleId, workoutDay.workoutDayId);
                      }
                    }}
                    className={`w-full text-left px-4 py-4 border rounded-lg transition-colors hover:border-primary hover:bg-muted/50 ${
                      isHighlighted
                        ? 'border-primary bg-muted/30'
                        : 'border-border'
                    } ${isSelected ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground">
                            {workoutDay.workoutDayName}
                          </h3>
                          {workoutDay.isSuggested && (
                            <Badge variant="default" className="text-xs">
                              Heute empfohlen
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {getWeekdayName(workoutDay.weekday)} • {workoutDay.exerciseCount} Übungen
                        </div>
                      </div>
                      <IconChevronRight className="size-5 text-muted-foreground flex-shrink-0 mt-1" />
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Keine Workouts im aktuellen Zyklus verfügbar
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-6">
          {onProceedToDetails ? (
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Zurück
              </Button>
              <Button
                onClick={() => {
                  if (selectedWorkoutDayId && cycleWorkouts) {
                    onProceedToDetails(cycleWorkouts.cycleId, selectedWorkoutDayId);
                  }
                }}
                disabled={!selectedWorkoutDayId}
                className="flex-1"
              >
                Weiter zu Workout Details
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={onClose} className="w-full">
              Abbrechen
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
