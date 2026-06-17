'use client';

import { ProtectedRoute } from '@/components/protected-route';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { MUSCLE_GROUP_LABELS } from '@/lib/exercise-utils';
import { 
  CycleDetails, 
  PersonalRecord, 
  WorkoutListItem,
  MuscleGroup,
  Equipment,
  HomeGym,
  VolumeAnalytics,
  ORMByCycleAnalytics,
  RIRByCycleAnalytics,
  DurationByCycleAnalytics,
  RestTimeByCycleAnalytics,
  RepsByCycleAnalytics,
  SetsByCycleAnalytics,
  Exercise,
} from '@/types';
import ExerciseSelectionModal from '@/components/workout/exercise-selection-modal';
import SelectedExerciseCard from '@/components/analytics/selected-exercise-card';
import {
  CHART_ACCENT,
  getRIRBarFill,
} from '@/components/analytics/chart-styles';
import AnalyticsChart from '@/components/analytics/AnalyticsChart';
import { formatNumber, formatDate } from '@/components/analytics/chart-utils';
import { PersonalRecordCard } from '@/components/PersonalRecordCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  IconPlus, 
  IconClock, 
  IconChevronRight,
  IconArrowLeft,
  IconCalendar,
  IconBarbell,
  IconTrendingUp,
  IconTrophy,
  IconMapPin,
} from '@tabler/icons-react';
import Confetti from 'react-confetti';
import CircularProgress from '@/components/CircularProgress';
import { Bar } from 'recharts';

export default function CycleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const cycleId = params.id as string;
  const showCelebration = searchParams.get('celebration') === 'true';

  const [cycleDetails, setCycleDetails] = useState<CycleDetails | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutListItem[]>([]);
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(showCelebration);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  // Analytics state
  const [homeGyms, setHomeGyms] = useState<HomeGym[]>([]);
  const [volumeData, setVolumeData] = useState<VolumeAnalytics | null>(null);
  const [ormData, setOrmData] = useState<ORMByCycleAnalytics | null>(null);
  const [rirData, setRirData] = useState<RIRByCycleAnalytics | null>(null);
  const [durationData, setDurationData] = useState<DurationByCycleAnalytics | null>(null);
  const [restTimeData, setRestTimeData] = useState<RestTimeByCycleAnalytics | null>(null);
  const [repsData, setRepsData] = useState<RepsByCycleAnalytics | null>(null);
  const [setsData, setSetsData] = useState<SetsByCycleAnalytics | null>(null);

  // Multi-line chart data
  type ChartLineConfig = {
    dataKey: string;
    name: string;
    yAxisId: string;
    unit: string;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [mergedChartData, setMergedChartData] = useState<any[]>([]);
  const [chartLineConfigs, setChartLineConfigs] = useState<ChartLineConfig[]>([]);

  // Multi-select filter states
  const [selectedViews, setSelectedViews] = useState<Array<'volume' | 'orm' | 'rir' | 'duration' | 'restTime' | 'reps' | 'sets'>>(['volume']);
  const [selectedMuscles, setSelectedMuscles] = useState<(MuscleGroup | 'ALL')[]>(['ALL']);
  const [selectedEquipment, setSelectedEquipment] = useState<(Equipment | 'ALL')[]>(['ALL']);
  const [gymFilter, setGymFilter] = useState('alle');
  const [aggregationMode, setAggregationMode] = useState<'day' | 'week'>('week');

  // Exercise filter state
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [showExerciseModal, setShowExerciseModal] = useState(false);

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleId]);

  // Reload analytics when filters change
  useEffect(() => {
    if (!loading && cycleDetails) {
      loadAnalyticsData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedViews, selectedMuscles, selectedEquipment, gymFilter, cycleDetails, aggregationMode, selectedExercise]);

  useEffect(() => {
    // Set window size for confetti
    setWindowSize({
      width: window.innerWidth,
      height: window.innerHeight,
    });

    // Stop confetti after 3 seconds
    if (showCelebration) {
      const timer = setTimeout(() => {
        setShowConfetti(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showCelebration]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [details, cycleWorkouts, prs, gyms] = await Promise.all([
        apiClient.getCycleDetails(cycleId),
        apiClient.getWorkoutHistory({ cycleId: cycleId, status: 'COMPLETED' }),
        apiClient.getPersonalRecords({}),
        apiClient.getHomeGyms(),
      ]);

      setCycleDetails(details);
      setWorkouts(cycleWorkouts);
      setHomeGyms(gyms);

      // Create a Set of cycle workout IDs for efficient lookup
      const cycleWorkoutIds = new Set(cycleWorkouts.map(w => w.id));

      // Filter PRs to only those from cycle workouts
      const cyclePRs = prs.recentPRs.filter(pr => cycleWorkoutIds.has(pr.workoutId));
      setPersonalRecords(cyclePRs);

    } catch (error) {
      console.error('Failed to load cycle details:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate dynamic max allowed selections for each filter type
  const calculateMaxAllowed = (filterType: 'view' | 'muscle' | 'equipment'): number => {
    if (filterType === 'view') {
      return 2;
    } else {
      return 1;
    }
  };

  // Toggle handlers for multi-select filters
  const toggleView = (view: 'volume' | 'orm' | 'rir' | 'duration' | 'restTime' | 'reps' | 'sets') => {
    const maxAllowed = calculateMaxAllowed('view');
    
    if (view === 'rir') {
      if (selectedViews.includes('rir')) {
        if (selectedViews.length > 1) {
          setSelectedViews(selectedViews.filter(v => v !== 'rir'));
        }
      } else {
        setSelectedViews(['rir']);
      }
      return;
    }
    
    if (view === 'duration') {
      if (!selectedMuscles.includes('ALL') || !selectedEquipment.includes('ALL')) {
        return;
      }
    }
    
    if (selectedViews.includes(view)) {
      if (selectedViews.length > 1) {
        setSelectedViews(selectedViews.filter(v => v !== view));
      }
    } else {
      const viewsWithoutRir = selectedViews.filter(v => v !== 'rir');
      if (viewsWithoutRir.length < maxAllowed) {
        setSelectedViews([...viewsWithoutRir, view]);
      }
    }
  };

  const toggleMuscle = (muscle: MuscleGroup | 'ALL') => {
    if (muscle === 'ALL') {
      setSelectedMuscles(['ALL']);
    } else {
      setSelectedMuscles([muscle]);
    }
  };

  const toggleEquipment = (equipment: Equipment | 'ALL') => {
    if (equipment === 'ALL') {
      setSelectedEquipment(['ALL']);
    } else {
      setSelectedEquipment([equipment]);
    }
  };

  // Auto-deselect duration when muscle or equipment is not "ALL"
  useEffect(() => {
    if (selectedViews.includes('duration')) {
      if (!selectedMuscles.includes('ALL') || !selectedEquipment.includes('ALL')) {
        const newViews = selectedViews.filter(v => v !== 'duration');
        if (newViews.length === 0) {
          setSelectedViews(['volume']);
        } else {
          setSelectedViews(newViews);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMuscles, selectedEquipment]);

  // Colors now come from the shared chart-styles (imported at top) for consistency with main analytics page.

  // Translation helpers
  const translateMuscleGroup = (mg: string): string => {
    return MUSCLE_GROUP_LABELS[mg as MuscleGroup] || mg;
  };

  const translateEquipment = (eq: Equipment): string => {
    const translations: Record<Equipment, string> = {
      CABLE: 'Kabel', MACHINE: 'Maschine', DUMBBELL: 'Kurzhantel',
      BARBELL: 'Langhantel', BODYWEIGHT: 'Körpergewicht',
      SMITH_MACHINE: 'Smith-Maschine', EZ_BAR: 'SZ-Stange',
    };
    return translations[eq];
  };

  // Helper function to generate line name
  const generateLineName = (
    view: string,
    muscle?: MuscleGroup,
    equipment?: Equipment
  ): string => {
    const viewNames: Record<string, string> = {
      volume: 'Volumen', orm: 'ORM%', rir: 'RIR', duration: 'Dauer',
      restTime: 'Pause', reps: 'Wdh', sets: 'Sätze',
    };
    
    const parts = [viewNames[view] || view];
    if (muscle) parts.push(translateMuscleGroup(muscle));
    if (equipment) parts.push(translateEquipment(equipment));
    
    return parts.join(' - ');
  };

  // Helper function to get unit and Y-axis config for a view
  const getViewConfig = (view: string): { unit: string; yAxisId: string } => {
    const configs: Record<string, { unit: string; yAxisId: string }> = {
      volume: { unit: 'kg', yAxisId: 'left' },
      orm: { unit: '%', yAxisId: 'left' },
      rir: { unit: 'RIR', yAxisId: 'left' },
      duration: { unit: 'min', yAxisId: 'left' },
      restTime: { unit: 's', yAxisId: 'left' },
      reps: { unit: 'Wdh', yAxisId: 'left' },
      sets: { unit: 'Sätze', yAxisId: 'left' },
    };
    return configs[view] || { unit: '', yAxisId: 'left' };
  };

  // Helper function to merge data from multiple API results
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const mergeChartData = (
    results: any[],
    filterCombinations: Array<{ view: string; muscle?: MuscleGroup; equipment?: Equipment }>
  ) => {
    const dateSet = new Set<string>();
    const dateMetadata: Record<string, any> = {};
    results.forEach((result) => {
      if (result?.dataPoints) {
        result.dataPoints.forEach((point: any) => {
          dateSet.add(point.date);
          // Store week metadata for this date (for week aggregation)
          if (point.weekLabel && !dateMetadata[point.date]) {
            dateMetadata[point.date] = {
              weekLabel: point.weekLabel,
              weekStartDate: point.weekStartDate,
              weekEndDate: point.weekEndDate,
              workoutCount: point.workoutCount,
            };
          }
        });
      }
    });

    const sortedDates = Array.from(dateSet).sort();
    const uniqueViews = Array.from(new Set(filterCombinations.map(c => c.view)));
    const viewToYAxis: Record<string, string> = {};
    uniqueViews.forEach((view, index) => {
      viewToYAxis[view] = index === 0 ? 'left' : 'right';
    });

    const mergedData: any[] = sortedDates.map((date) => ({
      date,
      ...dateMetadata[date], // Include week metadata if available
    }));
    const lineConfigs: ChartLineConfig[] = [];

    results.forEach((result, index) => {
      if (!result?.dataPoints) return;

      const combo = filterCombinations[index];
      const lineName = generateLineName(combo.view, combo.muscle, combo.equipment);
      const viewConfig = getViewConfig(combo.view);

      lineConfigs.push({
        dataKey: lineName,
        name: lineName,
        yAxisId: viewToYAxis[combo.view],
        unit: viewConfig.unit,
      });

      result.dataPoints.forEach((point: any) => {
        const dateEntry = mergedData.find((d) => d.date === point.date);
        if (dateEntry) {
          let value = 0;
          if (combo.view === 'volume') value = point.volume;
          else if (combo.view === 'orm') value = point.percentORM || point.averageOrmPercentage;
          else if (combo.view === 'rir') value = point.rir0Count || 0;
          else if (combo.view === 'duration') value = point.duration;
          else if (combo.view === 'restTime') value = point.averageRestTime;
          else if (combo.view === 'reps') value = point.reps;
          else if (combo.view === 'sets') value = point.sets;

          dateEntry[lineName] = value;
        }
      });
    });

    const filteredData = mergedData.filter((entry) => {
      return lineConfigs.some(config => {
        const value = entry[config.dataKey];
        return value !== undefined && value !== 0;
      });
    });

    setMergedChartData(filteredData);
    setChartLineConfigs(lineConfigs);
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // Load analytics data for the current cycle
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const loadAnalyticsData = async () => {
    if (!cycleDetails) return;

    try {
      const muscles = selectedMuscles.includes('ALL') ? [undefined] : selectedMuscles.filter(m => m !== 'ALL') as MuscleGroup[];
      const equipment = selectedEquipment.includes('ALL') ? [undefined] : selectedEquipment.filter(e => e !== 'ALL') as Equipment[];

      const allPromises: Promise<any>[] = [];
      const filterCombinations: Array<{
        view: string;
        muscle?: MuscleGroup;
        equipment?: Equipment;
      }> = [];

      for (const view of selectedViews) {
        if (selectedExercise) {
          // Exercise filter mode: single iteration without muscle/equipment filters (except duration)
          if (view === 'duration') {
            // Duration analytics: keep existing logic unchanged
            for (const muscle of muscles) {
              for (const equip of equipment) {
                filterCombinations.push({ view, muscle: muscle as MuscleGroup | undefined, equipment: equip as Equipment | undefined });
                allPromises.push(
                  apiClient.getDurationByCycle(cycleId, gymFilter, muscle, equip, aggregationMode)
                );
              }
            }
          } else {
            // All other views: use exerciseId filter
            filterCombinations.push({ view, muscle: undefined, equipment: undefined });

            if (view === 'volume') {
              const cycleStart = new Date(cycleDetails.startDate).toISOString();
              const cycleEnd = cycleDetails.completedAt
                ? new Date(cycleDetails.completedAt).toISOString()
                : undefined;

              allPromises.push(
                apiClient.getVolumeAnalytics({
                  startDate: cycleStart,
                  endDate: cycleEnd,
                  gymId: gymFilter,
                  exerciseId: selectedExercise.id,
                  cycleId: cycleId,
                  aggregation: aggregationMode,
                })
              );
            } else if (view === 'orm') {
              allPromises.push(apiClient.getORMByCycle(cycleId, undefined, undefined, aggregationMode, selectedExercise.id));
            } else if (view === 'rir') {
              allPromises.push(apiClient.getRIRByCycle(cycleId, gymFilter, undefined, undefined, selectedExercise.id, aggregationMode));
            } else if (view === 'restTime') {
              allPromises.push(apiClient.getRestTimeByCycle(cycleId, gymFilter, undefined, undefined, aggregationMode, selectedExercise.id));
            } else if (view === 'reps') {
              allPromises.push(apiClient.getRepsByCycle(cycleId, undefined, undefined, aggregationMode, selectedExercise.id));
            } else if (view === 'sets') {
              allPromises.push(apiClient.getSetsByCycle(cycleId, undefined, undefined, aggregationMode, selectedExercise.id));
            }
          }
        } else {
          // No exercise filter: use existing muscle/equipment logic
          for (const muscle of muscles) {
            for (const equip of equipment) {
              filterCombinations.push({ view, muscle: muscle as MuscleGroup | undefined, equipment: equip as Equipment | undefined });

              if (view === 'volume') {
                const cycleStart = new Date(cycleDetails.startDate).toISOString();
                const cycleEnd = cycleDetails.completedAt
                  ? new Date(cycleDetails.completedAt).toISOString()
                  : undefined;

                allPromises.push(
                  apiClient.getVolumeAnalytics({
                    startDate: cycleStart,
                    endDate: cycleEnd,
                    gymId: gymFilter,
                    muscleGroup: muscle,
                    equipment: equip,
                    cycleId: cycleId,
                    aggregation: aggregationMode,
                  })
                );
              } else if (view === 'orm') {
                allPromises.push(apiClient.getORMByCycle(cycleId, muscle, equip, aggregationMode));
              } else if (view === 'rir') {
                allPromises.push(apiClient.getRIRByCycle(cycleId, gymFilter, muscle, equip, undefined, aggregationMode));
              } else if (view === 'duration') {
                allPromises.push(apiClient.getDurationByCycle(cycleId, gymFilter, muscle, equip, aggregationMode));
              } else if (view === 'restTime') {
                allPromises.push(apiClient.getRestTimeByCycle(cycleId, gymFilter, muscle, equip, aggregationMode));
              } else if (view === 'reps') {
                allPromises.push(apiClient.getRepsByCycle(cycleId, muscle, equip, aggregationMode));
              } else if (view === 'sets') {
                allPromises.push(apiClient.getSetsByCycle(cycleId, muscle, equip, aggregationMode));
              }
            }
          }
        }
      }

      const results = await Promise.all(allPromises);
      mergeChartData(results, filterCombinations);

      if (selectedViews.includes('volume') && results.length > 0) {
        const volumeResult = results.find((r, i) => filterCombinations[i].view === 'volume');
        if (volumeResult) {
          setVolumeData({
            ...volumeResult,
            dataPoints: volumeResult.dataPoints.filter((point: any) => point.volume > 0),
          });
        }
      }
      if (selectedViews.includes('orm')) {
        const ormResult = results.find((r, i) => filterCombinations[i].view === 'orm');
        if (ormResult) setOrmData(ormResult);
      }
      if (selectedViews.includes('rir')) {
        const rirResult = results.find((r, i) => filterCombinations[i].view === 'rir');
        if (rirResult) setRirData(rirResult);
      }
      if (selectedViews.includes('duration')) {
        const durationResult = results.find((r, i) => filterCombinations[i].view === 'duration');
        if (durationResult) setDurationData(durationResult);
      }
      if (selectedViews.includes('restTime')) {
        const restTimeResult = results.find((r, i) => filterCombinations[i].view === 'restTime');
        if (restTimeResult) setRestTimeData(restTimeResult);
      }
      if (selectedViews.includes('reps')) {
        const repsResult = results.find((r, i) => filterCombinations[i].view === 'reps');
        if (repsResult) setRepsData(repsResult);
      }
      if (selectedViews.includes('sets')) {
        const setsResult = results.find((r, i) => filterCombinations[i].view === 'sets');
        if (setsResult) setSetsData(setsResult);
      }
    } catch (error) {
      console.error('Failed to load analytics data:', error);
    }
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const formatVolume = (volume: number): string => {
    return new Intl.NumberFormat('de-DE').format(Math.round(volume));
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes} min`;
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-lg text-muted-foreground">Lädt Zyklusdetails...</div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!cycleDetails) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-lg text-muted-foreground">Zyklus nicht gefunden</div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        {/* Confetti */}
        {showConfetti && (
          <Confetti
            width={windowSize.width}
            height={windowSize.height}
            recycle={false}
            numberOfPieces={300}
          />
        )}

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0 space-y-6">
            {/* Header */}
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/cycles')}
                className="flex items-center gap-2 mb-4 px-0 text-muted-foreground hover:text-foreground"
              >
                <IconArrowLeft className="size-4" />
                Zurück zu Zyklen
              </Button>

              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold text-foreground">
                      {cycleDetails.name}
                    </h1>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-semibold ${ 
                        cycleDetails.status === 'ACTIVE'
                          ? 'bg-foreground text-background'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {cycleDetails.status === 'ACTIVE' ? 'Aktiv' : 'Abgeschlossen'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-muted-foreground">
                    <IconCalendar className="size-4" />
                    <span>
                      {formatDate(cycleDetails.startDate)} - {formatDate(cycleDetails.endDate)}
                    </span>
                    {cycleDetails.completedAt && (
                      <span className="ml-2 text-sm">
                        (Beendet: {formatDate(cycleDetails.completedAt)})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Circular Progress (for active cycles) */}
              {cycleDetails.status === 'ACTIVE' && cycleDetails.currentWeek && cycleDetails.totalWeeks && (
                <div className="bg-card border rounded-lg p-6">
                  <div className="text-sm font-medium text-muted-foreground mb-4">
                    Fortschritt
                  </div>
                  <div className="flex justify-center">
                    <CircularProgress
                      current={cycleDetails.currentWeek}
                      total={cycleDetails.totalWeeks}
                      size={120}
                    />
                  </div>
                </div>
              )}

              {/* Total Volume */}
              <div className="bg-card border rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-muted-foreground">
                    Gesamtvolumen
                  </div>
                  <IconTrendingUp className="size-5 text-muted-foreground" />
                </div>
                <div className="text-3xl font-bold text-foreground">
                  {formatVolume(cycleDetails.totalVolume)}
                </div>
                <div className="text-sm text-muted-foreground mt-1">kg bewegt</div>
              </div>

              {/* Workout Count */}
              <div className="bg-card border rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-muted-foreground">
                    Workouts
                  </div>
                  <IconBarbell className="size-5 text-muted-foreground" />
                </div>
                <div className="text-3xl font-bold text-foreground mb-3">
                  {cycleDetails.workoutCount}
                </div>
                <div className="space-y-1">
                  {cycleDetails.workoutsByGym.map((gym, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        {gym.isHome && <IconMapPin className="size-3" />}
                        <span>{gym.gymName}</span>
                      </div>
                      <span className="font-medium text-foreground">{gym.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* PRs */}
              <div className="bg-card border rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-muted-foreground">
                    Personal Records
                  </div>
                  <IconTrophy className="size-5 text-muted-foreground" />
                </div>
                <div className="text-3xl font-bold text-foreground">
                  {personalRecords.length}
                </div>
                <div className="text-sm text-muted-foreground mt-1">neue PRs</div>
              </div>
            </div>

            {/* Analytics Section */}
            <div className="space-y-6">
              {/* Analytics Header */}
              <div>
                <h2 className="text-2xl font-semibold text-foreground mb-2">
                  Statistiken
                </h2>
                <p className="text-sm text-muted-foreground">
                  Analysiere deine Performance während dieses Zyklus
                </p>
              </div>

              {/* Filters - reordered per spec: Gym dropdown first, then Aggregation (Tage/Wochen), then the rest */}
              <div className="bg-card border rounded-lg p-6 space-y-6">
                {/* 1. Gym as Dropdown (first as requested) */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                    Gym
                  </label>
                  <select
                    value={gymFilter}
                    onChange={(e) => setGymFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="alle">Alle</option>
                    {homeGyms.map((gym) => (
                      <option key={gym.id} value={gym.id}>
                        {gym.name}
                      </option>
                    ))}
                    <option value="andere">Andere</option>
                  </select>
                </div>

                {/* 2. Aggregation (Tage / Wochen) - directly after Gym */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                    Ansicht
                  </label>
                  <div className="flex gap-2">
                    <Button
                      variant={aggregationMode === 'day' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setAggregationMode('day')}
                    >
                      Tage
                    </Button>
                    <Button
                      variant={aggregationMode === 'week' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setAggregationMode('week')}
                    >
                      Wochen
                    </Button>
                  </div>
                </div>

                {/* 3. The rest of the filters (Views, Muscle, Equipment, Exercise) */}
                {/* Views Filter */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                    Ansichten (max. 2 für Vergleich)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={selectedViews.includes('volume') ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleView('volume')}
                    >
                      Volumen
                    </Button>
                    <Button
                      variant={selectedViews.includes('orm') ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleView('orm')}
                      disabled={gymFilter === 'andere'}
                      title={gymFilter === 'andere' ? 'ORM nur für Home Gyms verfügbar' : ''}
                    >
                      ORM%
                    </Button>
                    <Button
                      variant={selectedViews.includes('rir') ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleView('rir')}
                    >
                      RIR
                    </Button>
                    <Button
                      variant={selectedViews.includes('duration') ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleView('duration')}
                      disabled={!selectedMuscles.includes('ALL') || !selectedEquipment.includes('ALL')}
                      title={!selectedMuscles.includes('ALL') || !selectedEquipment.includes('ALL') ? 'Dauer nur mit Alle/Alle verfügbar' : ''}
                    >
                      Dauer
                    </Button>
                    <Button
                      variant={selectedViews.includes('restTime') ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleView('restTime')}
                    >
                      Satzpause
                    </Button>
                    <Button
                      variant={selectedViews.includes('reps') ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleView('reps')}
                    >
                      Wiederholungen
                    </Button>
                    <Button
                      variant={selectedViews.includes('sets') ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleView('sets')}
                    >
                      Sätze
                    </Button>
                  </div>
                </div>

                {/* Muscle Group Filter */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                    Muskelgruppe
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={selectedMuscles.includes('ALL') ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleMuscle('ALL')}
                    >
                      Alle
                    </Button>
                    {[
                      MuscleGroup.ABDOMEN,
                      MuscleGroup.LATISSIMUS,
                      MuscleGroup.TRAPEZIUS,
                      MuscleGroup.LOWER_BACK,
                      MuscleGroup.HAMSTRINGS,
                      MuscleGroup.GLUTES,
                      MuscleGroup.SHOULDERS,
                      MuscleGroup.BICEPS,
                      MuscleGroup.CHEST,
                      MuscleGroup.QUADRICEPS,
                      MuscleGroup.CALVES,
                      MuscleGroup.TRICEPS,
                    ].map((muscle) => (
                      <Button
                        key={muscle}
                        variant={selectedMuscles.includes(muscle) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleMuscle(muscle)}
                      >
                        {translateMuscleGroup(muscle)}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Equipment Filter */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                    Equipment
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={selectedEquipment.includes('ALL') ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleEquipment('ALL')}
                    >
                      Alle
                    </Button>
                    {(['CABLE', 'MACHINE', 'DUMBBELL', 'BARBELL', 'BODYWEIGHT', 'SMITH_MACHINE', 'EZ_BAR'] as Equipment[]).map((equip) => (
                      <Button
                        key={equip}
                        variant={selectedEquipment.includes(equip) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleEquipment(equip)}
                      >
                        {translateEquipment(equip)}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Exercise Filter - Alternative to Muscle/Equipment (kept in the "rest" group) */}
                <div className="border-t border-border pt-4">
                  <div className="text-center mb-3">
                    <span className="text-sm text-muted-foreground italic">ODER</span>
                  </div>

                  {selectedExercise ? (
                    <SelectedExerciseCard
                      exercise={selectedExercise}
                      onRemove={() => setSelectedExercise(null)}
                      onReplace={() => setShowExerciseModal(true)}
                    />
                  ) : (
                    <div className="flex justify-center py-2">
                      <Button
                        variant="outline"
                        onClick={() => setShowExerciseModal(true)}
                        className="h-14 w-14 rounded-lg p-0"
                        aria-label="Übung zum Filtern hinzufügen"
                      >
                        <IconPlus className="size-7" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Charts */}
              {selectedViews.length > 0 && (
                <div className="space-y-6">
                  {/* Comparison Chart (Multi-line) */}
                  {selectedViews.length > 1 && mergedChartData.length > 0 && (
                    <AnalyticsChart
                      data={mergedChartData}
                      title="Vergleich"
                      height={300}
                      isComparison={true}
                      lineConfigs={chartLineConfigs}
                    />
                  )}

                  {/* Volume Chart - using central component */}
                  {selectedViews.length === 1 && selectedViews.includes('volume') && volumeData && volumeData.dataPoints.length > 0 && (
                    <AnalyticsChart
                      data={volumeData.dataPoints}
                      title="Volumen-Entwicklung"
                      height={300}
                      chartType="line"
                      dataKey="volume"
                      name="Volumen"
                      stroke={CHART_ACCENT}
                      yAxisTickFormatter={(value) => `${formatNumber(value)}`}
                      yAxisLabel="kg"
                      footer={
                        <div className="mt-4 text-center">
                          <div className="text-sm text-muted-foreground">
                            Gesamtes Volumen
                          </div>
                          <div className="text-2xl font-bold text-foreground">
                            {formatNumber(volumeData.totalVolume)} kg
                          </div>
                        </div>
                      }
                    />
                  )}

                  {/* ORM Chart */}
                  {selectedViews.length === 1 && selectedViews.includes('orm') && (
                    <div className="bg-card border rounded-lg p-6">
                      {gymFilter === 'andere' ? (
                        <div className="text-center py-12">
                          <p className="text-muted-foreground">
                            %ORM Tracking ist nur für Home Gym Workouts verfügbar.
                          </p>
                          <p className="text-sm text-muted-foreground mt-2">
                            Bitte wähle ein Home Gym oder &quot;Alle&quot; aus.
                          </p>
                        </div>
                      ) : ormData && ormData.dataPoints.length > 0 ? (
                        <AnalyticsChart
                          data={ormData.dataPoints}
                          title="%ORM-Entwicklung"
                          height={300}
                          chartType="line"
                          dataKey="percentORM"
                          name="%ORM"
                          stroke={CHART_ACCENT}
                          yAxisTickFormatter={(value) => `${value}`}
                          yAxisLabel="%"
                          footer={
                            <div className="mt-4 text-center">
                              <div className="text-sm text-muted-foreground">
                                Durchschnitt %ORM
                              </div>
                              <div className="text-2xl font-bold text-foreground">
                                {ormData.averagePercentORM}%
                              </div>
                            </div>
                          }
                        />
                      ) : (
                        <div className="text-center py-12">
                          <p className="text-muted-foreground">
                            Keine ORM Daten verfügbar für die ausgewählten Filter.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* RIR Chart */}
                  {selectedViews.length === 1 && selectedViews.includes('rir') && (
                    <div className="bg-card border rounded-lg p-6">
                      {rirData && rirData.dataPoints.length > 0 ? (
                        <AnalyticsChart
                          data={rirData.dataPoints}
                          title="RIR-Verteilung"
                          height={300}
                          chartType="bar"
                          yAxisLabel="Anzahl"
                        >
                          <Bar dataKey="rir0Count" fill={getRIRBarFill(0)} name="RIR 0" />
                          <Bar dataKey="rir1Count" fill={getRIRBarFill(1)} name="RIR 1" />
                          <Bar dataKey="rir2Count" fill={getRIRBarFill(2)} name="RIR 2" />
                        </AnalyticsChart>
                      ) : (
                        <div className="text-center py-12">
                          <p className="text-muted-foreground">
                            Keine RIR Daten verfügbar für die ausgewählten Filter.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Duration Chart */}
                  {selectedViews.length === 1 && selectedViews.includes('duration') && durationData && durationData.dataPoints.length > 0 && (
                    <AnalyticsChart
                      data={durationData.dataPoints}
                      title="Dauer-Entwicklung"
                      height={300}
                      chartType="line"
                      dataKey="duration"
                      name="Dauer"
                      stroke={CHART_ACCENT}
                      yAxisTickFormatter={(value) => `${value}`}
                      yAxisLabel="Minuten"
                      footer={
                        <div className="mt-4 text-center">
                          <div className="text-sm text-muted-foreground">
                            Durchschnittliche Dauer
                          </div>
                          <div className="text-2xl font-bold text-foreground">
                            {Math.round(durationData.averageDuration)} min
                          </div>
                        </div>
                      }
                    />
                  )}

                  {/* Rest Time Chart */}
                  {selectedViews.length === 1 && selectedViews.includes('restTime') && restTimeData && restTimeData.dataPoints.length > 0 && (
                    <AnalyticsChart
                      data={restTimeData.dataPoints}
                      title="Satzpausen-Entwicklung"
                      height={300}
                      chartType="line"
                      dataKey="averageRestTime"
                      name="Satzpause"
                      stroke={CHART_ACCENT}
                      yAxisTickFormatter={(value) => `${value}`}
                      yAxisLabel="Sekunden"
                      footer={
                        <div className="mt-4 text-center">
                          <div className="text-sm text-muted-foreground">
                            Durchschnittliche Satzpause
                          </div>
                          <div className="text-2xl font-bold text-foreground">
                            {Math.round(restTimeData.overallAverage)} s
                          </div>
                        </div>
                      }
                    />
                  )}

                  {/* Reps Chart */}
                  {selectedViews.length === 1 && selectedViews.includes('reps') && repsData && repsData.dataPoints.length > 0 && (
                    <AnalyticsChart
                      data={repsData.dataPoints}
                      title="Wiederholungen-Entwicklung"
                      height={300}
                      chartType="line"
                      dataKey="reps"
                      name="Wiederholungen"
                      stroke={CHART_ACCENT}
                      yAxisTickFormatter={(value) => `${value}`}
                      yAxisLabel="Wiederholungen"
                      footer={
                        <div className="mt-4 text-center">
                          <div className="text-sm text-muted-foreground">
                            Gesamte Wiederholungen
                          </div>
                          <div className="text-2xl font-bold text-foreground">
                            {formatNumber(repsData.totalReps)}
                          </div>
                        </div>
                      }
                    />
                  )}

                  {/* Sets Chart */}
                  {selectedViews.length === 1 && selectedViews.includes('sets') && setsData && setsData.dataPoints.length > 0 && (
                    <AnalyticsChart
                      data={setsData.dataPoints}
                      title="Sätze-Entwicklung"
                      height={300}
                      chartType="line"
                      dataKey="sets"
                      name="Sätze"
                      stroke={CHART_ACCENT}
                      yAxisTickFormatter={(value) => `${value}`}
                      yAxisLabel="Sätze"
                      footer={
                        <div className="mt-4 text-center">
                          <div className="text-sm text-muted-foreground">
                            Gesamte Sätze
                          </div>
                          <div className="text-2xl font-bold text-foreground">
                            {setsData.totalSets}
                          </div>
                        </div>
                      }
                    />
                  )}
                </div>
              )}
            </div>

            {/* PRs List */}
            {personalRecords.length > 0 && (
              <Card>
                <div className="px-6 py-4 border-b border-border">
                  <h2 className="text-lg font-semibold text-foreground">
                    Personal Records
                  </h2>
                </div>
                <CardContent className="p-6 space-y-3">
                  {personalRecords.map((pr, index) => (
                    <PersonalRecordCard key={index} pr={pr} />
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Workout History */}
            {workouts.length > 0 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">
                    Workout-Verlauf
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {workouts.length} Workout{workouts.length !== 1 ? 's' : ''} in diesem Zyklus
                  </p>
                </div>
                {workouts.map((workout) => (
                  <Card
                    key={workout.id}
                    className="hover:shadow-sm transition-shadow cursor-pointer"
                    onClick={() => router.push(`/history/${workout.id}/edit?from=cycle&cycleId=${cycleId}`)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <h3 className="text-lg font-semibold text-foreground">
                              {workout.isFreeWorkout
                                ? workout.templateName || 'Freies Workout'
                                : workout.workoutDayName || 'Workout'}
                            </h3>
                            {workout.homeGym ? (
                              <Badge variant="secondary" className="text-xs">
                                {workout.homeGym.name}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                Anderes Gym
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <IconCalendar className="size-4" />
                              <span>{formatDate(workout.date)}</span>
                            </div>
                            {workout.totalDuration && (
                              <div className="flex items-center gap-1">
                                <IconClock className="size-4" />
                                <span>{formatDuration(workout.totalDuration)}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <IconBarbell className="size-4" />
                              <span>{workout.exerciseCount} Übung{workout.exerciseCount !== 1 ? 'en' : ''}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <IconTrendingUp className="size-4" />
                              <span>{formatVolume(workout.totalVolume)} kg</span>
                            </div>
                          </div>
                        </div>
                        <IconChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* New Cycle Button (for completed cycles) */}
            {cycleDetails.status === 'COMPLETED' && (
              <div className="flex justify-center mt-8">
                <Button
                  onClick={() => router.push('/cycles/new')}
                  className="px-6 py-3"
                >
                  Neuen Zyklus anlegen
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Exercise Selection Modal (shadcn Dialog, controlled) */}
      <ExerciseSelectionModal
        open={showExerciseModal}
        onOpenChange={setShowExerciseModal}
        onSelect={async (exerciseId: string, exercise?: Exercise) => {
          if (exercise) {
            setSelectedExercise(exercise);
          } else {
            // Fetch exercise details if not provided
            try {
              const fetchedExercise = await apiClient.getExercise(exerciseId);
              setSelectedExercise(fetchedExercise);
            } catch (error) {
              console.error('Failed to fetch exercise:', error);
            }
          }
          setShowExerciseModal(false);
        }}
      />
    </ProtectedRoute>
  );
}
