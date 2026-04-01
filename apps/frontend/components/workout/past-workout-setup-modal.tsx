'use client';

import { useState } from 'react';

interface PastWorkoutSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartFree: (date: string, durationMinutes: number) => void;
  onStartCycle: (date: string, durationMinutes: number) => void;
}

export default function PastWorkoutSetupModal({
  isOpen,
  onClose,
  onStartFree,
  onStartCycle,
}: PastWorkoutSetupModalProps) {
  const [step, setStep] = useState<'type' | 'details'>('type');
  const [workoutType, setWorkoutType] = useState<'free' | 'cycle' | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [durationMinutes, setDurationMinutes] = useState(60);

  if (!isOpen) return null;

  const handleTypeSelection = (type: 'free' | 'cycle') => {
    setWorkoutType(type);
    setStep('details');
  };

  const handleBack = () => {
    setStep('type');
  };

  const handleConfirm = () => {
    if (!workoutType) return;

    if (workoutType === 'free') {
      onStartFree(date, durationMinutes);
    } else {
      onStartCycle(date, durationMinutes);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {step === 'type' ? (
          <>
            <h2 className="text-2xl font-bold mb-2 text-center">
              Vergangenes Workout tracken
            </h2>
            <p className="text-gray-600 text-center mb-6">
              Wähle den Workout-Typ aus
            </p>

            <div className="space-y-4">
              <button
                onClick={() => handleTypeSelection('free')}
                className="w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold py-6 px-6 rounded-lg transition-colors flex flex-col items-center gap-2 text-lg"
              >
                <span className="text-3xl">💪</span>
                <span>Freies Workout</span>
              </button>

              <button
                onClick={() => handleTypeSelection('cycle')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-6 px-6 rounded-lg transition-colors flex flex-col items-center gap-2 text-lg"
              >
                <span className="text-3xl">📋</span>
                <span>Zyklus-Workout</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              onClick={handleBack}
              className="mb-4 text-gray-600 hover:text-gray-900 flex items-center gap-1 text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Zurück
            </button>

            <h2 className="text-2xl font-bold mb-2">
              Workout-Details
            </h2>
            <p className="text-gray-600 mb-6">
              {workoutType === 'free' ? 'Freies Workout' : 'Zyklus-Workout'}
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Workout-Datum
                </label>
                <input
                  type="date"
                  value={date}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Workout-Dauer (Minuten)
                </label>
                <input
                  type="number"
                  min="1"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <button
              onClick={handleConfirm}
              disabled={!date || durationMinutes <= 0}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Weiter zum Gym auswählen
            </button>
          </>
        )}
      </div>
    </div>
  );
}
