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
import ScrollableChart from '@/components/analytics/scrollable-chart';
import { PersonalRecordCard } from '@/components/PersonalRecordCard';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Calendar, 
  Dumbbell, 
  TrendingUp, 
  Trophy,
  MapPin,
} from 'lucide-react';
import Confetti from 'react-confetti';
import CircularProgress from '@/components/CircularProgress';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

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
    color: string;
    yAxisId: string;
    unit: string;
  };
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
  }, [cycleId]);

  // Reload analytics when filters change
  useEffect(() => {
    if (!loading && cycleDetails) {
      loadAnalyticsData();
    }
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
  }, [selectedMuscles, selectedEquipment]);

  // Color palette for chart lines
  const COLORS = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
    '#8b5cf6', '#ec4899', '#06b6d4', '#6366f1',
  ];

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
      const color = COLORS[index % COLORS.length];

      lineConfigs.push({
        dataKey: lineName,
        name: lineName,
        color,
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

  // Load analytics data for the current cycle
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

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('de-DE').format(Math.round(num));
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  };

  const formatXAxisLabel = (entry: any) => {
    // If weekLabel exists, use it; otherwise format the date
    if (entry.weekLabel) {
      return entry.weekLabel;
    }
    const date = new Date(entry.date);
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
    }).format(date);
  };

  const formatTooltipLabel = (entry: any) => {
    // For week aggregation, show date range and workout count
    if (entry.weekStartDate && entry.weekEndDate) {
      const start = new Intl.DateTimeFormat('de-DE', {
        day: '2-digit',
        month: '2-digit',
      }).format(new Date(entry.weekStartDate));
      const end = new Intl.DateTimeFormat('de-DE', {
        day: '2-digit',
        month: '2-digit',
      }).format(new Date(entry.weekEndDate));
      const workoutCount = entry.workoutCount || 0;
      return `${start} - ${end} (${workoutCount} Workout${workoutCount !== 1 ? 's' : ''})`;
    }
    // For day aggregation, just show the date
    const date = new Date(entry.date);
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  };

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

  const formatPRType = (type: string) => {
    switch (type) {
      case 'weight':
        return 'Gewicht';
      case 'reps':
        return 'Wiederholungen';
      case 'volume':
        return 'Volumen';
      case 'one_rm':
        return '1RM';
      default:
        return type;
    }
  };

  const formatPRValue = (pr: PersonalRecord) => {
    switch (pr.type) {
      case 'weight':
        return `${pr.value} kg`;
      case 'reps':
        return `${pr.value} Wdh`;
      case 'volume':
        return `${Math.round(pr.value)} kg`;
      case 'one_rm':
        return `${Math.round(pr.value)} kg`;
      default:
        return `${pr.value}`;
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-lg text-gray-600">Lädt Zyklusdetails...</div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!cycleDetails) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-lg text-gray-600">Zyklus nicht gefunden</div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
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
              <button
                onClick={() => router.push('/cycles')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
              >
                <ArrowLeft className="h-4 w-4" />
                Zurück zu Zyklen
              </button>

              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold text-gray-900">
                      {cycleDetails.name}
                    </h1>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-semibold ${ 
                        cycleDetails.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {cycleDetails.status === 'ACTIVE' ? 'Aktiv' : 'Abgeschlossen'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-gray-600">
                    <Calendar className="h-4 w-4" />
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
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="text-sm font-medium text-gray-600 mb-4">
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
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-gray-600">
                    Gesamtvolumen
                  </div>
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  {formatVolume(cycleDetails.totalVolume)}
                </div>
                <div className="text-sm text-gray-500 mt-1">kg bewegt</div>
              </div>

              {/* Workout Count */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-gray-600">
                    Workouts
                  </div>
                  <Dumbbell className="h-5 w-5 text-blue-600" />
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-3">
                  {cycleDetails.workoutCount}
                </div>
                <div className="space-y-1">
                  {cycleDetails.workoutsByGym.map((gym, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-1 text-gray-600">
                        {gym.isHome && <MapPin className="h-3 w-3" />}
                        <span>{gym.gymName}</span>
                      </div>
                      <span className="font-medium text-gray-900">{gym.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* PRs */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-gray-600">
                    Personal Records
                  </div>
                  <Trophy className="h-5 w-5 text-yellow-600" />
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  {personalRecords.length}
                </div>
                <div className="text-sm text-gray-500 mt-1">neue PRs</div>
              </div>
            </div>

            {/* Analytics Section */}
            <div className="space-y-6">
              {/* Analytics Header */}
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                  Statistiken
                </h2>
                <p className="text-sm text-gray-600">
                  Analysiere deine Performance während dieses Zyklus
                </p>
              </div>

              {/* Filters */}
              <div className="bg-white rounded-lg shadow p-6 space-y-6">
                {/* Views Filter */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Ansichten (max. 2 für Vergleich)</h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => toggleView('volume')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        selectedViews.includes('volume')
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Volumen
                    </button>
                    <button
                      onClick={() => toggleView('orm')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        selectedViews.includes('orm')
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      } ${gymFilter === 'andere' ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={gymFilter === 'andere'}
                      title={gymFilter === 'andere' ? 'ORM nur für Home Gyms verfügbar' : ''}
                    >
                      ORM%
                    </button>
                    <button
                      onClick={() => toggleView('rir')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        selectedViews.includes('rir')
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      RIR
                    </button>
                    <button
                      onClick={() => toggleView('duration')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        selectedViews.includes('duration')
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      } ${!selectedMuscles.includes('ALL') || !selectedEquipment.includes('ALL') ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title={!selectedMuscles.includes('ALL') || !selectedEquipment.includes('ALL') ? 'Dauer nur mit Alle/Alle verfügbar' : ''}
                    >
                      Dauer
                    </button>
                    <button
                      onClick={() => toggleView('restTime')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        selectedViews.includes('restTime')
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Satzpause
                    </button>
                    <button
                      onClick={() => toggleView('reps')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        selectedViews.includes('reps')
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Wiederholungen
                    </button>
                    <button
                      onClick={() => toggleView('sets')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        selectedViews.includes('sets')
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Sätze
                    </button>
                  </div>
                </div>

                {/* Muscle Group Filter */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Muskelgruppe</h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => toggleMuscle('ALL')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        selectedMuscles.includes('ALL')
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Alle
                    </button>
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
                      <button
                        key={muscle}
                        onClick={() => toggleMuscle(muscle)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          selectedMuscles.includes(muscle)
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {translateMuscleGroup(muscle)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Equipment Filter */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Equipment</h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => toggleEquipment('ALL')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        selectedEquipment.includes('ALL')
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Alle
                    </button>
                    {(['CABLE', 'MACHINE', 'DUMBBELL', 'BARBELL', 'BODYWEIGHT', 'SMITH_MACHINE', 'EZ_BAR'] as Equipment[]).map((equip) => (
                      <button
                        key={equip}
                        onClick={() => toggleEquipment(equip)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          selectedEquipment.includes(equip)
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {translateEquipment(equip)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Exercise Filter - Alternative to Muscle/Equipment */}
                <div className="border-t border-gray-200 pt-4">
                  <div className="text-center mb-3">
                    <span className="text-sm text-gray-500 italic">ODER</span>
                  </div>
                  
                  {selectedExercise ? (
                    <SelectedExerciseCard
                      exercise={selectedExercise}
                      onRemove={() => setSelectedExercise(null)}
                      onReplace={() => setShowExerciseModal(true)}
                    />
                  ) : (
                    <button
                      onClick={() => setShowExerciseModal(true)}
                      className="w-full px-4 py-3 rounded-lg text-sm font-medium text-blue-600 bg-blue-50 border-2 border-dashed border-blue-300 hover:bg-blue-100 transition-colors"
                    >
                      + Übung hinzufügen
                    </button>
                  )}
                </div>

                {/* Gym Filter */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Gym</h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setGymFilter('alle')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        gymFilter === 'alle'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Alle
                    </button>
                    {homeGyms.map((gym) => (
                      <button
                        key={gym.id}
                        onClick={() => setGymFilter(gym.id)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          gymFilter === gym.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {gym.name}
                      </button>
                    ))}
                    <button
                      onClick={() => setGymFilter('andere')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        gymFilter === 'andere'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Andere
                    </button>
                  </div>
                </div>

                {/* Aggregation Mode Toggle */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Aggregation</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAggregationMode('day')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        aggregationMode === 'day'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Tage
                    </button>
                    <button
                      onClick={() => setAggregationMode('week')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        aggregationMode === 'week'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Wochen
                    </button>
                  </div>
                </div>
              </div>

              {/* Charts */}
              {selectedViews.length > 0 && (
                <div className="space-y-6">
                  {/* Comparison Chart (Multi-line) */}
                  {selectedViews.length > 1 && mergedChartData.length > 0 && (
                    <div className="bg-white rounded-lg shadow p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Vergleich
                      </h3>
                      <ScrollableChart dataPointCount={mergedChartData.length}>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={mergedChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="date"
                              tickFormatter={(date, index) => formatXAxisLabel(mergedChartData[index])}
                              style={{ fontSize: '12px' }}
                            />
                            {/* Left Y-Axis */}
                            {chartLineConfigs.some(config => config.yAxisId === 'left') && (
                              <YAxis
                                yAxisId="left"
                                label={{
                                  value: chartLineConfigs.find(c => c.yAxisId === 'left')?.unit || '',
                                  angle: -90,
                                  position: 'insideLeft',
                                }}
                                style={{ fontSize: '12px' }}
                              />
                            )}
                            {/* Right Y-Axis */}
                            {chartLineConfigs.some(config => config.yAxisId === 'right') && (
                              <YAxis
                                yAxisId="right"
                                orientation="right"
                                label={{
                                  value: chartLineConfigs.find(c => c.yAxisId === 'right')?.unit || '',
                                  angle: 90,
                                  position: 'insideRight',
                                }}
                                style={{ fontSize: '12px' }}
                              />
                            )}
                            <Tooltip
                              labelFormatter={(label: any, payload: readonly any[]) => {
                                if (payload && payload.length > 0) {
                                  return formatTooltipLabel(payload[0].payload);
                                }
                                const date = new Date(label as string);
                                return new Intl.DateTimeFormat('de-DE', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                }).format(date);
                              }}
                            />
                            <Legend />
                            {chartLineConfigs.map((config) => (
                              <Line
                                key={config.dataKey}
                                type="monotone"
                                dataKey={config.dataKey}
                                name={config.name}
                                stroke={config.color}
                                yAxisId={config.yAxisId}
                                strokeWidth={2}
                                dot={{ r: 3 }}
                                activeDot={{ r: 5 }}
                                connectNulls={true}
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </ScrollableChart>
                    </div>
                  )}

                  {/* Volume Chart */}
                  {selectedViews.length === 1 && selectedViews.includes('volume') && volumeData && volumeData.dataPoints.length > 0 && (
                    <div className="bg-white rounded-lg shadow p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Volumen-Entwicklung
                      </h3>
                      <ScrollableChart dataPointCount={volumeData.dataPoints.length}>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={volumeData.dataPoints}>
                            <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(date, index) => formatXAxisLabel(volumeData.dataPoints[index])}
                            style={{ fontSize: '12px' }}
                          />
                          <YAxis
                            tickFormatter={(value) => `${formatNumber(value)}kg`}
                            style={{ fontSize: '12px' }}
                          />
                          <Tooltip
                            formatter={(value: any) => [
                              `${formatNumber(value as number)} kg`,
                              'Volumen',
                            ]}
                            labelFormatter={(label: any, payload: readonly any[]) => {
                              if (payload && payload.length > 0) {
                                return formatTooltipLabel(payload[0].payload);
                              }
                              const date = new Date(label as string);
                              return new Intl.DateTimeFormat('de-DE', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              }).format(date);
                            }}
                          />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="volume"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            dot={{ r: 4 }}
                            name="Volumen"
                          />
                        </LineChart>
                        </ResponsiveContainer>
                      </ScrollableChart>
                      <div className="mt-4 text-center">
                        <div className="text-sm text-gray-600">
                          Gesamtes Volumen
                        </div>
                        <div className="text-2xl font-bold text-gray-900">
                          {formatNumber(volumeData.totalVolume)} kg
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ORM Chart */}
                  {selectedViews.length === 1 && selectedViews.includes('orm') && (
                    <div className="bg-white rounded-lg shadow p-6">
                      {gymFilter === 'andere' ? (
                        <div className="text-center py-12">
                          <p className="text-gray-600">
                            %ORM Tracking ist nur für Home Gym Workouts verfügbar.
                          </p>
                          <p className="text-sm text-gray-500 mt-2">
                            Bitte wähle ein Home Gym oder "Alle" aus.
                          </p>
                        </div>
                      ) : ormData && ormData.dataPoints.length > 0 ? (
                        <>
                          <h3 className="text-lg font-semibold text-gray-900 mb-4">
                            %ORM-Entwicklung
                          </h3>
                          <ScrollableChart dataPointCount={ormData.dataPoints.length}>
                            <ResponsiveContainer width="100%" height={300}>
                              <LineChart data={ormData.dataPoints}>
                                <CartesianGrid strokeDasharray="3 3" />
                              <XAxis
                                dataKey="date"
                                tickFormatter={(date, index) => formatXAxisLabel(ormData.dataPoints[index])}
                                style={{ fontSize: '12px' }}
                              />
                              <YAxis
                                tickFormatter={(value) => `${value}%`}
                                style={{ fontSize: '12px' }}
                              />
                              <Tooltip
                                formatter={(value: any) => [`${value}%`, '%ORM']}
                                labelFormatter={(label: any, payload: readonly any[]) => {
                                  if (payload && payload.length > 0) {
                                    return formatTooltipLabel(payload[0].payload);
                                  }
                                  const date = new Date(label as string);
                                  return new Intl.DateTimeFormat('de-DE', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                  }).format(date);
                                }}
                              />
                              <Legend />
                              <Line
                                type="monotone"
                                dataKey="percentORM"
                                stroke="#10b981"
                                strokeWidth={2}
                                dot={{ r: 4 }}
                                name="%ORM"
                                connectNulls={true}
                              />
                            </LineChart>
                            </ResponsiveContainer>
                          </ScrollableChart>
                          <div className="mt-4 text-center">
                            <div className="text-sm text-gray-600">
                              Durchschnitt %ORM
                            </div>
                            <div className="text-2xl font-bold text-gray-900">
                              {ormData.averagePercentORM}%
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-12">
                          <p className="text-gray-600">
                            Keine ORM Daten verfügbar für die ausgewählten Filter.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* RIR Chart */}
                  {selectedViews.length === 1 && selectedViews.includes('rir') && (
                    <div className="bg-white rounded-lg shadow p-6">
                      {rirData && rirData.dataPoints.length > 0 ? (
                        <>
                          <h3 className="text-lg font-semibold text-gray-900 mb-4">
                            RIR-Verteilung
                          </h3>
                          <ScrollableChart dataPointCount={rirData.dataPoints.length}>
                            <ResponsiveContainer width="100%" height={300}>
                              <BarChart data={rirData.dataPoints}>
                                <CartesianGrid strokeDasharray="3 3" />
                              <XAxis
                                dataKey="date"
                                tickFormatter={(date, index) => formatXAxisLabel(rirData.dataPoints[index])}
                                style={{ fontSize: '12px' }}
                              />
                              <YAxis
                                label={{ value: 'Anzahl Sätze', angle: -90, position: 'insideLeft' }}
                                style={{ fontSize: '12px' }}
                              />
                              <Tooltip
                                labelFormatter={(label: any, payload: readonly any[]) => {
                                  if (payload && payload.length > 0) {
                                    return formatTooltipLabel(payload[0].payload);
                                  }
                                  const date = new Date(label as string);
                                  return new Intl.DateTimeFormat('de-DE', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                  }).format(date);
                                }}
                              />
                              <Legend />
                              <Bar dataKey="rir0Count" fill="#ef4444" name="RIR 0" />
                              <Bar dataKey="rir1Count" fill="#eab308" name="RIR 1" />
                              <Bar dataKey="rir2Count" fill="#22c55e" name="RIR 2" />
                            </BarChart>
                            </ResponsiveContainer>
                          </ScrollableChart>
                        </>
                      ) : (
                        <div className="text-center py-12">
                          <p className="text-gray-600">
                            Keine RIR Daten verfügbar für die ausgewählten Filter.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Duration Chart */}
                  {selectedViews.length === 1 && selectedViews.includes('duration') && durationData && durationData.dataPoints.length > 0 && (
                    <div className="bg-white rounded-lg shadow p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Dauer-Entwicklung
                      </h3>
                      <ScrollableChart dataPointCount={durationData.dataPoints.length}>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={durationData.dataPoints}>
                            <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(date, index) => formatXAxisLabel(durationData.dataPoints[index])}
                            style={{ fontSize: '12px' }}
                          />
                          <YAxis
                            tickFormatter={(value) => `${value}min`}
                            style={{ fontSize: '12px' }}
                          />
                          <Tooltip
                            formatter={(value: any) => [`${value} min`, 'Dauer']}
                            labelFormatter={(label: any, payload: readonly any[]) => {
                              if (payload && payload.length > 0) {
                                return formatTooltipLabel(payload[0].payload);
                              }
                              const date = new Date(label as string);
                              return new Intl.DateTimeFormat('de-DE', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              }).format(date);
                            }}
                          />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="duration"
                            stroke="#f59e0b"
                            strokeWidth={2}
                            dot={{ r: 4 }}
                            name="Dauer"
                          />
                        </LineChart>
                        </ResponsiveContainer>
                      </ScrollableChart>
                      <div className="mt-4 text-center">
                        <div className="text-sm text-gray-600">
                          Durchschnittliche Dauer
                        </div>
                        <div className="text-2xl font-bold text-gray-900">
                          {Math.round(durationData.averageDuration)} min
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Rest Time Chart */}
                  {selectedViews.length === 1 && selectedViews.includes('restTime') && restTimeData && restTimeData.dataPoints.length > 0 && (
                    <div className="bg-white rounded-lg shadow p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Satzpausen-Entwicklung
                      </h3>
                      <ScrollableChart dataPointCount={restTimeData.dataPoints.length}>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={restTimeData.dataPoints}>
                            <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(date, index) => formatXAxisLabel(restTimeData.dataPoints[index])}
                            style={{ fontSize: '12px' }}
                          />
                          <YAxis
                            tickFormatter={(value) => `${value}s`}
                            style={{ fontSize: '12px' }}
                          />
                          <Tooltip
                            formatter={(value: any) => [`${value} s`, 'Pause']}
                            labelFormatter={(label: any, payload: readonly any[]) => {
                              if (payload && payload.length > 0) {
                                return formatTooltipLabel(payload[0].payload);
                              }
                              const date = new Date(label as string);
                              return new Intl.DateTimeFormat('de-DE', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              }).format(date);
                            }}
                          />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="averageRestTime"
                            stroke="#8b5cf6"
                            strokeWidth={2}
                            dot={{ r: 4 }}
                            name="Satzpause"
                          />
                        </LineChart>
                        </ResponsiveContainer>
                      </ScrollableChart>
                      <div className="mt-4 text-center">
                        <div className="text-sm text-gray-600">
                          Durchschnittliche Satzpause
                        </div>
                        <div className="text-2xl font-bold text-gray-900">
                          {Math.round(restTimeData.overallAverage)} s
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Reps Chart */}
                  {selectedViews.length === 1 && selectedViews.includes('reps') && repsData && repsData.dataPoints.length > 0 && (
                    <div className="bg-white rounded-lg shadow p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Wiederholungen-Entwicklung
                      </h3>
                      <ScrollableChart dataPointCount={repsData.dataPoints.length}>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={repsData.dataPoints}>
                            <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(date, index) => formatXAxisLabel(repsData.dataPoints[index])}
                            style={{ fontSize: '12px' }}
                          />
                          <YAxis
                            tickFormatter={(value) => `${value}`}
                            style={{ fontSize: '12px' }}
                          />
                          <Tooltip
                            formatter={(value: any) => [`${value}`, 'Wiederholungen']}
                            labelFormatter={(label: any, payload: readonly any[]) => {
                              if (payload && payload.length > 0) {
                                return formatTooltipLabel(payload[0].payload);
                              }
                              const date = new Date(label as string);
                              return new Intl.DateTimeFormat('de-DE', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              }).format(date);
                            }}
                          />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="reps"
                            stroke="#ec4899"
                            strokeWidth={2}
                            dot={{ r: 4 }}
                            name="Wiederholungen"
                          />
                        </LineChart>
                        </ResponsiveContainer>
                      </ScrollableChart>
                      <div className="mt-4 text-center">
                        <div className="text-sm text-gray-600">
                          Gesamte Wiederholungen
                        </div>
                        <div className="text-2xl font-bold text-gray-900">
                          {formatNumber(repsData.totalReps)}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Sets Chart */}
                  {selectedViews.length === 1 && selectedViews.includes('sets') && setsData && setsData.dataPoints.length > 0 && (
                    <div className="bg-white rounded-lg shadow p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Sätze-Entwicklung
                      </h3>
                      <ScrollableChart dataPointCount={setsData.dataPoints.length}>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={setsData.dataPoints}>
                            <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(date, index) => formatXAxisLabel(setsData.dataPoints[index])}
                            style={{ fontSize: '12px' }}
                          />
                          <YAxis
                            tickFormatter={(value) => `${value}`}
                            style={{ fontSize: '12px' }}
                          />
                          <Tooltip
                            formatter={(value: any) => [`${value}`, 'Sätze']}
                            labelFormatter={(label: any, payload: readonly any[]) => {
                              if (payload && payload.length > 0) {
                                return formatTooltipLabel(payload[0].payload);
                              }
                              const date = new Date(label as string);
                              return new Intl.DateTimeFormat('de-DE', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              }).format(date);
                            }}
                          />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="sets"
                            stroke="#06b6d4"
                            strokeWidth={2}
                            dot={{ r: 4 }}
                            name="Sätze"
                          />
                        </LineChart>
                        </ResponsiveContainer>
                      </ScrollableChart>
                      <div className="mt-4 text-center">
                        <div className="text-sm text-gray-600">
                          Gesamte Sätze
                        </div>
                        <div className="text-2xl font-bold text-gray-900">
                          {setsData.totalSets}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* PRs List */}
            {personalRecords.length > 0 && (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Personal Records
                  </h2>
                </div>
                <div className="p-6 space-y-3">
                  {personalRecords.map((pr, index) => (
                    <PersonalRecordCard key={index} pr={pr} />
                  ))}
                </div>
              </div>
            )}

            {/* Workout History */}
            {workouts.length > 0 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Workout-Verlauf
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {workouts.length} Workout{workouts.length !== 1 ? 's' : ''} in diesem Zyklus
                  </p>
                </div>
                {workouts.map((workout) => (
                  <div
                    key={workout.id}
                    className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6"
                  >
                    <div className="flex items-start justify-between">
                      <Link
                        href={`/history/${workout.id}?from=cycle&cycleId=${cycleId}`}
                        className="flex-1"
                      >
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {workout.isFreeWorkout
                              ? workout.templateName || 'Freies Workout'
                              : workout.workoutDayName || 'Workout'}
                          </h3>
                          {workout.homeGym ? (
                            <span className="text-xs bg-violet-100 text-violet-800 px-2 py-1 rounded">
                              {workout.homeGym.name}
                            </span>
                          ) : (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                              Anderes Gym
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>{formatDate(workout.date)}</span>
                          </div>
                          {workout.totalDuration && (
                            <div className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>{formatDuration(workout.totalDuration)}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Dumbbell className="w-4 h-4" />
                            <span>{workout.exerciseCount} Übung{workout.exerciseCount !== 1 ? 'en' : ''}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <TrendingUp className="w-4 h-4" />
                            <span>{formatVolume(workout.totalVolume)} kg</span>
                          </div>
                        </div>
                      </Link>
                      <Link
                        href={`/history/${workout.id}?from=cycle&cycleId=${cycleId}`}
                        className="ml-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Details anzeigen"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* New Cycle Button (for completed cycles) */}
            {cycleDetails.status === 'COMPLETED' && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={() => router.push('/cycles/new')}
                  className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Neuen Zyklus anlegen
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Exercise Selection Modal */}
      {showExerciseModal && (
        <ExerciseSelectionModal
          onClose={() => setShowExerciseModal(false)}
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
      )}
    </ProtectedRoute>
  );
}
