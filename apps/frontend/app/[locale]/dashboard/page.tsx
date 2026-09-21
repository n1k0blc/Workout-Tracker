'use client';

import { ProtectedRoute } from '@/components/protected-route';
import { Link, useRouter } from '@/i18n/navigation';
import { useState, useEffect } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { apiClient } from '@/lib/api';
import { useUnits } from '@/lib/use-units';
import { fromLocalDateString } from '@/lib/local-date';
import { weekdayReferenceDate } from '@/lib/weekday';
import {
  WorkoutListItem,
  PersonalRecord,
  DashboardStats,
  NextPlannedWorkout,
  CycleProgress,
  NutritionDay,
} from '@/types';
import CircularProgress from '@/components/CircularProgress';
import TrendIndicator from '@/components/TrendIndicator';
import { PersonalRecordCard } from '@/components/PersonalRecordCard';
import { NutritionTodayCard } from '@/components/nutrition/nutrition-today-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { IconBarbell, IconCalendar, IconChartBar, IconTrophy } from '@tabler/icons-react';

export default function DashboardPage() {
  const router = useRouter();
  const t = useTranslations('Dashboard');
  const units = useUnits();
  const format = useFormatter();
  const [weekStats, setWeekStats] = useState<DashboardStats | null>(null);
  const [cycleProgress, setCycleProgress] = useState<CycleProgress | null>(null);
  const [nextWorkout, setNextWorkout] = useState<NextPlannedWorkout | null>(null);
  const [weekWorkouts, setWeekWorkouts] = useState<WorkoutListItem[]>([]);
  const [prs, setPrs] = useState<PersonalRecord[]>([]);
  const [nutritionToday, setNutritionToday] = useState<NutritionDay | null>(null);
  const [loading, setLoading] = useState(true);
  
  // State for recently completed cycle
  const [showCycleCompletion, setShowCycleCompletion] = useState(false);
  const [completedCycle, setCompletedCycle] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        // Get Monday 00:00:00 of current week
        const getWeekStart = (): Date => {
          const d = new Date();
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1);
          const monday = new Date(d.setDate(diff));
          monday.setHours(0, 0, 0, 0);
          return monday;
        };

        // Get Sunday 23:59:59 of current week
        const getWeekEnd = (): Date => {
          const weekStart = getWeekStart();
          const sunday = new Date(weekStart);
          sunday.setDate(weekStart.getDate() + 6);
          sunday.setHours(23, 59, 59, 999);
          return sunday;
        };

        const weekStart = getWeekStart().toISOString();
        const weekEnd = getWeekEnd().toISOString();

        const [stats, progress, planned, workouts, records] = await Promise.all([
          apiClient.getCurrentWeekStats(),
          apiClient.getCycleProgress(),
          apiClient.getNextPlannedWorkout(),
          apiClient.getWorkoutHistory({ startDate: weekStart, endDate: weekEnd }),
          apiClient.getPersonalRecords(),
        ]);

        setWeekStats(stats);
        setCycleProgress(progress);
        setNextWorkout(planned);
        setWeekWorkouts(workouts);
        setPrs((records.recentPRs || []).slice(0, 3));
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  // Check for recently completed cycles
  useEffect(() => {
    const checkRecentlyCompletedCycle = async () => {
      try {
        const cycles = await apiClient.getCycles();
        const completedCycles = cycles
          .filter(c => c.status === 'COMPLETED' && c.completedAt)
          .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());
        
        if (completedCycles.length > 0) {
          const mostRecent = completedCycles[0];
          const daysSinceCompletion = 
            (Date.now() - new Date(mostRecent.completedAt!).getTime()) / (1000 * 60 * 60 * 24);
          
          const acknowledged = localStorage.getItem(`cycle-${mostRecent.id}-acknowledged`);
          
          // Show completion card if completed within last 7 days and not yet acknowledged
          if (daysSinceCompletion <= 7 && !acknowledged) {
            setCompletedCycle({ id: mostRecent.id, name: mostRecent.name });
            setShowCycleCompletion(true);
          }
        }
      } catch (error) {
        console.error('Failed to check for completed cycles:', error);
      }
    };

    checkRecentlyCompletedCycle();
  }, []);

  // Today's nutrition, for the "Ernährung heute" card. Loaded on its own so a nutrition
  // hiccup never blocks the rest of the dashboard; the card hides itself when no Tagesziele
  // are set (#152).
  useEffect(() => {
    apiClient
      .getNutritionDay()
      .then(setNutritionToday)
      .catch((error) => console.error('Failed to load nutrition day:', error));
  }, []);

  const formatDay = (date: Date) =>
    format.dateTime(date, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  const formatDate = (dateStr: string) => formatDay(new Date(dateStr));

  /** `suggestedDate` is a calendar day, not an instant -- parse it as one. */
  const formatLocalDate = (localDate: string) => formatDay(fromLocalDateString(localDate));

  const formatNumber = (num: number) => format.number(Math.round(num));

  const getDayName = (dayOfWeek: number): string =>
    format.dateTime(weekdayReferenceDate(dayOfWeek), { weekday: 'long', timeZone: 'UTC' });

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-lg text-muted-foreground">{t('loading')}</div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Stats Grid - 2x2 Layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Workouts der letzten 7 Tage */}
                  <Card>
                    <CardContent className="p-6">
                      <div className="text-sm font-medium text-muted-foreground mb-1">
                        {t('workoutsLast7Days')}
                      </div>
                      <div className="text-3xl font-bold text-foreground">
                        {weekStats?.lastSevenDays.workouts || 0}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Volumen der letzten 7 Tage mit Trend */}
                  <Card>
                    <CardContent className="p-6">
                      <div className="text-sm font-medium text-muted-foreground mb-1">
                        {t('volumeLast7Days')}
                      </div>
                      <div className="flex items-end gap-3">
                        <div className="text-3xl font-bold text-foreground">
                          {formatNumber(units.volume(weekStats?.lastSevenDays.volume || 0))}
                          <span className="text-lg text-muted-foreground ml-1">{units.unit}</span>
                        </div>
                        {weekStats && (
                          <div className="pb-1">
                            <TrendIndicator change={weekStats.volumeChange} />
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Zyklus-Fortschritt / Completion / No Cycle */}
                  <Card>
                    <CardContent className="p-6">
                      <div className="text-sm font-medium text-muted-foreground mb-3">
                        {t('cycleStatus')}
                      </div>

                      {/* Show cycle completion card if recently completed */}
                      {showCycleCompletion && completedCycle ? (
                        <div
                          onClick={() => {
                            localStorage.setItem(`cycle-${completedCycle.id}-acknowledged`, 'true');
                            router.push(`/cycles/${completedCycle.id}?celebration=true`);
                          }}
                          className="rounded-lg bg-primary text-primary-foreground p-6 cursor-pointer hover:opacity-90 transition-all"
                        >
                          <div className="text-center">
                            <IconTrophy className="size-12 mx-auto mb-3" stroke={1.5} />
                            <div className="text-sm font-medium mb-1 opacity-80">
                              {t('cycleCompleted')}
                            </div>
                            <div className="text-xl font-bold">
                              {completedCycle.name}
                            </div>
                            <div className="text-xs opacity-70 mt-2">
                              {t('clickForDetails')}
                            </div>
                          </div>
                        </div>
                      ) : cycleProgress ? (
                        /* Active cycle - show progress */
                        <div className="flex flex-col items-center">
                          <CircularProgress
                            current={cycleProgress.currentWeek}
                            total={cycleProgress.totalWeeks}
                            size={100}
                          />
                          <div className="text-sm text-muted-foreground mt-3 text-center">
                            {cycleProgress.cycleName}
                          </div>
                        </div>
                      ) : (
                        /* No active cycle - show placeholder */
                        <div className="text-center py-4">
                          <div className="text-muted-foreground mb-4 text-sm">
                            {t('noActiveCycle')}
                          </div>
                          <Button
                            onClick={() => router.push('/cycles/new')}
                            size="sm"
                          >
                            {t('createNewCycle')}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Durchschnittliche Workout-Dauer */}
                  <Card>
                    <CardContent className="p-6">
                      <div className="text-sm font-medium text-muted-foreground mb-1">
                        {t('avgDurationLast7Days')}
                      </div>
                      {weekStats?.lastSevenDays.averageDuration !== null ? (
                        <div className="text-3xl font-bold text-foreground">
                          {format.number(weekStats?.lastSevenDays.averageDuration || 0)}
                          <span className="text-lg text-muted-foreground ml-1">min</span>
                        </div>
                      ) : (
                        <div className="text-lg text-muted-foreground py-2">
                          {t('noData')}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Ernährung heute (#152) - only once Tagesziele are set */}
                {nutritionToday?.targets && (
                  <NutritionTodayCard
                    totals={nutritionToday.totals}
                    targets={nutritionToday.targets}
                  />
                )}

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Link href="/workout" className="block">
                    <Card className="h-full hover:shadow-md transition-shadow bg-primary text-primary-foreground">
                      <CardContent className="p-6">
                        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                          <IconBarbell className="size-5" />
                          {t('startWorkout')}
                        </h3>
                        <p className="opacity-80 text-sm">
                          {t('startNewWorkout')}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>

                  <Link href="/cycles" className="block">
                    <Card className="h-full hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                          <IconCalendar className="size-5" />
                          {t('manageCycles')}
                        </h3>
                        <p className="text-muted-foreground text-sm">
                          {t('createTrainingCycles')}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>

                  <Link href="/analytics" className="block">
                    <Card className="h-full hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                          <IconChartBar className="size-5" />
                          {t('analytics')}
                        </h3>
                        <p className="text-muted-foreground text-sm">
                          {t('analyzeTrainingProgress')}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                </div>

                {/* Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Workouts dieser Woche (Liste) */}
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('workoutsThisWeek')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {weekWorkouts.length > 0 ? (
                        <div className="divide-y border">
                          {weekWorkouts.map((workout) => (
                            <div
                              key={workout.id}
                              onClick={() => router.push(`/history/${workout.id}`)}
                              className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer"
                            >
                              <div>
                                <div className="font-medium">
                                  {workout.workoutDayName || workout.originTemplateName || t('freeWorkout')}
                                </div>
                                <div className="text-sm text-muted-foreground mt-1">
                                  {formatDate(workout.date)}
                                  {workout.cycleName && ` · ${workout.cycleName}`}
                                </div>
                              </div>
                              <Badge variant="secondary">
                                {t('exerciseCount', { count: workout.exerciseCount })}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-center py-8">
                          {t('noWorkoutsThisWeek')}
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Nächstes geplantes Workout */}
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('nextPlannedWorkout')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {nextWorkout ? (
                        <div className="border bg-card p-6">
                          <div className="text-center">
                            <div className="text-2xl font-bold mb-2">
                              {nextWorkout.workoutDayName}
                            </div>
                            <div className="text-sm text-muted-foreground mb-1">
                              {nextWorkout.cycleName}
                            </div>
                            {nextWorkout.templateName && (
                              <div className="text-sm text-muted-foreground mb-3">
                                {nextWorkout.templateName}
                              </div>
                            )}
                            {nextWorkout.cycleStartDate && (
                              <Badge variant="secondary" className="mb-2">
                                {t('cycleStartsOn', { date: formatLocalDate(nextWorkout.cycleStartDate) })}
                              </Badge>
                            )}
                            <div className="mt-4 pt-4 border-t">
                              <div className="text-lg font-semibold text-primary">
                                {getDayName(nextWorkout.dayOfWeek)}
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">
                                {formatLocalDate(nextWorkout.suggestedDate)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed p-8 text-center">
                          <div className="text-muted-foreground mb-2">
                            {t('noActiveCycle')}
                          </div>
                          <Link
                            href="/cycles"
                            className="inline-block text-sm text-primary hover:underline font-medium"
                          >
                            {t('createCycleArrow')}
                          </Link>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Personal Records */}
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle>{t('personalRecords')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {prs.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {prs.map((pr) => (
                            <PersonalRecordCard
                              key={`${pr.exerciseId}-${pr.type}`}
                              pr={pr}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-center py-8">
                          {t('noPersonalRecords')}
                        </p>
                      )}
                      <Link
                        href="/analytics"
                        className="block mt-4 text-center text-sm text-primary hover:underline font-medium"
                      >
                        {t('viewAllPersonalRecords')}
                      </Link>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
