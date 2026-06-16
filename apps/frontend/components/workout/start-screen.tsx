'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkout } from '@/lib/workout-context';
import { apiClient } from '@/lib/api';
import { Workout } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  IconCalendar,
  IconDumbbell,
  IconTemplate,
  IconHistory,
  IconX,
  IconAlertTriangle,
  IconTarget,
} from '@tabler/icons-react';
import CycleWorkoutSelectionModal from './cycle-workout-selection-modal';
import GymLocationModal from './gym-location-modal';
import PastWorkoutSetupModal from './past-workout-setup-modal';
import TemplateSelectionModal from './template-selection-modal';

export default function WorkoutStartScreen() {
  const router = useRouter();
  const { startWorkout, loading, setActiveWorkoutDirectly } = useWorkout();
  const [suggestedWorkout, setSuggestedWorkout] = useState<Workout | null>(
    null
  );
  const [loadingSuggestion, setLoadingSuggestion] = useState(true);
  const [error, setError] = useState('');
  const [showCycleWorkoutModal, setShowCycleWorkoutModal] = useState(false);
  const [showGymLocationModal, setShowGymLocationModal] = useState(false);
  const [showPastWorkoutModal, setShowPastWorkoutModal] = useState(false);
  const [showPastWorkoutDetails, setShowPastWorkoutDetails] = useState(false);

  // State for the common past workout details step
  const [pastDetailsDate, setPastDetailsDate] = useState('');
  const [pastDetailsDuration, setPastDetailsDuration] = useState(60);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateRecommendedGymId, setTemplateRecommendedGymId] = useState<string | undefined>();
  const [hasActiveCycle, setHasActiveCycle] = useState(false);
  const [pendingWorkoutData, setPendingWorkoutData] = useState<{
    cycleId?: string;
    workoutDayId?: string;
    isFreeWorkout?: boolean;
    isPastWorkout?: boolean;
    pastWorkoutDate?: string;
    pastWorkoutDuration?: number;
  } | null>(null);

  useEffect(() => {
    const loadSuggestion = async () => {
      try {
        const workout = await apiClient.getSuggestedWorkout();
        setSuggestedWorkout(workout);
      } catch (err) {
        console.error('Failed to load suggested workout:', err);
        setError(
          'Kein vorgeschlagenes Workout verfügbar. Starte ein freies Workout.'
        );
      } finally {
        setLoadingSuggestion(false);
      }
    };

    const checkActiveCycle = async () => {
      try {
        const cycleWorkouts = await apiClient.getCurrentCycleWorkouts();
        setHasActiveCycle(cycleWorkouts !== null);
      } catch (err) {
        console.error('Failed to check active cycle:', err);
      }
    };

    loadSuggestion();
    checkActiveCycle();
  }, []);

  const handleStartSuggested = () => {
    if (!suggestedWorkout) return;

    setPendingWorkoutData({
      cycleId: suggestedWorkout.cycleId,
      workoutDayId: suggestedWorkout.workoutDayId,
      isFreeWorkout: false,
    });
    setShowGymLocationModal(true);
  };

  const handleStartFree = () => {
    setPendingWorkoutData({
      isFreeWorkout: true,
    });
    setShowGymLocationModal(true);
  };

  const handleStartCycleWorkout = (cycleId: string, workoutDayId: string) => {
    setPendingWorkoutData((prev) => ({
      ...prev,
      cycleId,
      workoutDayId,
      isFreeWorkout: false,
      isPastWorkout: prev?.isPastWorkout,
      pastWorkoutDate: prev?.pastWorkoutDate,
      pastWorkoutDuration: prev?.pastWorkoutDuration,
    }));
    setShowCycleWorkoutModal(false);

    if (pendingWorkoutData?.isPastWorkout) {
      // For past workouts, go to details step first
      openPastWorkoutDetails();
    } else {
      setShowGymLocationModal(true);
    }
  };

  const handleGymLocationSelected = async (homeGymId: string | null) => {
    // Check if this is for a template workout
    if (selectedTemplateId) {
      await handleGymForTemplate(homeGymId);
      return;
    }

    // Normal workout start
    if (!pendingWorkoutData) return;

    setShowGymLocationModal(false);
    
    try {
      await startWorkout({
        ...pendingWorkoutData,
        homeGymId,
        isFreeWorkout: pendingWorkoutData.isFreeWorkout ?? false,
      });
      setPendingWorkoutData(null);
    } catch (err) {
      setError('Fehler beim Starten des Workouts');
      console.error('Failed to start workout:', err);
    }
  };

  const handleStartPastWorkout = () => {
    setShowPastWorkoutModal(true);
  };

  // New simplified handlers for the restructured past workout flow
  const handlePastWorkoutChooseFree = () => {
    setShowPastWorkoutModal(false);
    setPendingWorkoutData({
      isFreeWorkout: true,
      isPastWorkout: true,
    });
    openPastWorkoutDetails();
  };

  const handlePastWorkoutChooseCycle = () => {
    setShowPastWorkoutModal(false);
    setPendingWorkoutData({
      isFreeWorkout: false,
      isPastWorkout: true,
    });
    setShowCycleWorkoutModal(true);
  };

  const handlePastWorkoutChooseTemplate = () => {
    setShowPastWorkoutModal(false);
    setPendingWorkoutData({
      isFreeWorkout: false,
      isPastWorkout: true,
    });
    setShowTemplateModal(true);
  };

  // Handlers for the common Workout Details step (used by Free, Cycle, and Template past flows)
  const openPastWorkoutDetails = () => {
    setPastDetailsDate(new Date().toISOString().split('T')[0]);
    setPastDetailsDuration(60);
    setShowPastWorkoutDetails(true);
  };

  const handlePastWorkoutDetailsConfirm = () => {
    setPendingWorkoutData((prev) => ({
      ...prev,
      pastWorkoutDate: pastDetailsDate,
      pastWorkoutDuration: pastDetailsDuration * 60,
    }));
    setShowPastWorkoutDetails(false);
    setShowGymLocationModal(true);
  };

  const handlePastWorkoutDetailsBack = () => {
    setShowPastWorkoutDetails(false);
    setShowPastWorkoutModal(true);
    setPendingWorkoutData(null);
  };

  const handleTemplateSelected = (templateId: string, recommendedGymId?: string) => {
    setSelectedTemplateId(templateId);
    setTemplateRecommendedGymId(recommendedGymId);
    setShowTemplateModal(false);
    
    // If this is part of a past workout flow, keep the past workout data
    // Otherwise, clear it (normal template workout)
    if (!pendingWorkoutData?.isPastWorkout) {
      setPendingWorkoutData(null);
    }
    
    if (pendingWorkoutData?.isPastWorkout) {
      openPastWorkoutDetails();
    } else {
      setShowGymLocationModal(true);
    }
  };

  const handleGymForTemplate = async (homeGymId: string | null) => {
    if (!selectedTemplateId) return;

    setShowGymLocationModal(false);

    try {
      // Start workout from template - this returns the created workout
      const workout = await apiClient.startWorkoutFromTemplate(
        selectedTemplateId,
        homeGymId || undefined,
        pendingWorkoutData?.isPastWorkout,
        pendingWorkoutData?.pastWorkoutDate,
        pendingWorkoutData?.pastWorkoutDuration,
      );
      
      setSelectedTemplateId(null);
      setTemplateRecommendedGymId(undefined);
      
      // Navigate to workout screen for all template workouts
      // Pass isPastWorkout and pastWorkoutDuration to context
      setActiveWorkoutDirectly(
        workout,
        pendingWorkoutData?.isPastWorkout,
        pendingWorkoutData?.pastWorkoutDuration
      );
      
      setPendingWorkoutData(null);
    } catch (err) {
      setError('Fehler beim Starten des Vorlagen-Workouts');
      console.error('Failed to start template workout:', err);
    }
  };

  if (loadingSuggestion) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-lg text-muted-foreground">
          Lade Workout-Vorschlag...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">
              Neues Workout
            </h1>
            <Button
              variant="ghost"
              onClick={() => router.push('/dashboard')}
            >
              <IconX className="mr-2 size-4" />
              Abbrechen
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950">
            <IconAlertTriangle className="mt-0.5 size-5 text-yellow-600 dark:text-yellow-400" />
            <p className="text-sm text-yellow-800 dark:text-yellow-200">{error}</p>
          </div>
        )}

        {/* Suggested Workout */}
        {suggestedWorkout && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <IconTarget className="mt-1 size-5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-foreground mb-2">
                    Vorgeschlagenes Workout
                  </h2>
                  {suggestedWorkout.cycleName && (
                    <p className="text-muted-foreground text-sm mb-4">
                      {suggestedWorkout.cycleName} • {suggestedWorkout.workoutDayName}
                    </p>
                  )}

                  {suggestedWorkout.exercises.length > 0 ? (
                    <>
                      <div className="space-y-3 mb-4">
                        {suggestedWorkout.exercises.map((exercise) => (
                          <div
                            key={exercise.exerciseId}
                            className="rounded-md border bg-muted/30 p-4"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-muted-foreground">
                                    #{exercise.order}
                                  </span>
                                  <h3 className="font-semibold text-foreground">
                                    {exercise.exerciseName}
                                  </h3>
                                </div>
                                {exercise.plannedSets && exercise.plannedSets.length > 0 && (
                                  <div className="mt-2 space-y-1">
                                    <div className="text-sm font-medium text-foreground">
                                      {exercise.plannedSets.length} geplante Sätze:
                                    </div>
                                    {exercise.plannedSets.map((set, setIdx) => (
                                      <div key={setIdx} className="text-sm text-muted-foreground">
                                        {set.setType === 'WARMUP' ? 'Aufwärmen' : 'Arbeit'} — {set.reps} Wdh × {set.weight} kg @ RIR {set.rir}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <Button
                        onClick={handleStartSuggested}
                        disabled={loading}
                        className="w-full"
                        size="lg"
                      >
                        {loading ? 'Wird gestartet...' : 'Vorgeschlagenes Workout starten'}
                      </Button>
                    </>
                  ) : (
                    <p className="text-muted-foreground">
                      Keine Übungen im vorgeschlagenen Workout.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Free Workout Option */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <IconDumbbell className="mt-1 size-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-foreground mb-2">
                  Freies Workout
                </h2>
                <p className="text-muted-foreground text-sm mb-4">
                  Starte ein Workout ohne Vorlage und füge Übungen nach Belieben hinzu.
                </p>
                <Button
                  onClick={handleStartFree}
                  disabled={loading}
                  className="w-full"
                >
                  Freies Workout starten
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Template Workout */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <IconTemplate className="mt-1 size-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-foreground mb-2">
                  Vorlagenworkout starten
                </h2>
                <p className="text-muted-foreground text-sm mb-4">
                  Wähle eine gespeicherte Workout-Vorlage und starte direkt mit vorausgefüllten Übungen und Werten.
                </p>
                <Button
                  onClick={() => setShowTemplateModal(true)}
                  disabled={loading}
                  className="w-full"
                >
                  Vorlage wählen
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cycle Workout Selection */}
        {hasActiveCycle && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <IconCalendar className="mt-1 size-5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-foreground mb-2">
                    Andere Workouts aus dem Zyklus
                  </h2>
                  <p className="text-muted-foreground text-sm mb-4">
                    Wähle ein beliebiges Workout aus deinem aktuellen Trainingszyklus.
                  </p>
                  <Button
                    onClick={() => setShowCycleWorkoutModal(true)}
                    disabled={loading}
                    className="w-full"
                  >
                    Workout aus Zyklus wählen
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Past Workout Tracking */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <IconHistory className="mt-1 size-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-foreground mb-2">
                  Vergangenes Workout tracken
                </h2>
                <p className="text-muted-foreground text-sm mb-4">
                  Trage ein bereits durchgeführtes Workout nachträglich ein.
                </p>
                <Button
                  onClick={handleStartPastWorkout}
                  disabled={loading}
                  className="w-full"
                >
                  Vergangenes Workout tracken
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Cycle Workout Selection Modal */}
      {showCycleWorkoutModal && (
        <CycleWorkoutSelectionModal
          onClose={() => {
            setShowCycleWorkoutModal(false);
            if (pendingWorkoutData?.isPastWorkout) {
              // Go back to type selection
              setShowPastWorkoutModal(true);
            }
          }}
          onSelect={handleStartCycleWorkout}
          onProceedToDetails={
            pendingWorkoutData?.isPastWorkout
              ? (cycleId, workoutDayId) => {
                  handleStartCycleWorkout(cycleId, workoutDayId);
                }
              : undefined
          }
        />
      )}

      {/* Template Selection Modal */}
      {showTemplateModal && (
        <TemplateSelectionModal
          onClose={() => {
            setShowTemplateModal(false);
            if (pendingWorkoutData?.isPastWorkout) {
              // Go back to type selection
              setShowPastWorkoutModal(true);
            }
          }}
          onSelect={handleTemplateSelected}
          onProceedToDetails={
            pendingWorkoutData?.isPastWorkout
              ? (templateId, recommendedGymId) => {
                  handleTemplateSelected(templateId, recommendedGymId);
                }
              : undefined
          }
        />
      )}

      {/* Gym Location Modal */}
      <GymLocationModal
        isOpen={showGymLocationModal}
        onClose={() => {
          setShowGymLocationModal(false);
          setPendingWorkoutData(null);
          setSelectedTemplateId(null);
          setTemplateRecommendedGymId(undefined);
        }}
        onSelectGym={handleGymLocationSelected}
        plannedHomeGymId={templateRecommendedGymId || suggestedWorkout?.plannedHomeGymId}
      />

      {/* Past Workout Setup Modal - only type selection now */}
      <PastWorkoutSetupModal
        isOpen={showPastWorkoutModal}
        onClose={() => setShowPastWorkoutModal(false)}
        onChooseFree={handlePastWorkoutChooseFree}
        onChooseCycle={handlePastWorkoutChooseCycle}
        onChooseTemplate={handlePastWorkoutChooseTemplate}
      />

      {/* Common Workout Details step for past workouts (Date + Duration) */}
      <Dialog open={showPastWorkoutDetails} onOpenChange={(open) => !open && handlePastWorkoutDetailsBack()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Workout-Details</DialogTitle>
            <DialogDescription>
              Gib Datum und ungefähre Dauer des vergangenen Workouts ein.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Workout-Datum</Label>
              <Input
                type="date"
                value={pastDetailsDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setPastDetailsDate(e.target.value)}
              />
            </div>

            <div>
              <Label>Workout-Dauer (Minuten)</Label>
              <Input
                type="number"
                min="1"
                value={pastDetailsDuration}
                onChange={(e) => setPastDetailsDuration(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          <DialogFooter className="flex gap-3">
            <Button variant="outline" onClick={handlePastWorkoutDetailsBack} className="flex-1">
              Zurück
            </Button>
            <Button
              onClick={handlePastWorkoutDetailsConfirm}
              disabled={!pastDetailsDate || pastDetailsDuration < 1}
              className="flex-1"
            >
              Weiter zur Gym Auswahl
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Common Workout Details step for past workouts */}
      <Dialog open={showPastWorkoutDetails} onOpenChange={(open) => !open && handlePastWorkoutDetailsBack()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Workout-Details</DialogTitle>
            <DialogDescription>
              Gib Datum und ungefähre Dauer des vergangenen Workouts ein.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Workout-Datum</Label>
              <Input
                type="date"
                value={pastDetailsDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setPastDetailsDate(e.target.value)}
              />
            </div>

            <div>
              <Label>Workout-Dauer (Minuten)</Label>
              <Input
                type="number"
                min="1"
                value={pastDetailsDuration}
                onChange={(e) => setPastDetailsDuration(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          <DialogFooter className="flex gap-3">
            <Button variant="outline" onClick={handlePastWorkoutDetailsBack} className="flex-1">
              Zurück
            </Button>
            <Button
              onClick={handlePastWorkoutDetailsConfirm}
              disabled={!pastDetailsDate || pastDetailsDuration < 1}
              className="flex-1"
            >
              Weiter zur Gym Auswahl
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
