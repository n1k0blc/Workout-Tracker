'use client';

import { ProtectedRoute } from '@/components/protected-route';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { WorkoutCycle } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  IconPlus,
  IconTrash,
  IconCheck,
  IconChevronRight,
} from '@tabler/icons-react';

export default function CyclesPage() {
  const router = useRouter();
  const [cycles, setCycles] = useState<WorkoutCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [completeConfirm, setCompleteConfirm] = useState<string | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [creatingNew, setCreatingNew] = useState(false);

  useEffect(() => {
    loadCycles();
  }, []);

  const loadCycles = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getCycles();
      setCycles(data);
    } catch (error) {
      console.error('Failed to load cycles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewCycle = async () => {
    setCreatingNew(true);
    try {
      const data = await apiClient.getCycles();
      const hasActiveCycle = data.some((c) => c.status === 'ACTIVE');
      
      if (hasActiveCycle) {
        alert('Es existiert bereits ein aktiver Zyklus. Bitte beende diesen zuerst.');
      } else {
        router.push('/cycles/new');
      }
    } catch (error) {
      console.error('Failed to check active cycles:', error);
      alert('Fehler beim Prüfen der aktiven Zyklen');
    } finally {
      setCreatingNew(false);
    }
  };

  const handleCompleteCycle = async (cycleId: string) => {
    setCompleting(cycleId);
    try {
      await apiClient.completeCycle(cycleId);
      await loadCycles();
      setCompleteConfirm(null);
    } catch (error) {
      console.error('Failed to complete cycle:', error);
      alert('Fehler beim Beenden des Zyklus');
    } finally {
      setCompleting(null);
    }
  };
  const handleDeleteCycle = async (cycleId: string) => {
    setDeleting(true);
    try {
      await apiClient.deleteCycle(cycleId);
      setCycles(cycles.filter((c) => c.id !== cycleId));
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to delete cycle:', error);
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  };

  const getWeekday = (weekday: number): string => {
    const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    return days[weekday];
  };

  const activeCycles = cycles.filter((c) => c.status === 'ACTIVE');
  const completedCycles = cycles.filter((c) => c.status === 'COMPLETED');

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">
                    Trainingszyklen
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Verwalte deine Trainingszyklen und Blueprints
                  </p>
                </div>
                <Button
                  onClick={handleCreateNewCycle}
                  disabled={creatingNew}
                >
                  <IconPlus className="mr-2 size-4" />
                  {creatingNew ? 'Prüfe...' : 'Neuer Zyklus'}
                </Button>
              </div>

              {/* Cycles List */}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-lg text-muted-foreground">Lädt Zyklen...</div>
                </div>
              ) : cycles.length > 0 ? (
                <div className="space-y-6">
                  {/* Active Cycles */}
                  {activeCycles.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-foreground">
                        Aktive Zyklen
                      </h3>
                      {activeCycles.map((cycle) => (
                        <Card
                          key={cycle.id}
                          className="cursor-pointer hover:shadow-sm transition-shadow"
                          onClick={() => router.push(`/cycles/${cycle.id}`)}
                        >
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3">
                                  <h3 className="text-lg font-semibold text-foreground">
                                    {cycle.name}
                                  </h3>
                                  <Badge variant="default">Aktiv</Badge>
                                </div>
                                <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                                  <span>{cycle.duration} Wochen</span>
                                  <span>•</span>
                                  <span>Start: {formatDate(cycle.startDate)}</span>
                                  <span>•</span>
                                  <span>{cycle.workoutDays.length} Trainingstage</span>
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCompleteConfirm(cycle.id);
                                  }}
                                  disabled={completing === cycle.id}
                                  className="hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950"
                                  title="Zyklus beenden"
                                  aria-label="Zyklus beenden"
                                >
                                  <IconCheck className="size-5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteConfirm(cycle.id);
                                  }}
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  title="Zyklus löschen"
                                  aria-label="Zyklus löschen"
                                >
                                  <IconTrash className="size-5" />
                                </Button>
                              </div>
                            </div>

                            {/* Workout Days - quick access to blueprint editor (shadcn cards) */}
                            {cycle.workoutDays.length > 0 && (
                              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                                {cycle.workoutDays.map((day) => (
                                  <div
                                    key={day.id}
                                    onClick={(e) => {
                                      if (day.blueprint) {
                                        e.stopPropagation();
                                        router.push(`/cycles/${cycle.id}/edit/${day.id}`);
                                      }
                                    }}
                                    className={`rounded-lg border border-border p-3 ${day.blueprint ? 'bg-card cursor-pointer hover:bg-accent active:bg-accent/80 transition-colors' : 'bg-muted/30'}`}
                                  >
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-xs font-semibold text-muted-foreground">
                                        {getWeekday(day.weekday)}
                                      </span>
                                      <span className="text-sm font-medium text-foreground">
                                        {day.name}
                                      </span>
                                    </div>
                                    {day.blueprint && (
                                      <div className="flex items-center justify-between">
                                        <div className="text-xs text-muted-foreground">
                                          {day.blueprint.exercises.length} Übungen
                                        </div>
                                        <IconChevronRight className="size-4 text-muted-foreground" />
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* Completed Cycles */}
                  {completedCycles.length > 0 && (
                    <div className="space-y-4">
                      <button
                        onClick={() => setShowCompleted(!showCompleted)}
                        className="flex items-center gap-2 text-lg font-semibold text-foreground hover:text-muted-foreground"
                      >
                        <IconChevronRight
                          className={`size-5 transition-transform ${showCompleted ? 'rotate-90' : ''}`}
                        />
                        Abgeschlossene Zyklen ({completedCycles.length})
                      </button>

                      {showCompleted && (
                        <div className="space-y-4">
                          {completedCycles.map((cycle) => (
                            <Card
                              key={cycle.id}
                              className="opacity-75 cursor-pointer hover:opacity-100 hover:shadow-sm transition-all"
                              onClick={() => router.push(`/cycles/${cycle.id}`)}
                            >
                              <CardContent className="p-6">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3">
                                      <h3 className="text-lg font-semibold text-foreground">
                                        {cycle.name}
                                      </h3>
                                      <Badge variant="secondary">Abgeschlossen</Badge>
                                    </div>
                                    <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                                      <span>{cycle.duration} Wochen</span>
                                      <span>•</span>
                                      <span>Start: {formatDate(cycle.startDate)}</span>
                                      {cycle.completedAt && (
                                        <>
                                          <span>•</span>
                                          <span>
                                            Beendet: {formatDate(cycle.completedAt)}
                                          </span>
                                        </>
                                      )}
                                      <span>•</span>
                                      <span>
                                        {cycle.workoutDays.length} Trainingstage
                                      </span>
                                    </div>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteConfirm(cycle.id);
                                    }}
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    title="Zyklus löschen"
                                    aria-label="Zyklus löschen"
                                  >
                                    <IconTrash className="size-5" />
                                  </Button>
                                </div>

                                {/* Workout Days (read-only preview for completed) */}
                                {cycle.workoutDays.length > 0 && (
                                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {cycle.workoutDays.map((day) => (
                                      <div
                                        key={day.id}
                                        className="rounded-lg border border-border bg-muted/30 p-3"
                                      >
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="text-xs font-semibold text-muted-foreground">
                                            {getWeekday(day.weekday)}
                                          </span>
                                          <span className="text-sm font-medium text-foreground">
                                            {day.name}
                                          </span>
                                        </div>
                                        {day.blueprint && (
                                          <div className="text-xs text-muted-foreground">
                                            {day.blueprint.exercises.length} Übungen
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-12 text-center">
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      Noch keine Zyklen vorhanden
                    </h3>
                    <p className="text-muted-foreground mb-6">
                      Erstelle deinen ersten Trainingszyklus, um strukturiert zu
                      trainieren.
                    </p>
                    <Button
                      onClick={handleCreateNewCycle}
                      disabled={creatingNew}
                      size="lg"
                    >
                      <IconPlus className="mr-2 size-4" />
                      Zyklus erstellen
                    </Button>
                  </CardContent>
                </Card>
              )}

            </div>
          </div>
        </main>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Zyklus löschen?</AlertDialogTitle>
              <AlertDialogDescription>
                Bist du sicher, dass du diesen Zyklus löschen möchtest? Diese Aktion kann nicht rückgängig gemacht werden.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>
                Abbrechen
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteConfirm && handleDeleteCycle(deleteConfirm)}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? 'Wird gelöscht...' : 'Löschen'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Complete Confirmation Dialog */}
        <AlertDialog open={!!completeConfirm} onOpenChange={(open) => !open && setCompleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Zyklus vorzeitig beenden?</AlertDialogTitle>
              <AlertDialogDescription>
                Möchtest du diesen Zyklus wirklich vorzeitig beenden? Der Zyklus wird als abgeschlossen markiert.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={completing === completeConfirm}>
                Abbrechen
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => completeConfirm && handleCompleteCycle(completeConfirm)}
                disabled={completing === completeConfirm}
              >
                {completing === completeConfirm ? 'Beende...' : 'Beenden'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ProtectedRoute>
  );
}
