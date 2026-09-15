'use client';

/* eslint-disable @typescript-eslint/no-explicit-any -- Analytics data layer uses flexible any for API responses and recharts data (pre-existing, preserved during UI refactor) */

import { ProtectedRoute } from '@/components/protected-route';
import { Link } from '@/i18n/navigation';
import { useState, useEffect } from 'react';
import { useTranslations, useLocale, useFormatter } from 'next-intl';
import { apiClient } from '@/lib/api';
import {
  VolumeAnalytics,
  PersonalRecord,
  MuscleGroup,
  Equipment,
  HomeGym,
  CycleList,
  RIRAnalytics,
  DurationAnalytics,
  RestTimeAnalytics,
  RepsAnalytics,
  SetsAnalytics,
  IntensityAnalytics,
  Exercise,
} from '@/types';
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
import { IconChevronLeft, IconChevronRight, IconPlus } from '@tabler/icons-react';
import { useExerciseLabels } from '@/hooks/useExerciseLabels';
import ExerciseSelectionModal from '@/components/workout/exercise-selection-modal';
import SelectedExerciseCard from '@/components/analytics/selected-exercise-card';
import ScrollableChart from '@/components/analytics/scrollable-chart';
import AnalyticsChart from '@/components/analytics/AnalyticsChart';
import NutritionTrendChart from '@/components/analytics/nutrition-trend-chart';
import {
  CHART_ACCENT,
  getRIRBarFill,
  tooltipContentStyle,
  tooltipItemStyle,
  tooltipLabelStyle,
} from '@/components/analytics/chart-styles';
import { formatNumber, formatDate, formatXAxisLabel, formatTooltipLabel } from '@/components/analytics/chart-utils';
import { PersonalRecordCard } from '@/components/PersonalRecordCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { NutritionTrend } from '@/types';
import { addDays } from '@/lib/nutrition';
import { toLocalDateString } from '@/lib/local-date';

// The range selector drives the nutrition chart's window. "Alle" has no natural start for a
// daily series, so it maps to a year -- long enough for a trend, and the endpoint's own cap.
const nutritionRangeDaysFor = (timeFilter: string) =>
  timeFilter === 'all' ? 365 : Number(timeFilter);

/** The Ernährungs-Analytics endpoint's own day cap (`MAX_RANGE_DAYS` in
 *  nutrition-analytics.service.ts) -- an active cycle can run past its planned duration, so
 *  its span is clamped rather than trusted verbatim. */
const NUTRITION_MAX_RANGE_DAYS = 366;

type CycleSpan = { startDate: string; completedAt?: string };

/**
 * The nutrition chart's date range: in Zyklus-Modus, the selected cycle's own span -- its
 * start to its completion, or to today while still active -- clamped to the endpoint's day
 * cap; otherwise the shared range selector above the chart. `null` in cycle mode with no
 * cycle to show yet (mirrors `loadCycleModeData`'s own no-op there).
 */
function nutritionRangeFor(
  cycleMode: boolean,
  selectedCycle: CycleSpan | undefined,
  timeFilter: string,
): { start: string; end: string } | null {
  const today = toLocalDateString(new Date());
  if (cycleMode) {
    if (!selectedCycle) return null;
    const end = selectedCycle.completedAt
      ? toLocalDateString(new Date(selectedCycle.completedAt))
      : today;
    const rawStart = toLocalDateString(new Date(selectedCycle.startDate));
    const earliestStart = addDays(end, -(NUTRITION_MAX_RANGE_DAYS - 1));
    return { start: rawStart > earliestStart ? rawStart : earliestStart, end };
  }
  const days = nutritionRangeDaysFor(timeFilter);
  return { start: addDays(today, -(days - 1)), end: today };
}

/**
 * The chart legend's range phrase: the selected cycle's own span in Zyklus-Modus (same
 * "DD.MM. - DD.MM." wording as the cycle navigation header above), otherwise the shared range
 * selector's "letzte N Tage". `t` and `locale` are threaded in from the component (a plain
 * helper called during render, not a hook) so the phrase resolves from the message catalogue.
 */
function nutritionRangeLabelFor(
  cycleMode: boolean,
  selectedCycle: CycleSpan | undefined,
  timeFilter: string,
  t: (key: string, values?: Record<string, string | number | Date>) => string,
  locale: string,
): string {
  if (cycleMode) {
    if (!selectedCycle) return '';
    const start = formatDate(selectedCycle.startDate, locale);
    return selectedCycle.completedAt
      ? `${start} - ${formatDate(selectedCycle.completedAt, locale)}`
      : `${start} - ${t('today')}`;
  }
  return t('lastNDays', { count: nutritionRangeDaysFor(timeFilter) });
}

export default function AnalyticsPage() {
  const t = useTranslations('AnalyticsPage');
  const tChart = useTranslations('AnalyticsChart');
  const locale = useLocale();
  const format = useFormatter();

  // Data states
  const [volumeData, setVolumeData] = useState<VolumeAnalytics | null>(null);
  const [rirData, setRirData] = useState<RIRAnalytics | null>(null);
  const [durationData, setDurationData] = useState<DurationAnalytics | null>(null);
  const [restTimeData, setRestTimeData] = useState<RestTimeAnalytics | null>(null);
  const [repsData, setRepsData] = useState<RepsAnalytics | null>(null);
  const [setsData, setSetsData] = useState<SetsAnalytics | null>(null);
  const [intensityData, setIntensityData] = useState<IntensityAnalytics | null>(null);
  const [prs, setPrs] = useState<PersonalRecord[]>([]);
  const [homeGyms, setHomeGyms] = useState<HomeGym[]>([]);
  const [cycles, setCycles] = useState<CycleList | null>(null);
  
  // Multi-line chart data
  type ChartLineConfig = {
    dataKey: string;
    name: string;
    yAxisId: string;
    unit: string;
  };
  const [mergedChartData, setMergedChartData] = useState<any[]>([]);
  const [chartLineConfigs, setChartLineConfigs] = useState<ChartLineConfig[]>([]);
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [cycleMode, setCycleMode] = useState(false);
  const [aggregationMode, setAggregationMode] = useState<'day' | 'week'>('week');
  
  // Multi-select filter states
  const [selectedViews, setSelectedViews] = useState<Array<'volume' | 'rir' | 'duration' | 'restTime' | 'reps' | 'sets' | 'intensity'>>(['volume']);
  const [selectedMuscles, setSelectedMuscles] = useState<(MuscleGroup | 'ALL')[]>(['ALL']);
  const [selectedEquipment, setSelectedEquipment] = useState<(Equipment | 'ALL')[]>(['ALL']);
  
  // Filter states
  const [timeFilter, setTimeFilter] = useState('7');
  const [gymFilter, setGymFilter] = useState('alle');

  // Ernährungs-Analytics (#153): its own fetch, keyed on the shared range selector (or, in
  // Zyklus-Modus, on the selected cycle's own span -- see `nutritionRangeFor`).
  const [nutritionTrend, setNutritionTrend] = useState<NutritionTrend | null>(null);
  const [nutritionLoading, setNutritionLoading] = useState(true);

  // Exercise filter state
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [showExerciseModal, setShowExerciseModal] = useState(false);

  // Cycle navigation
  const [selectedCycleIndex, setSelectedCycleIndex] = useState<number>(0);

  // The cycle list and the one currently shown -- hoisted here (rather than declared once
  // near the JSX, as before) because the nutrition trend below needs it too.
  const allCycles = cycles
    ? [...(cycles.activeCycle ? [cycles.activeCycle] : []), ...cycles.completedCycles]
    : [];
  const selectedCycle = allCycles[selectedCycleIndex];

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Nutrition trend follows the range selector, or the selected cycle's own span in Zyklus-
  // Modus. The previous chart stays visible while a new range loads.
  useEffect(() => {
    const range = nutritionRangeFor(cycleMode, selectedCycle, timeFilter);
    if (!range) return; // cycle mode with no cycle to show yet -- mirrors loadCycleModeData
    let cancelled = false;
    apiClient
      .getNutritionAnalytics(range.start, range.end)
      .then((trend) => {
        if (!cancelled) {
          setNutritionTrend(trend);
          setNutritionLoading(false);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Failed to load nutrition analytics:', error);
          setNutritionTrend(null);
          setNutritionLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [cycleMode, selectedCycle, timeFilter]);

  // Reload analytics when filters change.
  // Also runs on initial mount (with default filter values) so the chart renders immediately
  // instead of only after a manual change (e.g. days/weeks toggle).
  useEffect(() => {
    loadAnalyticsData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleMode, timeFilter, gymFilter, selectedMuscles, selectedEquipment, selectedCycleIndex, selectedViews, aggregationMode, selectedExercise]);

  // Calculate dynamic max allowed selections for each filter type
  const calculateMaxAllowed = (filterType: 'view' | 'muscle' | 'equipment'): number => {
    if (filterType === 'view') {
      // Max 2 views for comparison
      return 2;
    } else {
      // Muscle and Equipment are single-select only
      return 1;
    }
  };

  // Toggle handlers for multi-select filters
  const toggleView = (view: 'volume' | 'rir' | 'duration' | 'restTime' | 'reps' | 'sets' | 'intensity') => {
    const maxAllowed = calculateMaxAllowed('view');
    
    // RIR special case: always single-select (bar chart incompatible with multi-line)
    if (view === 'rir') {
      if (selectedViews.includes('rir')) {
        // Deselect RIR - ensure at least one view remains
        if (selectedViews.length > 1) {
          setSelectedViews(selectedViews.filter(v => v !== 'rir'));
        }
      } else {
        // Select RIR as only view
        setSelectedViews(['rir']);
      }
      return;
    }
    
    // Duration special case: only compatible with muscle="ALL" AND equipment="ALL"
    if (view === 'duration') {
      if (!selectedMuscles.includes('ALL') || !selectedEquipment.includes('ALL')) {
        // Cannot select duration without ALL filters
        return;
      }
    }
    
    if (selectedViews.includes(view)) {
      // Deselect - ensure at least one view remains
      if (selectedViews.length > 1) {
        setSelectedViews(selectedViews.filter(v => v !== view));
      }
    } else {
      // Deselect RIR if selecting another view
      const viewsWithoutRir = selectedViews.filter(v => v !== 'rir');
      
      // Select - check limit
      if (viewsWithoutRir.length < maxAllowed) {
        setSelectedViews([...viewsWithoutRir, view]);
      }
    }
  };

  const toggleMuscle = (muscle: MuscleGroup | 'ALL') => {
    // Radio-button behavior: always select the clicked muscle
    if (muscle === 'ALL') {
      setSelectedMuscles(['ALL']);
    } else {
      setSelectedMuscles([muscle]);
    }
  };

  const toggleEquipment = (equipment: Equipment | 'ALL') => {
    // Radio-button behavior: always select the clicked equipment
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
        // Remove duration from selected views
        const newViews = selectedViews.filter(v => v !== 'duration');
        if (newViews.length === 0) {
          // Fallback to volume if no views left
          setSelectedViews(['volume']);
        } else {
          setSelectedViews(newViews);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMuscles, selectedEquipment]);

  // Chart colors, RIR fills and tooltip styles are now imported from the central chart-styles.ts
  // (to avoid duplication with the cycle detail page and keep presentation logic centralized).

  const { translateMuscleGroup, translateEquipment } = useExerciseLabels();

  // Chart legend/axis vocabulary (Volumen, RIR, Dauer, Pause, Wdh, Sätze, Intensität), shared
  // by generateLineName and getViewConfig below -- both plain helpers (not hooks), so the
  // already-resolved map is built here in the component body and passed in.
  const viewNames: Record<string, string> = {
    volume: tChart('volume'),
    rir: 'RIR', // initialism, kept as-is
    duration: tChart('duration'),
    restTime: tChart('restTime'),
    reps: tChart('reps'),
    sets: tChart('sets'),
    intensity: tChart('intensity'),
  };

  // Helper function to generate line name
  const generateLineName = (
    view: string,
    muscle?: MuscleGroup,
    equipment?: Equipment
  ): string => {
    const parts = [viewNames[view] || view];
    if (muscle) parts.push(translateMuscleGroup(muscle));
    if (equipment) parts.push(translateEquipment(equipment));

    return parts.join(' - ');
  };

  // Helper function to get unit and Y-axis config for a view
  const getViewConfig = (view: string): { unit: string; yAxisId: string } => {
    const configs: Record<string, { unit: string; yAxisId: string }> = {
      volume: { unit: 'kg', yAxisId: 'left' },
      rir: { unit: 'RIR', yAxisId: 'left' },
      duration: { unit: 'min', yAxisId: 'left' },
      restTime: { unit: 's', yAxisId: 'left' },
      reps: { unit: viewNames.reps, yAxisId: 'left' },
      sets: { unit: viewNames.sets, yAxisId: 'left' },
      intensity: { unit: '%', yAxisId: 'left' },
    };
    return configs[view] || { unit: '', yAxisId: 'left' };
  };

  // Helper function to merge data from multiple API results
  const mergeChartData = (
    results: any[],
    filterCombinations: Array<{ view: string; muscle?: MuscleGroup; equipment?: Equipment }>
  ) => {
    // Collect all unique dates
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

    // Identify unique view types for Y-axis assignment
    const uniqueViews = Array.from(new Set(filterCombinations.map(c => c.view)));
    const viewToYAxis: Record<string, string> = {};
    uniqueViews.forEach((view, index) => {
      // Assign first view type to 'left', second to 'right'
      viewToYAxis[view] = index === 0 ? 'left' : 'right';
    });

    // Build merged data structure
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
        yAxisId: viewToYAxis[combo.view], // Dynamic Y-axis assignment
        unit: viewConfig.unit,
      });

      // Add data points to merged structure
      result.dataPoints.forEach((point: any) => {
        const dateEntry = mergedData.find((d) => d.date === point.date);
        if (dateEntry) {
          // Determine the value key based on view type
          let value = 0;
          if (combo.view === 'volume') value = point.volume;
          else if (combo.view === 'rir') value = point.rir0Count || 0;
          else if (combo.view === 'duration') value = point.duration;
          else if (combo.view === 'restTime') value = point.averageRestTime;
          else if (combo.view === 'reps') value = point.reps;
          else if (combo.view === 'sets') value = point.sets;
          else if (combo.view === 'intensity') value = point.intensity;

          dateEntry[lineName] = value;
        }
      });
    });

    // Filter out dates where all values are 0
    const filteredData = mergedData.filter((entry) => {
      // Check if at least one value (excluding 'date') is non-zero
      return lineConfigs.some(config => {
        const value = entry[config.dataKey];
        return value !== undefined && value !== 0;
      });
    });

    setMergedChartData(filteredData);
    setChartLineConfigs(lineConfigs);
  };

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [gyms, cyclesList] = await Promise.all([
        apiClient.getHomeGyms(),
        apiClient.getAnalyticsCycles(),
      ]);
      
      setHomeGyms(gyms);
      setCycles(cyclesList);
      
      // Default: activate cycle mode if active cycle exists
      if (cyclesList.activeCycle) {
        setCycleMode(true);
      }
    } catch (error) {
      console.error('Failed to load initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAnalyticsData = async () => {
    try {
      if (cycleMode) {
        await loadCycleModeData();
      } else {
        await loadTimeModeData();
      }
    } catch (error) {
      console.error('Failed to load analytics data:', error);
    }
  };

  const loadTimeModeData = async () => {
    const endDate = new Date().toISOString();
    const days = parseInt(timeFilter);
    const startDate = timeFilter === 'all'
      ? undefined
      : new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Get actual filter values (handle 'ALL')
    const muscles = selectedMuscles.includes('ALL') ? [undefined] : selectedMuscles.filter(m => m !== 'ALL') as MuscleGroup[];
    const equipment = selectedEquipment.includes('ALL') ? [undefined] : selectedEquipment.filter(e => e !== 'ALL') as Equipment[];

    // Generate all combinations and fetch data in parallel
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
                apiClient.getDurationAnalytics({
                  startDate,
                  endDate,
                  gymId: gymFilter,
                  muscleGroup: muscle,
                  equipment: equip,
                  aggregation: aggregationMode,
                })
              );
            }
          }
        } else {
          // All other views: use exerciseId filter
          filterCombinations.push({ view, muscle: undefined, equipment: undefined });

          if (view === 'volume') {
            allPromises.push(
              apiClient.getVolumeAnalytics({
                startDate,
                endDate,
                gymId: gymFilter,
                exerciseId: selectedExercise.id,
                aggregation: aggregationMode,
              })
            );
          } else if (view === 'rir') {
            allPromises.push(
              apiClient.getRIRAnalytics({
                startDate,
                endDate,
                gymId: gymFilter,
                exerciseId: selectedExercise.id,
                aggregation: aggregationMode,
              })
            );
          } else if (view === 'restTime') {
            allPromises.push(
              apiClient.getRestTimeAnalytics({
                startDate,
                endDate,
                gymId: gymFilter,
                exerciseId: selectedExercise.id,
                aggregation: aggregationMode,
              })
            );
          } else if (view === 'reps') {
            allPromises.push(
              apiClient.getRepsAnalytics({
                startDate,
                endDate,
                gymId: gymFilter,
                exerciseId: selectedExercise.id,
                aggregation: aggregationMode,
              })
            );
          } else if (view === 'sets') {
            allPromises.push(
              apiClient.getSetsAnalytics({
                startDate,
                endDate,
                gymId: gymFilter,
                exerciseId: selectedExercise.id,
                aggregation: aggregationMode,
              })
            );
          } else if (view === 'intensity') {
            allPromises.push(
              apiClient.getIntensityAnalytics({
                startDate,
                endDate,
                gymId: gymFilter,
                exerciseId: selectedExercise.id,
                aggregation: aggregationMode,
              })
            );
          }
        }
      } else {
        // No exercise filter: use existing muscle/equipment logic
        for (const muscle of muscles) {
          for (const equip of equipment) {
            filterCombinations.push({ view, muscle: muscle as MuscleGroup | undefined, equipment: equip as Equipment | undefined });

            // Add API call based on view type
            if (view === 'volume') {
              allPromises.push(
                apiClient.getVolumeAnalytics({
                  startDate,
                  endDate,
                  gymId: gymFilter,
                  muscleGroup: muscle,
                  equipment: equip,
                  aggregation: aggregationMode,
                })
              );
            } else if (view === 'rir') {
              allPromises.push(
                apiClient.getRIRAnalytics({
                  startDate,
                  endDate,
                  gymId: gymFilter,
                  muscleGroup: muscle,
                  equipment: equip,
                  aggregation: aggregationMode,
                })
              );
            } else if (view === 'duration') {
              allPromises.push(
                apiClient.getDurationAnalytics({
                  startDate,
                  endDate,
                  gymId: gymFilter,
                  muscleGroup: muscle,
                  equipment: equip,
                  aggregation: aggregationMode,
                })
              );
            } else if (view === 'restTime') {
              allPromises.push(
                apiClient.getRestTimeAnalytics({
                  startDate,
                  endDate,
                  gymId: gymFilter,
                  muscleGroup: muscle,
                  equipment: equip,
                  aggregation: aggregationMode,
                })
              );
            } else if (view === 'reps') {
              allPromises.push(
                apiClient.getRepsAnalytics({
                  startDate,
                  endDate,
                  gymId: gymFilter,
                  muscleGroup: muscle,
                  equipment: equip,
                  aggregation: aggregationMode,
                })
              );
            } else if (view === 'sets') {
              allPromises.push(
                apiClient.getSetsAnalytics({
                  startDate,
                  endDate,
                  gymId: gymFilter,
                  muscleGroup: muscle,
                  equipment: equip,
                  aggregation: aggregationMode,
                })
              );
            } else if (view === 'intensity') {
              allPromises.push(
                apiClient.getIntensityAnalytics({
                  startDate,
                  endDate,
                  gymId: gymFilter,
                  muscleGroup: muscle,
                  equipment: equip,
                  aggregation: aggregationMode,
                })
              );
            }
          }
        }
      }
    }

    // Fetch all data in parallel
    const results = await Promise.all(allPromises);

    // Merge all chart data for multi-line display
    mergeChartData(results, filterCombinations);

    // Also store in legacy state variables for backwards compatibility
    if (selectedViews.includes('volume') && results.length > 0) {
      const volumeResult = results.find((r, i) => filterCombinations[i].view === 'volume');
      if (volumeResult) {
        setVolumeData({
          ...volumeResult,
          dataPoints: volumeResult.dataPoints.filter((point: any) => point.volume > 0),
        });
      }
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
    if (selectedViews.includes('intensity')) {
      const intensityResult = results.find((r, i) => filterCombinations[i].view === 'intensity');
      if (intensityResult) setIntensityData(intensityResult);
    }

    // Fetch PRs separately
    const records = await apiClient.getPersonalRecords({
      muscleGroup: muscles[0],
      equipment: equipment[0],
      gymId: gymFilter,
    });
    setPrs(records.allTimePRs || []);
  };

  const loadCycleModeData = async () => {
    if (!cycles) return;

    // Get selected cycle
    const allCycles = [
      ...(cycles.activeCycle ? [cycles.activeCycle] : []),
      ...cycles.completedCycles,
    ];
    
    if (allCycles.length === 0) return;
    
    const selectedCycle = allCycles[selectedCycleIndex];

    // Get actual filter values (handle 'ALL')
    const muscles = selectedMuscles.includes('ALL') ? [undefined] : selectedMuscles.filter(m => m !== 'ALL') as MuscleGroup[];
    const equipment = selectedEquipment.includes('ALL') ? [undefined] : selectedEquipment.filter(e => e !== 'ALL') as Equipment[];

    // Generate all combinations and fetch data in parallel
    const allPromises: Promise<any>[] = [];
    const filterCombinations: Array<{
      view: string;
      muscle?: MuscleGroup;
      equipment?: Equipment;
    }> = [];

    // Cycle mode: cycleId alone puts every metric into cycle-anchored mode (§3.9) -- no more
    // separate "-by-cycle" methods, just the base method with `cycleId` set (the backend
    // derives the date range from the cycle itself, ignoring period/startDate/endDate).
    for (const view of selectedViews) {
      if (selectedExercise) {
        // Exercise filter mode: single iteration without muscle/equipment filters
        filterCombinations.push({ view, muscle: undefined, equipment: undefined });

        if (view === 'volume') {
          allPromises.push(
            apiClient.getVolumeAnalytics({
              gymId: gymFilter,
              exerciseId: selectedExercise.id,
              cycleId: selectedCycle.id,
              aggregation: aggregationMode,
            })
          );
        } else if (view === 'rir') {
          allPromises.push(
            apiClient.getRIRAnalytics({
              gymId: gymFilter,
              exerciseId: selectedExercise.id,
              cycleId: selectedCycle.id,
              aggregation: aggregationMode,
            })
          );
        } else if (view === 'duration') {
          allPromises.push(
            apiClient.getDurationAnalytics({
              gymId: gymFilter,
              cycleId: selectedCycle.id,
              aggregation: aggregationMode,
            })
          );
        } else if (view === 'restTime') {
          allPromises.push(
            apiClient.getRestTimeAnalytics({
              gymId: gymFilter,
              exerciseId: selectedExercise.id,
              cycleId: selectedCycle.id,
              aggregation: aggregationMode,
            })
          );
        } else if (view === 'reps') {
          allPromises.push(
            apiClient.getRepsAnalytics({
              exerciseId: selectedExercise.id,
              cycleId: selectedCycle.id,
              aggregation: aggregationMode,
            })
          );
        } else if (view === 'sets') {
          allPromises.push(
            apiClient.getSetsAnalytics({
              exerciseId: selectedExercise.id,
              cycleId: selectedCycle.id,
              aggregation: aggregationMode,
            })
          );
        } else if (view === 'intensity') {
          allPromises.push(
            apiClient.getIntensityAnalytics({
              gymId: gymFilter,
              exerciseId: selectedExercise.id,
              cycleId: selectedCycle.id,
              aggregation: aggregationMode,
            })
          );
        }
      } else {
        // No exercise filter: use existing muscle/equipment logic
        for (const muscle of muscles) {
          for (const equip of equipment) {
            filterCombinations.push({ view, muscle: muscle as MuscleGroup | undefined, equipment: equip as Equipment | undefined });

            // Add API call based on view type
            if (view === 'volume') {
              allPromises.push(
                apiClient.getVolumeAnalytics({
                  gymId: gymFilter,
                  muscleGroup: muscle,
                  equipment: equip,
                  cycleId: selectedCycle.id,
                  aggregation: aggregationMode,
                })
              );
            } else if (view === 'rir') {
              allPromises.push(
                apiClient.getRIRAnalytics({
                  gymId: gymFilter,
                  muscleGroup: muscle,
                  equipment: equip,
                  cycleId: selectedCycle.id,
                  aggregation: aggregationMode,
                })
              );
            } else if (view === 'duration') {
              allPromises.push(
                apiClient.getDurationAnalytics({
                  gymId: gymFilter,
                  cycleId: selectedCycle.id,
                  aggregation: aggregationMode,
                })
              );
            } else if (view === 'restTime') {
              allPromises.push(
                apiClient.getRestTimeAnalytics({
                  gymId: gymFilter,
                  muscleGroup: muscle,
                  equipment: equip,
                  cycleId: selectedCycle.id,
                  aggregation: aggregationMode,
                })
              );
            } else if (view === 'reps') {
              allPromises.push(
                apiClient.getRepsAnalytics({
                  muscleGroup: muscle,
                  equipment: equip,
                  cycleId: selectedCycle.id,
                  aggregation: aggregationMode,
                })
              );
            } else if (view === 'sets') {
              allPromises.push(
                apiClient.getSetsAnalytics({
                  muscleGroup: muscle,
                  equipment: equip,
                  cycleId: selectedCycle.id,
                  aggregation: aggregationMode,
                })
              );
            } else if (view === 'intensity') {
              allPromises.push(
                apiClient.getIntensityAnalytics({
                  gymId: gymFilter,
                  muscleGroup: muscle,
                  equipment: equip,
                  cycleId: selectedCycle.id,
                  aggregation: aggregationMode,
                })
              );
            }
          }
        }
      }
    }

    // Fetch all data in parallel
    const results = await Promise.all(allPromises);

    // Merge all chart data for multi-line display
    mergeChartData(results, filterCombinations);

    // Also store in legacy state variables for backwards compatibility
    if (selectedViews.includes('volume') && results.length > 0) {
      const volumeResult = results.find((r, i) => filterCombinations[i].view === 'volume');
      if (volumeResult) {
        setVolumeData({
          ...volumeResult,
          dataPoints: volumeResult.dataPoints.filter((point: any) => point.volume > 0),
        });
      }
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
    if (selectedViews.includes('intensity')) {
      const intensityResult = results.find((r, i) => filterCombinations[i].view === 'intensity');
      if (intensityResult) setIntensityData(intensityResult);
    }

    // Fetch PRs separately
    const records = await apiClient.getPersonalRecords({
      muscleGroup: muscles[0],
      equipment: equipment[0],
      gymId: gymFilter,
    });
    setPrs(records.allTimePRs || []);
  };

  const muscleGroups = [
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
  ];

  const equipments = [
    Equipment.CABLE,
    Equipment.MACHINE,
    Equipment.DUMBBELL,
    Equipment.BARBELL,
    Equipment.BODYWEIGHT,
    Equipment.SMITH_MACHINE,
    Equipment.EZ_BAR,
  ];

  const isActiveCycle = selectedCycle?.status === 'ACTIVE';

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                {t('heading')}
              </h2>

              {/* Filter Section - ALWAYS ON TOP (shadcn) */}
              <Card>
                <CardContent className="p-6 space-y-4">
                {/* Row 1: Cycle Mode Toggle + Time/Gym Filter */}
                <div className="flex flex-wrap gap-4 items-center">
                  {/* Cycle Mode Button */}
                  <Button
                    variant={cycleMode ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setCycleMode(!cycleMode);
                      setSelectedViews(['volume']); // Reset to volume when switching modes
                    }}
                  >
                    {t('cycleMode')}
                  </Button>

                  {/* Time Filter (only in Time Mode) */}
                  {!cycleMode && (
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-muted-foreground">
                        {t('timeRange')}
                      </label>
                      <select
                        value={timeFilter}
                        onChange={(e) => setTimeFilter(e.target.value)}
                        className="px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="7">{t('days', { count: 7 })}</option>
                        <option value="14">{t('days', { count: 14 })}</option>
                        <option value="30">{t('days', { count: 30 })}</option>
                        <option value="90">{t('days', { count: 90 })}</option>
                        <option value="180">{t('days', { count: 180 })}</option>
                        <option value="365">{t('oneYear')}</option>
                        <option value="all">{t('allTime')}</option>
                      </select>
                    </div>
                  )}

                  {/* Gym Filter */}
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      {t('gym')}
                    </label>
                    <select
                      value={gymFilter}
                      onChange={(e) => setGymFilter(e.target.value)}
                      className="px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="alle">{t('all')}</option>
                      {homeGyms.map((gym) => (
                        <option key={gym.id} value={gym.id}>
                          {gym.name}
                        </option>
                      ))}
                      <option value="andere">{t('otherGyms')}</option>
                    </select>
                  </div>
                </div>

                {/* Row 2: Cycle Navigation (only in Cycle Mode) */}
                {cycleMode && allCycles.length > 0 && (
                  <div className="flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setSelectedCycleIndex(Math.min(allCycles.length - 1, selectedCycleIndex + 1))}
                      disabled={selectedCycleIndex === allCycles.length - 1}
                      className="size-9"
                    >
                      <IconChevronLeft className="size-4" />
                    </Button>

                    <div className="text-center">
                      <div className="text-lg font-semibold text-foreground">
                        {selectedCycle?.name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(selectedCycle?.startDate || '', locale)}
                        {selectedCycle?.completedAt && ` - ${formatDate(selectedCycle.completedAt, locale)}`}
                        <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                          isActiveCycle
                            ? 'bg-foreground text-background'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {isActiveCycle ? t('active') : t('completed')}
                        </span>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setSelectedCycleIndex(Math.max(0, selectedCycleIndex - 1))}
                      disabled={selectedCycleIndex === 0}
                      className="size-9"
                    >
                      <IconChevronRight className="size-4" />
                    </Button>
                  </div>
                )}

                {/* Row 3: Aggregation Mode Toggle */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    {t('aggregation')}
                  </label>
                  <div className="flex gap-2">
                    <Button
                      variant={aggregationMode === 'day' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setAggregationMode('day')}
                    >
                      {t('daysToggle')}
                    </Button>
                    <Button
                      variant={aggregationMode === 'week' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setAggregationMode('week')}
                    >
                      {t('weeksToggle')}
                    </Button>
                  </div>
                </div>

                {/* Row 4: View Mode Buttons */}
                <div className="space-y-4">
                  {/* View Mode Buttons */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
                      {t('viewMax2')}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={selectedViews.includes('volume') ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleView('volume')}
                        disabled={
                          !selectedViews.includes('volume') && 
                          selectedViews.length >= calculateMaxAllowed('view')
                        }
                      >
                        {viewNames.volume}
                      </Button>
                      <Button
                        variant={selectedViews.includes('rir') ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleView('rir')}
                      >
                        {viewNames.rir}
                      </Button>
                      <Button
                        variant={selectedViews.includes('duration') ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleView('duration')}
                        disabled={
                          (!selectedViews.includes('duration') && selectedViews.length >= calculateMaxAllowed('view')) ||
                          !selectedMuscles.includes('ALL') ||
                          !selectedEquipment.includes('ALL')
                        }
                      >
                        {viewNames.duration}
                      </Button>
                      <Button
                        variant={selectedViews.includes('restTime') ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleView('restTime')}
                        disabled={
                          !selectedViews.includes('restTime') &&
                          selectedViews.length >= calculateMaxAllowed('view')
                        }
                      >
                        {t('restTimeView')}
                      </Button>
                      <Button
                        variant={selectedViews.includes('reps') ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleView('reps')}
                        disabled={
                          !selectedViews.includes('reps') &&
                          selectedViews.length >= calculateMaxAllowed('view')
                        }
                      >
                        {t('repsView')}
                      </Button>
                      <Button
                        variant={selectedViews.includes('sets') ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleView('sets')}
                        disabled={
                          !selectedViews.includes('sets') &&
                          selectedViews.length >= calculateMaxAllowed('view')
                        }
                      >
                        {viewNames.sets}
                      </Button>
                      <Button
                        variant={selectedViews.includes('intensity') ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleView('intensity')}
                        disabled={
                          !selectedViews.includes('intensity') &&
                          selectedViews.length >= calculateMaxAllowed('view')
                        }
                      >
                        {viewNames.intensity}
                      </Button>
                    </div>
                  </div>

                  {/* Muscle Group Buttons */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
                      {t('muscleGroup')}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={selectedMuscles.includes('ALL') ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleMuscle('ALL')}
                      >
                        {t('all')}
                      </Button>
                      {muscleGroups.map((mg) => {
                        const isSelected = selectedMuscles.includes(mg);
                        return (
                          <Button
                            key={mg}
                            variant={isSelected ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => toggleMuscle(mg)}
                          >
                            {translateMuscleGroup(mg)}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Equipment Buttons */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
                      {t('equipment')}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={selectedEquipment.includes('ALL') ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleEquipment('ALL')}
                      >
                        {t('all')}
                      </Button>
                      {equipments.map((eq) => {
                        const isSelected = selectedEquipment.includes(eq);
                        return (
                          <Button
                            key={eq}
                            variant={isSelected ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => toggleEquipment(eq)}
                          >
                            {translateEquipment(eq)}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Exercise Filter - Alternative to Muscle/Equipment (shadcn + large + icon) */}
                  <div className="border-t border-border pt-4">
                    <div className="text-center mb-3">
                      <span className="text-sm text-muted-foreground italic">{t('or')}</span>
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
                          aria-label={t('addExerciseFilter')}
                        >
                          <IconPlus className="size-7" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-lg text-muted-foreground">{t('loading')}</div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Multi-Line Chart (when multiple views are selected) - now using central AnalyticsChart */}
                {selectedViews.length > 1 && mergedChartData.length > 0 && chartLineConfigs.length > 0 && (
                  <AnalyticsChart
                    data={mergedChartData}
                    title={t('comparisonView')}
                    height={400}
                    isComparison={true}
                    lineConfigs={chartLineConfigs}
                    locale={locale}
                    formatWorkoutCount={(count) => t('workoutCount', { count })}
                  />
                )}

                {/* Volume Chart - using central AnalyticsChart */}
                {selectedViews.length === 1 && selectedViews.includes('volume') && volumeData && volumeData.dataPoints.length > 0 && (
                  <AnalyticsChart
                    data={volumeData.dataPoints}
                    title={t('volumeProgression')}
                    height={300}
                    chartType="line"
                    dataKey="volume"
                    name={viewNames.volume}
                    stroke={CHART_ACCENT}
                    yAxisTickFormatter={(value) => `${formatNumber(value, locale)}`}
                    yAxisLabel="kg"
                    locale={locale}
                    formatWorkoutCount={(count) => t('workoutCount', { count })}
                    footer={
                      <div className="mt-4 text-center">
                        <div className="text-sm text-muted-foreground">
                          {t('totalVolume')}
                        </div>
                        <div className="text-2xl font-bold text-foreground">
                          {formatNumber(volumeData.totalVolume, locale)} kg
                        </div>
                      </div>
                    }
                  />
                )}

                {/* RIR Chart (Cycle Mode) */}
                {selectedViews.length === 1 && cycleMode && selectedViews.includes('rir') && (
                  <div className="bg-card border rounded-lg p-6">
                    {rirData && rirData.dataPoints.length > 0 ? (
                      <AnalyticsChart
                        data={rirData.dataPoints}
                        title={t('rirDistribution')}
                        height={300}
                        chartType="bar"
                        yAxisLabel={t('count')}
                        locale={locale}
                        formatWorkoutCount={(count) => t('workoutCount', { count })}
                        children={
                          <>
                            <Bar dataKey="rir0Count" fill={getRIRBarFill(0)} name="RIR 0" />
                            <Bar dataKey="rir1Count" fill={getRIRBarFill(1)} name="RIR 1" />
                            <Bar dataKey="rir2Count" fill={getRIRBarFill(2)} name="RIR 2" />
                          </>
                        }
                        footer={
                          <div className="mt-4 text-center">
                            <div className="text-sm text-muted-foreground">
                              {t('totalSetsCycle')}
                            </div>
                            <div className="text-2xl font-bold text-foreground">
                              {format.number(rirData.totalSets)}
                            </div>
                          </div>
                        }
                      />
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">
                          {t('noRirData')}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* RIR Chart (Time Mode) */}
                {selectedViews.length === 1 && !cycleMode && selectedViews.includes('rir') && (
                  <div className="bg-card border rounded-lg p-6">
                    {rirData && rirData.dataPoints.length > 0 ? (
                      <AnalyticsChart
                        data={rirData.dataPoints}
                        title={t('rirDistribution')}
                        height={300}
                        chartType="bar"
                        yAxisLabel={t('count')}
                        locale={locale}
                        formatWorkoutCount={(count) => t('workoutCount', { count })}
                        children={
                          <>
                            <Bar dataKey="rir0Count" fill={getRIRBarFill(0)} name="RIR 0" />
                            <Bar dataKey="rir1Count" fill={getRIRBarFill(1)} name="RIR 1" />
                            <Bar dataKey="rir2Count" fill={getRIRBarFill(2)} name="RIR 2" />
                          </>
                        }
                        footer={
                          <div className="mt-4 text-center">
                            <div className="text-sm text-muted-foreground">
                              {t('totalSets')}
                            </div>
                            <div className="text-2xl font-bold text-foreground">
                              {format.number(rirData.totalSets)}
                            </div>
                          </div>
                        }
                      />
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">
                          {t('noRirData')}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Duration Chart (Time Mode) */}
                {selectedViews.length === 1 && !cycleMode && selectedViews.includes('duration') && (
                  <div className="bg-card border rounded-lg p-6">
                    {!selectedMuscles.includes('ALL') || !selectedEquipment.includes('ALL') ? (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">
                          {t('durationWholeWorkout')}
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                          {t('selectAllMuscleEquipment')}
                        </p>
                      </div>
                    ) : durationData && durationData.dataPoints.length > 0 ? (
                      <AnalyticsChart
                        data={durationData.dataPoints}
                        title={t('workoutDuration')}
                        height={300}
                        chartType="line"
                        dataKey="duration"
                        name={viewNames.duration}
                        stroke={CHART_ACCENT}
                        yAxisTickFormatter={(value) => `${value}`}
                        yAxisLabel={t('minutes')}
                        locale={locale}
                        formatWorkoutCount={(count) => t('workoutCount', { count })}
                        footer={
                          <div className="mt-4 text-center">
                            <div className="text-sm text-muted-foreground">
                              {t('averageDuration')}
                            </div>
                            <div className="text-2xl font-bold text-foreground">
                              {format.number(Math.round(
                                durationData.dataPoints.reduce((sum, point) => sum + point.duration, 0) /
                                  durationData.dataPoints.length
                              ))} min
                            </div>
                          </div>
                        }
                      />
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">
                          {t('noDurationData')}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Duration Chart (Cycle Mode) */}
                {selectedViews.length === 1 && cycleMode && selectedViews.includes('duration') && (
                  <div className="bg-card border rounded-lg p-6">
                    {!selectedMuscles.includes('ALL') || !selectedEquipment.includes('ALL') ? (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">
                          {t('durationWholeWorkout')}
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                          {t('selectAllMuscleEquipment')}
                        </p>
                      </div>
                    ) : durationData && durationData.dataPoints.length > 0 ? (
                      <AnalyticsChart
                        data={durationData.dataPoints}
                        title={t('workoutDuration')}
                        height={300}
                        chartType="line"
                        dataKey="duration"
                        name={viewNames.duration}
                        stroke={CHART_ACCENT}
                        yAxisTickFormatter={(value) => `${value}`}
                        yAxisLabel={t('minutes')}
                        locale={locale}
                        formatWorkoutCount={(count) => t('workoutCount', { count })}
                        footer={
                          <div className="mt-4 text-center">
                            <div className="text-sm text-muted-foreground">
                              {t('averageDuration')}
                            </div>
                            <div className="text-2xl font-bold text-foreground">
                              {format.number(Math.round(
                                durationData.dataPoints.reduce((sum, point) => sum + point.duration, 0) /
                                  durationData.dataPoints.length
                              ))} min
                            </div>
                          </div>
                        }
                      />
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">
                          {t('noDurationData')}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* RestTime Chart (Time Mode) */}
                {selectedViews.length === 1 && !cycleMode && selectedViews.includes('restTime') && (
                  <div className="bg-card border rounded-lg p-6">
                    {restTimeData && restTimeData.dataPoints.length > 0 ? (
                      <AnalyticsChart
                        data={restTimeData.dataPoints}
                        title={t('averageRestTime')}
                        height={300}
                        chartType="line"
                        dataKey="averageRestTime"
                        name={t('restTimeView')}
                        stroke={CHART_ACCENT}
                        yAxisTickFormatter={(value) => `${value}`}
                        yAxisLabel={t('seconds')}
                        locale={locale}
                        formatWorkoutCount={(count) => t('workoutCount', { count })}
                        footer={
                          <div className="mt-4 text-center">
                            <div className="text-sm text-muted-foreground">
                              {t('averagePause')}
                            </div>
                            <div className="text-2xl font-bold text-foreground">
                              {format.number(restTimeData.overallAverage)}s
                            </div>
                          </div>
                        }
                      />
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">
                          {t('noRestTimeData')}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* RestTime Chart (Cycle Mode) */}
                {selectedViews.length === 1 && cycleMode && selectedViews.includes('restTime') && (
                  <div className="bg-card border rounded-lg p-6">
                    {restTimeData && restTimeData.dataPoints.length > 0 ? (
                      <AnalyticsChart
                        data={restTimeData.dataPoints}
                        title={t('averageRestTime')}
                        height={300}
                        chartType="line"
                        dataKey="averageRestTime"
                        name={t('restTimeView')}
                        stroke={CHART_ACCENT}
                        yAxisTickFormatter={(value) => `${value}`}
                        yAxisLabel={t('seconds')}
                        locale={locale}
                        formatWorkoutCount={(count) => t('workoutCount', { count })}
                        footer={
                          <div className="mt-4 text-center">
                            <div className="text-sm text-muted-foreground">
                              {t('averagePause')}
                            </div>
                            <div className="text-2xl font-bold text-foreground">
                              {format.number(restTimeData.overallAverage)}s
                            </div>
                          </div>
                        }
                      />
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">
                          {t('noRestTimeData')}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Reps Chart (Time Mode) */}
                {selectedViews.length === 1 && !cycleMode && selectedViews.includes('reps') && (
                  <div className="bg-card border rounded-lg p-6">
                    {repsData && repsData.dataPoints.length > 0 ? (
                      <AnalyticsChart
                        data={repsData.dataPoints}
                        title={t('repsPerWorkout')}
                        height={300}
                        chartType="line"
                        dataKey="reps"
                        name={t('repsView')}
                        stroke={CHART_ACCENT}
                        yAxisTickFormatter={(value) => `${value}`}
                        yAxisLabel={t('repsView')}
                        locale={locale}
                        formatWorkoutCount={(count) => t('workoutCount', { count })}
                        footer={
                          <div className="mt-4 grid grid-cols-2 gap-4 text-center">
                            <div>
                              <div className="text-sm text-muted-foreground">
                                {t('total')}
                              </div>
                              <div className="text-2xl font-bold text-foreground">
                                {formatNumber(repsData.totalReps, locale)}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground">
                                {t('avgPerWorkout')}
                              </div>
                              <div className="text-2xl font-bold text-foreground">
                                {formatNumber(repsData.averageReps, locale)}
                              </div>
                            </div>
                          </div>
                        }
                      />
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">
                          {t('noRepsData')}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Sets Chart (Time Mode) */}
                {selectedViews.length === 1 && !cycleMode && selectedViews.includes('sets') && (
                  <div className="bg-card border rounded-lg p-6">
                    {setsData && setsData.dataPoints.length > 0 ? (
                      <AnalyticsChart
                        data={setsData.dataPoints}
                        title={t('workingSetsPerWorkout')}
                        height={300}
                        chartType="line"
                        dataKey="sets"
                        name={viewNames.sets}
                        stroke={CHART_ACCENT}
                        yAxisTickFormatter={(value) => `${value}`}
                        yAxisLabel={viewNames.sets}
                        locale={locale}
                        formatWorkoutCount={(count) => t('workoutCount', { count })}
                        footer={
                          <div className="mt-4 grid grid-cols-2 gap-4 text-center">
                            <div>
                              <div className="text-sm text-muted-foreground">
                                {t('total')}
                              </div>
                              <div className="text-2xl font-bold text-foreground">
                                {formatNumber(setsData.totalSets, locale)}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground">
                                {t('avgPerWorkout')}
                              </div>
                              <div className="text-2xl font-bold text-foreground">
                                {formatNumber(setsData.averageSets, locale)}
                              </div>
                            </div>
                          </div>
                        }
                      />
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">
                          {t('noSetsData')}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Intensity Chart (Time Mode) */}
                {selectedViews.length === 1 && !cycleMode && selectedViews.includes('intensity') && (
                  <div className="bg-card border rounded-lg p-6">
                    {intensityData && intensityData.dataPoints.length > 0 ? (
                      <AnalyticsChart
                        data={intensityData.dataPoints}
                        title={t('intensityPerWorkout')}
                        height={300}
                        chartType="line"
                        dataKey="intensity"
                        name={viewNames.intensity}
                        stroke={CHART_ACCENT}
                        yAxisTickFormatter={(value) => `${value}`}
                        yAxisLabel="%"
                        locale={locale}
                        formatWorkoutCount={(count) => t('workoutCount', { count })}
                        footer={
                          <div className="mt-4 text-center">
                            <div className="text-sm text-muted-foreground">
                              {t('averageIntensity')}
                            </div>
                            <div className="text-2xl font-bold text-foreground">
                              {formatNumber(intensityData.averageIntensity, locale)}%
                            </div>
                          </div>
                        }
                      />
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">
                          {t('noIntensityData')}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Reps Chart (Cycle Mode) */}
                {selectedViews.length === 1 && cycleMode && selectedViews.includes('reps') && (
                  <div className="bg-card border rounded-lg p-6">
                    {repsData && repsData.dataPoints.length > 0 ? (
                      <AnalyticsChart
                        data={repsData.dataPoints}
                        title={t('repsPerWorkout')}
                        height={300}
                        chartType="line"
                        dataKey="reps"
                        name={t('repsView')}
                        stroke={CHART_ACCENT}
                        yAxisTickFormatter={(value) => `${value}`}
                        yAxisLabel={t('repsView')}
                        locale={locale}
                        formatWorkoutCount={(count) => t('workoutCount', { count })}
                        footer={
                          <div className="mt-4 grid grid-cols-2 gap-4 text-center">
                            <div>
                              <div className="text-sm text-muted-foreground">
                                {t('total')}
                              </div>
                              <div className="text-2xl font-bold text-foreground">
                                {formatNumber(repsData.totalReps, locale)}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground">
                                {t('avgPerWorkout')}
                              </div>
                              <div className="text-2xl font-bold text-foreground">
                                {formatNumber(repsData.averageReps, locale)}
                              </div>
                            </div>
                          </div>
                        }
                      />
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">
                          {t('noRepsData')}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Sets Chart (Cycle Mode) */}
                {selectedViews.length === 1 && cycleMode && selectedViews.includes('sets') && (
                  <div className="bg-card border rounded-lg p-6">
                    {setsData && setsData.dataPoints.length > 0 ? (
                      <AnalyticsChart
                        data={setsData.dataPoints}
                        title={t('workingSetsPerWorkout')}
                        height={300}
                        chartType="line"
                        dataKey="sets"
                        name={viewNames.sets}
                        stroke={CHART_ACCENT}
                        yAxisTickFormatter={(value) => `${value}`}
                        yAxisLabel={viewNames.sets}
                        locale={locale}
                        formatWorkoutCount={(count) => t('workoutCount', { count })}
                        footer={
                          <div className="mt-4 grid grid-cols-2 gap-4 text-center">
                            <div>
                              <div className="text-sm text-muted-foreground">
                                {t('total')}
                              </div>
                              <div className="text-2xl font-bold text-foreground">
                                {formatNumber(setsData.totalSets, locale)}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground">
                                {t('avgPerWorkout')}
                              </div>
                              <div className="text-2xl font-bold text-foreground">
                                {formatNumber(setsData.averageSets, locale)}
                              </div>
                            </div>
                          </div>
                        }
                      />
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">
                          {t('noSetsData')}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Intensity Chart (Cycle Mode) */}
                {selectedViews.length === 1 && cycleMode && selectedViews.includes('intensity') && (
                  <div className="bg-card border rounded-lg p-6">
                    {intensityData && intensityData.dataPoints.length > 0 ? (
                      <AnalyticsChart
                        data={intensityData.dataPoints}
                        title={t('intensityPerWorkout')}
                        height={300}
                        chartType="line"
                        dataKey="intensity"
                        name={viewNames.intensity}
                        stroke={CHART_ACCENT}
                        yAxisTickFormatter={(value) => `${value}`}
                        yAxisLabel="%"
                        locale={locale}
                        formatWorkoutCount={(count) => t('workoutCount', { count })}
                        footer={
                          <div className="mt-4 text-center">
                            <div className="text-sm text-muted-foreground">
                              {t('averageIntensity')}
                            </div>
                            <div className="text-2xl font-bold text-foreground">
                              {formatNumber(intensityData.averageIntensity, locale)}%
                            </div>
                          </div>
                        }
                      />
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">
                          {t('noIntensityData')}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Muscle Distribution - alternative to pie (horizontal bars, clean even with many groups) */}
                {selectedViews.includes('volume') && selectedMuscles.includes('ALL') && volumeData && volumeData.byMuscleGroup && volumeData.byMuscleGroup.length > 0 && (
                  <Card>
                    <CardContent className="p-6">
                      <h3 className="text-lg font-semibold text-foreground mb-4">
                        {t('muscleGroupDistribution')}
                      </h3>
                      <div className="space-y-3">
                        {[...volumeData.byMuscleGroup]
                          .sort((a, b) => b.percentage - a.percentage)
                          .map((mg) => {
                            const pct = Math.round(mg.percentage);
                            return (
                              <div key={mg.muscleGroup} className="flex items-center gap-3">
                                <div className="w-28 text-sm text-foreground truncate" title={translateMuscleGroup(mg.muscleGroup)}>
                                  {translateMuscleGroup(mg.muscleGroup)}
                                </div>
                                <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-foreground rounded-full transition-all"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <div className="w-12 text-right text-sm font-medium tabular-nums text-foreground">
                                  {format.number(pct)}%
                                </div>
                                <div className="w-20 text-right text-xs text-muted-foreground tabular-nums">
                                  {formatNumber(mg.volume, locale)} kg
                                </div>
                              </div>
                            );
                          })}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-3">{t('sortedByShare')}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Ernährungs-Analytics (#153) -- reuses the range selector above, or the
                    selected cycle's own span in Zyklus-Modus. Placed ahead of the Personal
                    Records / Empty State cards so it doesn't need a scroll past the workout
                    charts to reach. */}
                <NutritionTrendChart
                  trend={nutritionTrend}
                  rangeLabel={nutritionRangeLabelFor(cycleMode, selectedCycle, timeFilter, t, locale)}
                  loading={nutritionLoading}
                />

                {/* Personal Records (only for Home Gyms) */}
                {gymFilter !== 'andere' && (
                  <Card>
                    <div className="px-6 py-4 border-b border-border">
                      <h3 className="text-lg font-semibold text-foreground">
                        {t('personalRecords')}
                      </h3>
                    </div>

                    <CardContent className="p-6">
                      {prs.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {prs.map((pr) => (
                            <PersonalRecordCard
                              key={`${pr.exerciseId}-${pr.type}`}
                              pr={pr}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-center py-8">
                          {!selectedMuscles.includes('ALL') || !selectedEquipment.includes('ALL')
                            ? t('noPersonalRecordsFiltered')
                            : t('noPersonalRecordsYet')}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Empty State */}
                {(!volumeData || volumeData.dataPoints.length === 0) && (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <p className="text-muted-foreground">
                        {t('noTrainingDataYet')}
                      </p>
                      <Link
                        href="/workout"
                        className="mt-4 inline-block text-primary hover:underline"
                      >
                        {t('toWorkoutArrow')}
                      </Link>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
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
