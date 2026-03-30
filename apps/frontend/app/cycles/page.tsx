'use client';

import { ProtectedRoute } from '@/components/protected-route';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { WorkoutCycle } from '@/types';

export default function CyclesPage() {
  const { user, logout } = useAuth();
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

  const handleLogout = () => {
    logout();
    router.push('/login');
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
      <div className="min-h-screen bg-gray-50">
        {/* Navigation */}
        <nav className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <div className="flex-shrink-0 flex items-center">
                  <h1 className="text-xl font-bold text-gray-900">
                    Workout Tracker
                  </h1>
                </div>
                <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                  <Link
                    href="/dashboard"
                    className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/workout"
                    className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Workout
                  </Link>
                  <Link
                    href="/cycles"
                    className="border-blue-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Zyklen
                  </Link>
                  <Link
                    href="/exercises"
                    className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Übungen
                  </Link>
                  <Link
                    href="/history"
                    className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Verlauf
                  </Link>
                  <Link
                    href="/analytics"
                    className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Analytics
                  </Link>
                </div>
              </div>
              <div className="flex items-center">
                <span className="text-sm text-gray-700 mr-4">{user?.email}</span>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Abmelden
                </button>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Trainingszyklen
                  </h2>
                  <p className="mt-1 text-sm text-gray-600">
                    Verwalte deine Trainingszyklen und Blueprints
                  </p>
                </div>
                <button
                  onClick={handleCreateNewCycle}
                  disabled={creatingNew}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {creatingNew ? 'Prüfe...' : '+ Neuer Zyklus'}
                </button>
              </div>

              {/* Cycles List */}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-lg text-gray-600">Lädt Zyklen...</div>
                </div>
              ) : cycles.length > 0 ? (
                <div className="space-y-6">
                  {/* Active Cycles */}
                  {activeCycles.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Aktive Zyklen
                      </h3>
                      {activeCycles.map((cycle) => (
                        <div
                          key={cycle.id}
                          className="bg-white rounded-lg shadow overflow-hidden"
                        >
                          <div className="p-6">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3">
                                  <h3 className="text-lg font-semibold text-gray-900">
                                    {cycle.name}
                                  </h3>
                                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">
                                    Aktiv
                                  </span>
                                </div>
                                <div className="mt-2 flex items-center gap-4 text-sm text-gray-600">
                                  <span>{cycle.duration} Wochen</span>
                                  <span>•</span>
                                  <span>Start: {formatDate(cycle.startDate)}</span>
                                  <span>•</span>
                                  <span>{cycle.workoutDays.length} Trainingstage</span>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setCompleteConfirm(cycle.id)}
                                  disabled={completing === cycle.id}
                                  className="px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
                                >
                                  {completing === cycle.id ? 'Beende...' : 'Beenden'}
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(cycle.id)}
                                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                                >
                                  Löschen
                                </button>
                              </div>
                            </div>

                            {/* Workout Days */}
                            {cycle.workoutDays.length > 0 && (
                              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                                {cycle.workoutDays.map((day) => (
                                  <div
                                    key={day.id}
                                    className="border border-gray-200 rounded-lg p-3 relative"
                                  >
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-xs font-semibold text-gray-500">
                                        {getWeekday(day.weekday)}
                                      </span>
                                      <span className="text-sm font-medium text-gray-900">
                                        {day.name}
                                      </span>
                                    </div>
                                    {day.blueprint && (
                                      <div className="flex items-center justify-between">
                                        <div className="text-xs text-gray-600">
                                          {day.blueprint.exercises.length} Übungen
                                        </div>
                                        <Link
                                          href={`/cycles/${cycle.id}/edit/${day.id}`}
                                          className="text-blue-600 hover:text-blue-800"
                                        >
                                          <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="h-4 w-4"
                                            viewBox="0 0 20 20"
                                            fill="currentColor"
                                          >
                                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                          </svg>
                                        </Link>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Completed Cycles */}
                  {completedCycles.length > 0 && (
                    <div className="space-y-4">
                      <button
                        onClick={() => setShowCompleted(!showCompleted)}
                        className="flex items-center gap-2 text-lg font-semibold text-gray-900 hover:text-gray-700"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className={`h-5 w-5 transition-transform ${
                            showCompleted ? 'rotate-90' : ''
                          }`}
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Abgeschlossene Zyklen ({completedCycles.length})
                      </button>

                      {showCompleted && (
                        <div className="space-y-4">
                          {completedCycles.map((cycle) => (
                            <div
                              key={cycle.id}
                              className="bg-white rounded-lg shadow overflow-hidden opacity-75"
                            >
                              <div className="p-6">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3">
                                      <h3 className="text-lg font-semibold text-gray-900">
                                        {cycle.name}
                                      </h3>
                                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded">
                                        Abgeschlossen
                                      </span>
                                    </div>
                                    <div className="mt-2 flex items-center gap-4 text-sm text-gray-600">
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
                                  <button
                                    onClick={() => setDeleteConfirm(cycle.id)}
                                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                                  >
                                    Löschen
                                  </button>
                                </div>

                                {/* Workout Days */}
                                {cycle.workoutDays.length > 0 && (
                                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {cycle.workoutDays.map((day) => (
                                      <div
                                        key={day.id}
                                        className="border border-gray-200 rounded-lg p-3"
                                      >
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="text-xs font-semibold text-gray-500">
                                            {getWeekday(day.weekday)}
                                          </span>
                                          <span className="text-sm font-medium text-gray-900">
                                            {day.name}
                                          </span>
                                        </div>
                                        {day.blueprint && (
                                          <div className="text-xs text-gray-600">
                                            {day.blueprint.exercises.length} Übungen
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow p-12 text-center">
                  <div className="text-6xl mb-4">📅</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Noch keine Zyklen vorhanden
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Erstelle deinen ersten Trainingszyklus, um strukturiert zu
                    trainieren.
                  </p>
                  <button
                    onClick={handleCreateNewCycle}
                    disabled={creatingNew}
                    className="inline-flex items-center px-6 py-3 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {creatingNew ? 'Prüfe...' : '+ Zyklus erstellen'}
                  </button>
                </div>
              )}

            </div>
          </div>
        </main>

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Zyklus löschen?
              </h3>
              <p className="text-gray-600 mb-6">
                Bist du sicher, dass du diesen Zyklus löschen möchtest? Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Abbrechen
                </button>
                <button
                  onClick={() => handleDeleteCycle(deleteConfirm)}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? 'Wird gelöscht...' : 'Löschen'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Complete Confirmation Modal */}
        {completeConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Zyklus vorzeitig beenden?
              </h3>
              <p className="text-gray-600 mb-6">
                Möchtest du diesen Zyklus wirklich vorzeitig beenden? Der Zyklus wird als abgeschlossen markiert.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setCompleteConfirm(null)}
                  disabled={completing === completeConfirm}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Abbrechen
                </button>
                <button
                  onClick={() => handleCompleteCycle(completeConfirm)}
                  disabled={completing === completeConfirm}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {completing === completeConfirm ? 'Beende...' : 'Beenden'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
