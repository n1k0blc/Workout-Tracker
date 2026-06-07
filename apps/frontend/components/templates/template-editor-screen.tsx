'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { Exercise, HomeGym, Workout, WorkoutStatus, SetType, PlannedSet, WorkoutTemplateExercise } from '@/types';
import { ProtectedRoute } from '@/components/protected-route';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Field, FieldLabel } from '@/components/ui/field';
import ActiveWorkoutScreen from '@/components/workout/active-workout-screen';
import { useWorkout } from '@/lib/workout-context';
import { IconChevronLeft } from '@tabler/icons-react';

interface TemplateEditorScreenProps {
  templateId?: string;
}

export default function TemplateEditorScreen({ templateId }: TemplateEditorScreenProps) {
  const router = useRouter();
  const { setActiveWorkoutDirectly, activeWorkout } = useWorkout();

  const [name, setName] = useState('');
  const [recommendedGymId, setRecommendedGymId] = useState<string>('');
  const [availableGyms, setAvailableGyms] = useState<HomeGym[]>([]);
  const [loading, setLoading] = useState(!!templateId);
  const [saving, setSaving] = useState(false);

  // Helper: map a template's target sets into PlannedSet shape for the synthetic workout
  // (input from template model or our synthetic; documented as Technical Debt bridge to shared component)
  const mapTemplateSetsToPlanned = (sets: unknown[]): PlannedSet[] => {
    return (sets || []).map((s, idx) => {
      const raw = s as any; // eslint-disable-line @typescript-eslint/no-explicit-any -- narrow inside bridge helper
      return {
        id: raw.id || `planned-${Date.now()}-${idx}`,
        order: raw.order || idx + 1,
        setType: (raw.isWarmup ? SetType.WARMUP : SetType.WORKING) as SetType,
        reps: raw.targetReps ?? 0,
        weight: raw.targetWeight ?? 0,
        rir: raw.targetRir ?? 0,
        restAfterSet: 0,
      };
    });
  };

  // Build a synthetic Workout-shaped object so the shared edit component + context can be used.
  // We use status COMPLETED to reuse the existing local-only mutation hack (no real API calls for mutations).
  // Pass the current available list explicitly for unilateral/double-weight enrichment (avoids stale state).
  const buildSyntheticWorkout = (
    templateExercises: WorkoutTemplateExercise[] | undefined,
    idForTemplate?: string,
    currentAvailable: Exercise[] = []
  ): Workout => {
    const now = new Date().toISOString();
    const exs = (templateExercises || []).map((ex, idx) => {
      const details = currentAvailable.find((e) => e.id === ex.exerciseId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- bridge (see Technical Debt in plan for completed/template edit via shared component)
      const raw = ex as any;
      const templateSetsForEx = raw.sets || [];

      // Keep sets: [] (only populate plannedSets) for template synthetics.
      // This way the card treats rows as unlogged planned slots:
      // - replace button not disabled (guard is sets.length > 0)
      // - swipe RTL delete allowed (only for !logged)
      // Save validation + payload already support plannedSets as source for templates.
      // (We previously pre-populated sets to satisfy old strict validation, but that
      // activated the "logged sets are immutable" guards in the card, breaking delete/replace.)
      return {
        id: raw.id || `ex-${Date.now()}-${idx}`,
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName || '',
        isUnilateral: details?.isUnilateral,
        isDoubleWeight: details?.isDoubleWeight,
        order: ex.order || idx + 1,
        sets: [],
        plannedSets: mapTemplateSetsToPlanned(templateSetsForEx),
      };
    });

    return {
      id: idForTemplate ? `template-${idForTemplate}` : `new-template-${Date.now()}`,
      date: now,
      status: WorkoutStatus.COMPLETED,   // still used for the local-mutation short-circuit (see debt)
      isFreeWorkout: true,
      // Clean flag for the shared component + card to know this is a pure plan/blueprint edit
      // (not a performed session). This replaces scattered ID-prefix checks.
      blueprintEdit: true,
      exercises: exs,
      createdAt: now,
    } as any;  // blueprintEdit is extension for edit mode
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [gyms, fetchedExercises] = await Promise.all([
        apiClient.getHomeGyms(),
        apiClient.getExercises(),
      ]);
      setAvailableGyms(gyms);

      let synthetic: Workout | null = null;

      if (templateId) {
        const template = await apiClient.getWorkoutTemplate(templateId);
        setName(template.name);
        setRecommendedGymId(template.recommendedGymId || '');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- API response normalization for template exercises (pre-existing pattern)
        const fixedExercises = (template.exercises || []).map((ex: any, idx: number) => ({
          ...ex,
          order: ex.order === 0 ? idx + 1 : ex.order,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          sets: (ex.sets || []).map((set: any, setIdx: number) => ({
            ...set,
            order: set.order === 0 ? setIdx + 1 : set.order,
          })),
        }));

        synthetic = buildSyntheticWorkout(fixedExercises, templateId, fetchedExercises);
      } else {
        // New template: start empty
        setName('');
        setRecommendedGymId('');
        synthetic = buildSyntheticWorkout([], undefined, fetchedExercises);
      }

      if (synthetic) {
        setActiveWorkoutDirectly(synthetic);
      }
    } catch (error) {
      console.error('Failed to load data for template editor:', error);
      alert('Fehler beim Laden der Daten.');
      router.push('/templates');
    } finally {
      setLoading(false);
    }
  }, [templateId, router, setActiveWorkoutDirectly]); // eslint-disable-line react-hooks/exhaustive-deps -- buildSyntheticWorkout is pure and defined in render; we intentionally call load once on mount/param change

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Cleanup: clear the hijacked synthetic workout when leaving the editor
  // to avoid leaving a fake COMPLETED entry in the global context.
  useEffect(() => {
    return () => {
      // Setting to a null-like value; startWorkout or other flows will overwrite when needed.
      // Cast to satisfy the typed setter for the synthetic case.
      setActiveWorkoutDirectly(null as unknown as Workout);
    };
  }, [setActiveWorkoutDirectly]);

  // No more local exercise list handlers – the shared ActiveWorkoutScreen (edit mode)
  // + WorkoutContext (with COMPLETED local-mutation short-circuit) own the full
  // add/remove/replace/reorder/add-set/edit-set surface.

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Bitte gib einen Namen für die Vorlage ein.');
      return;
    }

    const current = activeWorkout;
    if (!current || current.exercises.length === 0) {
      alert('Bitte füge mindestens eine Übung hinzu.');
      return;
    }

    // Validate every exercise has at least one set (template requirement).
    // We check both .sets (performed, pre-populated for loaded templates or added via UI)
    // and .plannedSets (fallback for the synthetic bridge). This is defensive because
    // the shared component's edit-mode auto-commit (from plannedSets -> sets) uses
    // setTimeout + a w>0/r>0 guard that doesn't always fire immediately for template data.
    const hasEmpty = current.exercises.some((ex) => {
      const committed = ex.sets?.length || 0;
      const planned = ex.plannedSets?.length || 0;
      return committed === 0 && planned === 0;
    });
    if (hasEmpty) {
      alert('Jede Übung muss mindestens einen Satz haben.');
      return;
    }

    setSaving(true);
    try {
      const payloadExercises = current.exercises.map((ex) => {
        // Prefer the committed performed sets (populated by edit-mode commit + user edits).
        // Fallback to plannedSets (should not be needed after the mount effect in edit mode).
        const sourceSets = (ex.sets && ex.sets.length > 0) ? ex.sets : (ex.plannedSets || []);
        return {
          exerciseId: ex.exerciseId,
          order: ex.order,
          sets: sourceSets.map((s, idx) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mapping performed/planned (shared) back to template targets (debt bridge)
            const rawSet = s as any;
            return {
              order: rawSet.order || rawSet.setNumber || idx + 1,
              isWarmup: rawSet.setType === SetType.WARMUP || rawSet.isWarmup === true,
              targetReps: rawSet.reps ?? rawSet.targetReps ?? 0,
              targetWeight: rawSet.weight ?? rawSet.targetWeight ?? 0,
              targetRir: rawSet.rir ?? rawSet.targetRir ?? 0,
            };
          }),
        };
      });

      const payload = {
        name: name.trim(),
        recommendedGymId: recommendedGymId || undefined,
        exercises: payloadExercises,
      };

      if (templateId) {
        await apiClient.updateWorkoutTemplate(templateId, payload);
      } else {
        await apiClient.createWorkoutTemplate(payload);
      }

      // Clear synthetic before navigating away (defense in depth)
      setActiveWorkoutDirectly(null as unknown as Workout);
      router.push('/templates');
    } catch (error) {
      console.error('Failed to save template:', error);
      alert('Fehler beim Speichern der Vorlage.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-lg text-muted-foreground">Lädt Vorlage...</div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0 space-y-6">
            {/* Back Button */}
            <Button
              variant="ghost"
              onClick={() => router.push('/templates')}
              className="flex items-center gap-2 -ml-2"
            >
              <IconChevronLeft className="size-4" />
              Zurück zu den Vorlagen
            </Button>

            {/* Header */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">
                      {templateId ? 'Vorlage bearbeiten' : 'Neue Vorlage erstellen'}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Definiere Übungen und Sätze für diese Workout-Vorlage
                    </p>
                  </div>
                  <Badge variant="outline">{templateId ? 'Bearbeitung' : 'Neu'}</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Template Metadata (Name + Recommended Gym) */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <Field>
                  <FieldLabel>Vorlagenname</FieldLabel>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="z.B. Upper Body, Push Day, etc."
                    className="w-full"
                  />
                </Field>

                <Field>
                  <FieldLabel>Empfohlenes Studio (Optional)</FieldLabel>
                  <select
                    value={recommendedGymId}
                    onChange={(e) => setRecommendedGymId(e.target.value)}
                    className="w-full md:w-auto px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                  >
                    <option value="">Kein empfohlenes Studio</option>
                    {availableGyms.map((gym) => (
                      <option key={gym.id} value={gym.id}>
                        {gym.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </CardContent>
            </Card>

            {/* Exercises – using the central shared component in edit mode.
                No inner header here, the template editor wrapper provides "Vorlage bearbeiten" + metadata. */}
            <ActiveWorkoutScreen
              mode="edit"
              showBottomBar={false}
              showHeader={false}
            />

            {/* Save / Cancel Actions (own buttons like in history edit) */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setActiveWorkoutDirectly(null as unknown as Workout);
                  router.push('/templates');
                }}
                disabled={saving}
                className="flex-1"
              >
                Abbrechen
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !activeWorkout}
                className="flex-1"
              >
                {saving ? 'Speichert...' : 'Speichern'}
              </Button>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
