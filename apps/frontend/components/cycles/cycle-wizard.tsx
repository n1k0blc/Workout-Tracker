'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { SetType } from '@/types';
import BasicInfoStep from './basic-info-step';
import WorkoutDaysStep from './workout-days-step';
import BlueprintEditorStep from './blueprint-editor-step';
import ReviewStep from './review-step';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { withArrayPositionOrder } from '@/lib/workout-order';

export interface BlueprintSetData {
  order: number;
  setType: SetType;
  reps: number;
  weight: number;
  rir: number;
  // Per-side targets for a unilateral exercise's planned set (issue #103). Carried straight
  // through to the create-cycle payload; absent for bilateral exercises.
  repsLeft?: number;
  repsRight?: number;
  weightLeft?: number;
  weightRight?: number;
  rirLeft?: number;
  rirRight?: number;
  rest: number;
}

export interface WorkoutDayData {
  weekday: number;
  name: string;
  plannedHomeGymId?: string;
  blueprint: {
    exercises: Array<{
      // Client-only draft fields. The blueprint is the single source of truth the editor
      // re-derives its local state from on every edit, so these have to survive the round trip
      // (stable React keys, and display data for exercises the catalogue can't describe).
      // The submit payload below picks only exerciseId and sets, so they never reach the API.
      id?: string;
      exerciseName?: string;
      isUnilateral?: boolean;
      isDoubleWeight?: boolean;
      exerciseId: string;
      order: number;
      sets: BlueprintSetData[];
    }>;
  };
}

export interface CycleFormData {
  name: string;
  duration: number;
  startDate: string;
  workoutDays: WorkoutDayData[];
}

export default function CycleWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState<CycleFormData>({
    name: '',
    duration: 4,
    startDate: new Date().toISOString().split('T')[0],
    workoutDays: [],
  });

  const [currentDayIndex, setCurrentDayIndex] = useState<number | null>(null);

  const totalSteps = 4;

  const updateFormData = (data: Partial<CycleFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const handleNext = () => {
    setError('');
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
  };

  const handleBack = () => {
    setError('');
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      // Transform data structure for backend API
      const payload = {
        name: formData.name,
        duration: formData.duration,
        startDate: formData.startDate,
        workoutDays: formData.workoutDays.map((day) => ({
          weekday: day.weekday,
          name: day.name,
          plannedHomeGymId: day.plannedHomeGymId,
          exercises: withArrayPositionOrder(day.blueprint.exercises.map((ex) => ({
            exerciseId: ex.exerciseId,
            sets: ex.sets,
          }))),
        })),
      };

      await apiClient.createCycle(payload);
      router.push('/cycles');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Erstellen des Zyklus');
    } finally {
      setLoading(false);
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 1:
        return 'Basis-Informationen';
      case 2:
        return 'Trainingstage auswählen';
      case 3:
        return 'Blueprint erstellen';
      case 4:
        return 'Überprüfen & Erstellen';
      default:
        return '';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header (shadcn/sera consistent with other flows) */}
      <div className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Neuer Trainingszyklus
              </h1>
              <p className="text-sm text-muted-foreground mt-1">{getStepTitle()}</p>
            </div>
            <Button
              variant="ghost"
              onClick={() => router.push('/cycles')}
            >
              Abbrechen
            </Button>
          </div>

          {/* Progress Indicator (semantic, no hard blue/gray) */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
                <div
                  key={step}
                  className={`flex-1 h-1.5 rounded-full mx-0.5 transition-colors ${
                    step <= currentStep ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Schritt {currentStep} von {totalSteps}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {error && (
          <Card className="mb-6 border-destructive bg-destructive/5">
            <CardContent className="p-4">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-6">
            {currentStep === 1 && (
              <BasicInfoStep
                formData={formData}
                updateFormData={updateFormData}
                onNext={handleNext}
              />
            )}

            {currentStep === 2 && (
              <WorkoutDaysStep
                formData={formData}
                updateFormData={updateFormData}
                onNext={handleNext}
                onBack={handleBack}
              />
            )}

            {currentStep === 3 && (
              <BlueprintEditorStep
                formData={formData}
                updateFormData={updateFormData}
                currentDayIndex={currentDayIndex}
                setCurrentDayIndex={setCurrentDayIndex}
                onNext={handleNext}
                onBack={handleBack}
              />
            )}

            {currentStep === 4 && (
              <ReviewStep
                formData={formData}
                onBack={handleBack}
                onSubmit={handleSubmit}
                loading={loading}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
