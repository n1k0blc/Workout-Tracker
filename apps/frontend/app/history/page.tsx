'use client';

import { ProtectedRoute } from '@/components/protected-route';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { WorkoutListItem } from '@/types';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Badge } from '@/components/ui/badge';
import { GymTag } from '@/components/GymTag';
import {
  IconCalendar,
  IconClock,
  IconList,
} from '@tabler/icons-react';

type FilterType = '7days' | '30days' | '90days' | 'currentMonth' | 'currentYear' | 'custom';

export default function HistoryPage() {
  const [workouts, setWorkouts] = useState<WorkoutListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<FilterType>('30days');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const getDateRange = (): { startDate: string; endDate: string } => {
    const now = new Date();
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    let startDate: Date;

    switch (filterType) {
      case '7days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90days':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'currentMonth':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        break;
      case 'currentYear':
        startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          return {
            startDate: new Date(customStartDate).toISOString(),
            endDate: new Date(customEndDate + 'T23:59:59').toISOString(),
          };
        }
        // Fallback to 30 days if custom dates not set
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    startDate.setHours(0, 0, 0, 0);

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
  };

  const loadWorkouts = useCallback(async () => {
    if (filterType === 'custom' && (!customStartDate || !customEndDate)) {
      return;
    }

    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange();
      const data = await apiClient.getWorkoutHistory({
        startDate,
        endDate,
      });
      setWorkouts(data);
    } catch (error) {
      console.error('Failed to load workouts:', error);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, customStartDate, customEndDate]);

  useEffect(() => {
    loadWorkouts();
  }, [loadWorkouts]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')} min`;
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="space-y-6">
              {/* Header */}
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  Trainingsverlauf
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Übersicht deiner abgeschlossenen Workouts
                </p>
              </div>

              {/* Filters */}
              <div className="bg-card rounded-lg border p-6 space-y-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-3">
                    Zeitraum
                  </div>
                  <ToggleGroup
                    type="single"
                    value={filterType}
                    onValueChange={(value) => {
                      if (value) setFilterType(value as FilterType);
                    }}
                    className="flex flex-wrap gap-2"
                  >
                    <ToggleGroupItem value="7days" aria-label="Letzte 7 Tage">
                      Letzte 7 Tage
                    </ToggleGroupItem>
                    <ToggleGroupItem value="30days" aria-label="Letzte 30 Tage">
                      Letzte 30 Tage
                    </ToggleGroupItem>
                    <ToggleGroupItem value="90days" aria-label="Letzte 90 Tage">
                      Letzte 90 Tage
                    </ToggleGroupItem>
                    <ToggleGroupItem value="currentMonth" aria-label="Aktueller Monat">
                      Aktueller Monat
                    </ToggleGroupItem>
                    <ToggleGroupItem value="currentYear" aria-label="Aktuelles Jahr">
                      Aktuelles Jahr
                    </ToggleGroupItem>
                    <ToggleGroupItem value="custom" aria-label="Benutzerdefiniert">
                      Benutzerdefiniert
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>

                {/* Custom Date Range */}
                {filterType === 'custom' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                      <div className="text-sm font-medium text-muted-foreground mb-2">
                        Von
                      </div>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground mb-2">
                        Bis
                      </div>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-full"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Workouts List */}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-lg text-muted-foreground">Lädt Workouts...</div>
                </div>
              ) : workouts.length > 0 ? (
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground mb-2">
                    {workouts.length} Workout{workouts.length !== 1 ? 's' : ''} gefunden
                  </div>
                  {workouts.map((workout) => (
                    <div
                      key={workout.id}
                      className="block bg-card border rounded-lg p-6 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <Link href={`/history/${workout.id}`} className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-3 flex-wrap">
                            <h3 className="text-lg font-semibold text-foreground">
                              {workout.isFreeWorkout
                                ? workout.originTemplateName || 'Freies Workout'
                                : workout.workoutDayName || 'Workout'}
                            </h3>
                            {workout.cycleName && (
                              <Badge variant="secondary">{workout.cycleName}</Badge>
                            )}
                            <GymTag homeGym={workout.homeGym} />
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <IconCalendar className="size-4" />
                              <span>{formatDate(workout.date)}</span>
                            </div>
                            {workout.totalDuration && (
                              <div className="flex items-center gap-1.5">
                                <IconClock className="size-4" />
                                <span>{formatDuration(workout.totalDuration)}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5">
                              <IconList className="size-4" />
                              <span>
                                {workout.exerciseCount} Übung{workout.exerciseCount !== 1 ? 'en' : ''}
                              </span>
                            </div>
                          </div>
                        </Link>


                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-card border rounded-lg p-12 text-center">
                  <p className="text-muted-foreground">
                    Keine Workouts im ausgewählten Zeitraum gefunden
                  </p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
