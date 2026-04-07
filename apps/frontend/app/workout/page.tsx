'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { useWorkout } from '@/lib/workout-context';
import { apiClient } from '@/lib/api';
import WorkoutStartScreen from '@/components/workout/start-screen';
import ActiveWorkoutScreen from '@/components/workout/active-workout-screen';
import { RestAlertModal } from '@/components/workout/rest-alert-modal';

export default function WorkoutPage() {
  const router = useRouter();
  const { activeWorkout, loading, pendingTemplateSave, cancelTemplateSave, completeTemplateSave } = useWorkout();
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim() || !pendingTemplateSave) {
      alert('Bitte gib einen Vorlagen-Namen ein');
      return;
    }

    setSavingTemplate(true);
    try {
      await apiClient.createWorkoutTemplateFromWorkout(pendingTemplateSave.workoutId, templateName.trim());
      alert('Vorlage erfolgreich erstellt!');
      setTemplateName('');
      completeTemplateSave();
      router.push('/dashboard');
    } catch (error: any) {
      console.error('Failed to save template:', error);
      if (error.response?.status === 409) {
        alert('Eine Vorlage mit diesem Namen existiert bereits');
      } else {
        alert('Fehler beim Speichern der Vorlage');
      }
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleSkipTemplate = () => {
    setTemplateName('');
    cancelTemplateSave();
    router.push('/dashboard');
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        {loading && !activeWorkout ? (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-lg text-gray-600">Lädt...</div>
          </div>
        ) : activeWorkout?.status === 'IN_PROGRESS' ? (
          <>
            <ActiveWorkoutScreen />
            <RestAlertModal />
          </>
        ) : (
          <WorkoutStartScreen />
        )}

        {/* Save Template Modal */}
        {pendingTemplateSave && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Workout als Vorlage speichern
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Gib einen Namen für deine Workout-Vorlage ein. Diese Vorlage enthält
                alle Übungen mit deinen heutigen Werten.
              </p>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="z.B. Mein starkes Push Workout"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !savingTemplate) {
                    handleSaveAsTemplate();
                  }
                }}
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  onClick={handleSkipTemplate}
                  disabled={savingTemplate}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 font-medium transition-colors disabled:opacity-50"
                >
                  Überspringen
                </button>
                <button
                  onClick={handleSaveAsTemplate}
                  disabled={savingTemplate || !templateName.trim()}
                  className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-medium transition-colors disabled:opacity-50"
                >
                  {savingTemplate ? 'Speichert...' : 'Speichern'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
