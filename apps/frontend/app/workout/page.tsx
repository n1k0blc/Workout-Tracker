'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { useWorkout } from '@/lib/workout-context';
import { apiClient } from '@/lib/api';
import WorkoutStartScreen from '@/components/workout/start-screen';
import ActiveWorkoutScreen from '@/components/workout/active-workout-screen';
import { WorkoutCompletionModal } from '@/components/WorkoutCompletionModal';
import { Workout, PersonalRecord } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function WorkoutPage() {
  const router = useRouter();
  const { 
    activeWorkout, 
    loading, 
    pendingTemplateSave, 
    cancelTemplateSave, 
    completeTemplateSave,
    initTemplateSave,
    isPastWorkout 
  } = useWorkout();
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  
  // Completion modal state
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completedWorkout, setCompletedWorkout] = useState<Workout | null>(null);
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([]);
  const [saveAsTemplateAfterModal, setSaveAsTemplateAfterModal] = useState(false);

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
    } catch (error: unknown) {
      console.error('Failed to save template:', error);
      const err = error as { response?: { status?: number } };
      if (err.response?.status === 409) {
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

  // Handler for when workout is completed - called from ActiveWorkoutScreen
  const handleWorkoutComplete = async (workout: Workout, prs: PersonalRecord[], saveAsTemplate: boolean) => {
    setCompletedWorkout(workout);
    setPersonalRecords(prs);
    setSaveAsTemplateAfterModal(saveAsTemplate);
    setShowCompletionModal(true);
  };

  // Handler for when completion modal is closed
  const handleCompletionModalClose = () => {
    setShowCompletionModal(false);
    
    if (saveAsTemplateAfterModal && completedWorkout) {
      // Trigger template save flow
      initTemplateSave(completedWorkout.id);
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        {loading && !activeWorkout ? (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-lg text-muted-foreground">Lädt...</div>
          </div>
        ) : activeWorkout?.status === 'IN_PROGRESS' ? (
          <ActiveWorkoutScreen 
            mode={isPastWorkout ? 'edit' : 'active'} 
            onWorkoutComplete={handleWorkoutComplete} 
          />
        ) : (
          <WorkoutStartScreen />
        )}

        {/* Save Template Modal (shadcn) */}
        <Dialog 
          open={!!pendingTemplateSave} 
          onOpenChange={(open) => { 
            if (!open) handleSkipTemplate(); 
          }}
        >
          <DialogContent className="max-w-md [&>button]:hidden">
            <DialogHeader>
              <DialogTitle>Workout als Vorlage speichern</DialogTitle>
              <DialogDescription>
                Gib einen Namen für deine Workout-Vorlage ein. Diese Vorlage enthält
                alle Übungen mit deinen heutigen Werten.
              </DialogDescription>
            </DialogHeader>

            <Input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="z.B. Mein starkes Push Workout"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !savingTemplate) {
                  handleSaveAsTemplate();
                }
              }}
              autoFocus
            />

            <DialogFooter className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleSkipTemplate}
                disabled={savingTemplate}
                className="flex-1"
              >
                Überspringen
              </Button>
              <Button
                onClick={handleSaveAsTemplate}
                disabled={savingTemplate || !templateName.trim()}
                className="flex-1"
              >
                {savingTemplate ? 'Speichert...' : 'Speichern'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Workout Completion Modal (shadcn Dialog, controlled) */}
        <WorkoutCompletionModal
          open={showCompletionModal}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              handleCompletionModalClose();
            }
          }}
          workout={completedWorkout ?? undefined}
          personalRecords={personalRecords}
        />
      </div>
    </ProtectedRoute>
  );
}
