'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { SetType } from '@/types';
import BasicInfoStep from './basic-info-step';
import WorkoutDaysStep from './workout-days-step';
import BlueprintEditorStep from './blueprint-editor-step';
import ReviewStep from './review-step';

export interface BlueprintSetData {
  order: number;
  setType: SetType;
  reps: number;
  weight: number;
  rir: number;
  restAfterSet: number;
}

export interface WorkoutDayData {
  weekday: number;
  name: string;
  blueprint: {
    exercises: Array<{
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
          exercises: day.blueprint.exercises.map((ex) => ({
            exerciseId: ex.exerciseId,
            order: ex.order,
            sets: ex.sets,
          })),
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Neuer Trainingszyklus
              </h1>
              <p className="text-sm text-gray-600 mt-1">{getStepTitle()}</p>
            </div>
            <button
              onClick={() => router.push('/cycles')}
              className="text-gray-600 hover:text-gray-900"
            >
              Abbrechen
            </button>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
                <div
                  key={step}
                  className={`flex-1 ${step !== totalSteps ? 'mr-2' : ''}`}
                >
                  <div
                    className={`h-2 rounded-full ${
                      step <= currentStep ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>Schritt {currentStep} von {totalSteps}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

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
      </div>
    </div>
  );
}
