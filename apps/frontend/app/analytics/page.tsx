'use client';

/* eslint-disable @typescript-eslint/no-explicit-any -- Analytics data layer uses flexible any for API responses and recharts data (pre-existing, preserved during UI refactor) */

import { ProtectedRoute } from '@/components/protected-route';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import {
  VolumeAnalytics,
  PersonalRecord,
  MuscleGroup,
  Equipment,
  HomeGym,
  CycleList,
  ORMByCycleAnalytics,
  RIRByCycleAnalytics,
  RIRAnalytics,
  DurationAnalytics,
  DurationByCycleAnalytics,
  RestTimeAnalytics,
  RestTimeByCycleAnalytics,
  RepsAnalytics,
  RepsByCycleAnalytics,
  SetsAnalytics,
  SetsByCycleAnalytics,
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
import ExerciseSelectionModal from '@/components/workout/exercise-selection-modal';
import SelectedExerciseCard from '@/components/analytics/selected-exercise-card';
import ScrollableChart from '@/components/analytics/scrollable-chart';
import AnalyticsChart from '@/components/analytics/AnalyticsChart';
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

export default function AnalyticsPage() {
  // Data states
  const [volumeData, setVolumeData] = useState<VolumeAnalytics | null>(null);
  const [ormData, setOrmData] = useState<ORMByCycleAnalytics | null>(null);
  const [rirData, setRirData] = useState<RIRByCycleAnalytics | RIRAnalytics | null>(null);
  const [durationData, setDurationData] = useState<DurationByCycleAnalytics | DurationAnalytics | null>(null);
  const [restTimeData, setRestTimeData] = useState<RestTimeByCycleAnalytics | RestTimeAnalytics | null>(null);
  const [repsData, setRepsData] = useState<RepsByCycleAnalytics | RepsAnalytics | null>(null);
  const [setsData, setSetsData] = useState<SetsByCycleAnalytics | SetsAnalytics | null>(null);
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
  const [selectedViews, setSelectedViews] = useState<Array<'volume' | 'orm' | 'rir' | 'duration' | 'restTime' | 'reps' | 'sets'>>(['volume']);
  const [selectedMuscles, setSelectedMuscles] = useState<(MuscleGroup | 'ALL')[]>(['ALL']);
  const [selectedEquipment, setSelectedEquipment] = useState<(Equipment | 'ALL')[]>(['ALL']);
  
  // Filter states
  const [timeFilter, setTimeFilter] = useState('7');
  const [gymFilter, setGymFilter] = useState('alle');
  
  // Exercise filter state
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  
  // Cycle navigation
  const [selectedCycleIndex, setSelectedCycleIndex] = useState<number>(0);

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Reload analytics when filters change
  useEffect(() => {
    if (!loading) {
      loadAnalyticsData();
    }
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
  const toggleView = (view: 'volume' | 'orm' | 'rir' | 'duration' | 'restTime' | 'reps' | 'sets') => {
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

  // Translation helpers
  const translateMuscleGroup = (mg: string): string => {
    const translations: Record<string, string> = {
      // Legacy groups (kept for backwards compatibility)
      CHEST: 'Brust',
      BACK: 'Rücken',
      LEGS: 'Beine',
      SHOULDERS: 'Schultern',
      BICEPS: 'Bizeps',
      TRICEPS: 'Trizeps',
      ABS: 'Bauch',
      FOREARMS: 'Unterarme',
      // New granular muscle groups
      ABDOMEN: 'Bauch',
      LATISSIMUS: 'Latissimus',
      TRAPEZIUS: 'Trapez',
      LOWER_BACK: 'Unterer Rücken',
      HAMSTRINGS: 'Beinbeuger',
      GLUTES: 'Glutes',
      QUADRICEPS: 'Quadrizeps',
      CALVES: 'Waden',
    };
    return translations[mg] || mg;
  };

  const translateEquipment = (eq: Equipment): string => {
    const translations: Record<Equipment, string> = {
      CABLE: 'Kabel',
      MACHINE: 'Maschine',
      DUMBBELL: 'Kurzhantel',
      BARBELL: 'Langhantel',
      BODYWEIGHT: 'Körpergewicht',
      SMITH_MACHINE: 'Smith-Maschine',
      EZ_BAR: 'SZ-Stange',
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
      volume: 'Volumen',
      orm: 'ORM%',
      rir: 'RIR',
      duration: 'Dauer',
      restTime: 'Pause',
      reps: 'Wdh',
      sets: 'Sätze',
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
      orm: { unit: '%', yAxisId: 'left' }, // Y-axis assigned dynamically in mergeChartData
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
          else if (combo.view === 'orm') value = point.percentORM || point.averageOrmPercentage; // Cycle mode uses percentORM
          else if (combo.view === 'rir') value = point.rir0Count || 0;
          else if (combo.view === 'duration') value = point.duration;
          else if (combo.view === 'restTime') value = point.averageRestTime;
          else if (combo.view === 'reps') value = point.reps;
          else if (combo.view === 'sets') value = point.sets;

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

    for (const view of selectedViews) {
      if (selectedExercise) {
        // Exercise filter mode: single iteration without muscle/equipment filters (except duration)
        if (view === 'duration') {
          // Duration analytics: keep existing logic unchanged
          for (const muscle of muscles) {
            for (const equip of equipment) {
              filterCombinations.push({ view, muscle: muscle as MuscleGroup | undefined, equipment: equip as Equipment | undefined });
              allPromises.push(
                apiClient.getDurationByCycle(
                  selectedCycle.id,
                  gymFilter,
                  muscle,
                  equip,
                  aggregationMode,
                )
              );
            }
          }
        } else {
          // All other views: use exerciseId filter
          filterCombinations.push({ view, muscle: undefined, equipment: undefined });

          if (view === 'volume') {
            // For volume in cycle mode, use time-based with cycle date range
            const cycleStart = new Date(selectedCycle.startDate).toISOString();
            const cycleEnd = selectedCycle.completedAt
              ? new Date(selectedCycle.completedAt).toISOString()
              : undefined;

            allPromises.push(
              apiClient.getVolumeAnalytics({
                startDate: cycleStart,
                endDate: cycleEnd,
                gymId: gymFilter,
                exerciseId: selectedExercise.id,
                cycleId: selectedCycle.id,
                aggregation: aggregationMode,
              })
            );
          } else if (view === 'orm') {
            allPromises.push(
              apiClient.getORMByCycle(
                selectedCycle.id,
                undefined,
                undefined,
                aggregationMode,
                selectedExercise.id,
              )
            );
          } else if (view === 'rir') {
            allPromises.push(
              apiClient.getRIRByCycle(
                selectedCycle.id,
                gymFilter,
                undefined,
                undefined,
                selectedExercise.id,
                aggregationMode,
              )
            );
          } else if (view === 'restTime') {
            allPromises.push(
              apiClient.getRestTimeByCycle(
                selectedCycle.id,
                gymFilter,
                undefined,
                undefined,
                aggregationMode,
                selectedExercise.id,
              )
            );
          } else if (view === 'reps') {
            allPromises.push(
              apiClient.getRepsByCycle(
                selectedCycle.id,
                undefined,
                undefined,
                aggregationMode,
                selectedExercise.id,
              )
            );
          } else if (view === 'sets') {
            allPromises.push(
              apiClient.getSetsByCycle(
                selectedCycle.id,
                undefined,
                undefined,
                aggregationMode,
                selectedExercise.id,
              )
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
              // For volume in cycle mode, use time-based with cycle date range
              const cycleStart = new Date(selectedCycle.startDate).toISOString();
              const cycleEnd = selectedCycle.completedAt
                ? new Date(selectedCycle.completedAt).toISOString()
                : undefined;

              allPromises.push(
                apiClient.getVolumeAnalytics({
                  startDate: cycleStart,
                  endDate: cycleEnd,
                  gymId: gymFilter,
                  muscleGroup: muscle,
                  equipment: equip,
                  cycleId: selectedCycle.id,
                  aggregation: aggregationMode,
                })
              );
            } else if (view === 'orm') {
              allPromises.push(
                apiClient.getORMByCycle(
                  selectedCycle.id,
                  muscle,
                  equip,
                  aggregationMode,
                )
              );
            } else if (view === 'rir') {
              allPromises.push(
                apiClient.getRIRByCycle(
                  selectedCycle.id,
                  gymFilter,
                  muscle,
                  equip,
                  undefined,
                  aggregationMode,
                )
              );
            } else if (view === 'duration') {
              allPromises.push(
                apiClient.getDurationByCycle(
                  selectedCycle.id,
                  gymFilter,
                  muscle,
                  equip,
                  aggregationMode,
                )
              );
            } else if (view === 'restTime') {
              allPromises.push(
                apiClient.getRestTimeByCycle(
                  selectedCycle.id,
                  gymFilter,
                  muscle,
                  equip,
                  aggregationMode,
                )
              );
            } else if (view === 'reps') {
              allPromises.push(
                apiClient.getRepsByCycle(
                  selectedCycle.id,
                  muscle,
                  equip,
                  aggregationMode,
                )
              );
            } else if (view === 'sets') {
              allPromises.push(
                apiClient.getSetsByCycle(
                  selectedCycle.id,
                  muscle,
                  equip,
                  aggregationMode,
                )
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

  const allCycles = cycles
    ? [...(cycles.activeCycle ? [cycles.activeCycle] : []), ...cycles.completedCycles]
    : [];
  const selectedCycle = allCycles[selectedCycleIndex];
  const isActiveCycle = selectedCycle?.status === 'ACTIVE';

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Trainingsanalyse
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
                    Zyklus-Modus
                  </Button>

                  {/* Time Filter (only in Time Mode) */}
                  {!cycleMode && (
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-muted-foreground">
                        Zeitraum:
                      </label>
                      <select
                        value={timeFilter}
                        onChange={(e) => setTimeFilter(e.target.value)}
                        className="px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="7">7 Tage</option>
                        <option value="14">14 Tage</option>
                        <option value="30">30 Tage</option>
                        <option value="90">90 Tage</option>
                        <option value="180">180 Tage</option>
                        <option value="365">1 Jahr</option>
                        <option value="all">Alle</option>
                      </select>
                    </div>
                  )}

                  {/* Gym Filter (hidden in Cycle Mode when ORM is selected) */}
                  {!(cycleMode && selectedViews.includes('orm')) && (
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-muted-foreground">
                        Gym:
                      </label>
                      <select
                        value={gymFilter}
                        onChange={(e) => setGymFilter(e.target.value)}
                        className="px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="alle">Alle</option>
                        {homeGyms.map((gym) => (
                          <option key={gym.id} value={gym.id}>
                            {gym.name}
                          </option>
                        ))}
                        <option value="andere">Andere Gyms</option>
                      </select>
                    </div>
                  )}
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
                        {formatDate(selectedCycle?.startDate || '')}
                        {selectedCycle?.completedAt && ` - ${formatDate(selectedCycle.completedAt)}`}
                        <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                          isActiveCycle 
                            ? 'bg-foreground text-background' 
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {isActiveCycle ? 'Aktiv' : 'Abgeschlossen'}
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
                    Aggregation:
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

                {/* Row 4: View Mode Buttons */}
                <div className="space-y-4">
                  {/* View Mode Buttons */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Ansicht (max. 2):
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
                        Volumen
                      </Button>
                      {cycleMode && (
                        <Button
                          variant={selectedViews.includes('orm') ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleView('orm')}
                          disabled={
                            !selectedViews.includes('orm') && 
                            selectedViews.length >= calculateMaxAllowed('view')
                          }
                        >
                          %ORM
                        </Button>
                      )}
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
                        disabled={
                          (!selectedViews.includes('duration') && selectedViews.length >= calculateMaxAllowed('view')) ||
                          !selectedMuscles.includes('ALL') || 
                          !selectedEquipment.includes('ALL')
                        }
                      >
                        Dauer
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
                        Satzpause
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
                        Wiederholungen
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
                        Sätze
                      </Button>
                    </div>
                  </div>

                  {/* Muscle Group Buttons */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Muskelgruppe:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={selectedMuscles.includes('ALL') ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleMuscle('ALL')}
                      >
                        Alle
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
                      Equipment:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={selectedEquipment.includes('ALL') ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleEquipment('ALL')}
                      >
                        Alle
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
              </CardContent>
            </Card>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-lg text-muted-foreground">Lädt Analytics...</div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Multi-Line Chart (when multiple views are selected) - now using central AnalyticsChart */}
                {selectedViews.length > 1 && mergedChartData.length > 0 && chartLineConfigs.length > 0 && (
                  <AnalyticsChart
                    data={mergedChartData}
                    title="Vergleichsansicht"
                    height={400}
                    isComparison={true}
                    lineConfigs={chartLineConfigs}
                  />
                )}
                
                {/* Volume Chart - using central AnalyticsChart */}
                {selectedViews.length === 1 && selectedViews.includes('volume') && volumeData && volumeData.dataPoints.length > 0 && (
                  <AnalyticsChart
                    data={volumeData.dataPoints}
                    title="Volumen-Entwicklung"
                    height={300}
                    chartType="line"
                    dataKey="volume"
                    name="Volumen"
                    stroke={CHART_ACCENT}
                    yAxisTickFormatter={(value) => `${formatNumber(value)}kg`}
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

                {/* ORM Chart (only in Cycle Mode) */}
                {selectedViews.length === 1 && cycleMode && selectedViews.includes('orm') && (
                  <div className="bg-card border rounded-lg p-6">
                    {gymFilter === 'andere' ? (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">
                          %ORM Tracking ist nur für Home Gym Workouts verfügbar.
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                          Bitte wähle ein Home Gym oder &apos;Alle&apos; aus.
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
                        yAxisTickFormatter={(value) => `${value}%`}
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

                {/* RIR Chart (Cycle Mode) */}
                {selectedViews.length === 1 && cycleMode && selectedViews.includes('rir') && (
                  <div className="bg-card border rounded-lg p-6">
                    {rirData && rirData.dataPoints.length > 0 ? (
                      <AnalyticsChart
                        data={rirData.dataPoints}
                        title="RIR-Verteilung"
                        height={300}
                        chartType="bar"
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
                              Gesamte Sets
                            </div>
                            <div className="text-2xl font-bold text-foreground">
                              {rirData.totalSets}
                            </div>
                          </div>
                        }
                      />
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">
                          Keine RIR Daten verfügbar für die ausgewählten Filter.
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
                        title="RIR-Verteilung"
                        height={300}
                        chartType="bar"
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
                              Gesamte Sätze
                            </div>
                            <div className="text-2xl font-bold text-foreground">
                              {rirData.totalSets}
                            </div>
                          </div>
                        }
                      />
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">
                          Keine RIR Daten verfügbar für die ausgewählten Filter.
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
                          Workout-Dauer bezieht sich auf das gesamte Training.
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                          Bitte wähle &apos;Alle&apos; bei Muskelgruppe und Equipment aus.
                        </p>
                      </div>
                    ) : durationData && durationData.dataPoints.length > 0 ? (
                      <AnalyticsChart
                        data={durationData.dataPoints}
                        title="Workout-Dauer"
                        height={300}
                        chartType="line"
                        dataKey="duration"
                        name="Dauer"
                        stroke={CHART_ACCENT}
                        yAxisTickFormatter={(value) => `${value} min`}
                        yAxisLabel="Minuten"
                        footer={
                          <div className="mt-4 text-center">
                            <div className="text-sm text-muted-foreground">
                              Durchschnittliche Dauer
                            </div>
                            <div className="text-2xl font-bold text-foreground">
                              {Math.round(
                                durationData.dataPoints.reduce((sum, point) => sum + point.duration, 0) /
                                  durationData.dataPoints.length
                              )} min
                            </div>
                          </div>
                        }
                      />
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">
                          Keine Dauer-Daten verfügbar für die ausgewählten Filter.
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
                          Workout-Dauer bezieht sich auf das gesamte Training.
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                          Bitte wähle &apos;Alle&apos; bei Muskelgruppe und Equipment aus.
                        </p>
                      </div>
                    ) : durationData && durationData.dataPoints.length > 0 ? (
                      <AnalyticsChart
                        data={durationData.dataPoints}
                        title="Workout-Dauer"
                        height={300}
                        chartType="line"
                        dataKey="duration"
                        name="Dauer"
                        stroke={CHART_ACCENT}
                        yAxisTickFormatter={(value) => `${value} min`}
                        yAxisLabel="Minuten"
                        footer={
                          <div className="mt-4 text-center">
                            <div className="text-sm text-muted-foreground">
                              Durchschnittliche Dauer
                            </div>
                            <div className="text-2xl font-bold text-foreground">
                              {Math.round(
                                durationData.dataPoints.reduce((sum, point) => sum + point.duration, 0) /
                                  durationData.dataPoints.length
                              )} min
                            </div>
                          </div>
                        }
                      />
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">
                          Keine Dauer-Daten verfügbar für die ausgewählten Filter.
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
                        title="Durchschnittliche Satzpause"
                        height={300}
                        chartType="line"
                        dataKey="averageRestTime"
                        name="Satzpause"
                        stroke={CHART_ACCENT}
                        yAxisTickFormatter={(value) => `${value}s`}
                        yAxisLabel="Sekunden"
                        footer={
                          <div className="mt-4 text-center">
                            <div className="text-sm text-muted-foreground">
                              Durchschnittliche Pause
                            </div>
                            <div className="text-2xl font-bold text-foreground">
                              {restTimeData.overallAverage}s
                            </div>
                          </div>
                        }
                      />
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">
                          Keine Satzpausen-Daten verfügbar für die ausgewählten Filter.
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
                        title="Durchschnittliche Satzpause"
                        height={300}
                        chartType="line"
                        dataKey="averageRestTime"
                        name="Satzpause"
                        stroke={CHART_ACCENT}
                        yAxisTickFormatter={(value) => `${value}s`}
                        yAxisLabel="Sekunden"
                        footer={
                          <div className="mt-4 text-center">
                            <div className="text-sm text-muted-foreground">
                              Durchschnittliche Pause
                            </div>
                            <div className="text-2xl font-bold text-foreground">
                              {restTimeData.overallAverage}s
                            </div>
                          </div>
                        }
                      />
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">
                          Keine Satzpausen-Daten verfügbar für die ausgewählten Filter.
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
                        title="Wiederholungen pro Workout"
                        height={300}
                        chartType="line"
                        dataKey="reps"
                        name="Wiederholungen"
                        stroke={CHART_ACCENT}
                        yAxisTickFormatter={(value) => `${value}`}
                        yAxisLabel="Wiederholungen"
                        footer={
                          <div className="mt-4 grid grid-cols-2 gap-4 text-center">
                            <div>
                              <div className="text-sm text-muted-foreground">
                                Gesamt
                              </div>
                              <div className="text-2xl font-bold text-foreground">
                                {formatNumber(repsData.totalReps)}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground">
                                Ø pro Workout
                              </div>
                              <div className="text-2xl font-bold text-foreground">
                                {formatNumber(repsData.averageReps)}
                              </div>
                            </div>
                          </div>
                        }
                      />
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">
                          Keine Wiederholungs-Daten verfügbar für die ausgewählten Filter.
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
                        title="Arbeitssätze pro Workout"
                        height={300}
                        chartType="line"
                        dataKey="sets"
                        name="Sätze"
                        stroke={CHART_ACCENT}
                        yAxisTickFormatter={(value) => `${value}`}
                        yAxisLabel="Sätze"
                        footer={
                          <div className="mt-4 grid grid-cols-2 gap-4 text-center">
                            <div>
                              <div className="text-sm text-muted-foreground">
                                Gesamt
                              </div>
                              <div className="text-2xl font-bold text-foreground">
                                {formatNumber(setsData.totalSets)}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground">
                                Ø pro Workout
                              </div>
                              <div className="text-2xl font-bold text-foreground">
                                {formatNumber(setsData.averageSets)}
                              </div>
                            </div>
                          </div>
                        }
                      />
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">
                          Keine Satz-Daten verfügbar für die ausgewählten Filter.
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
                        title="Wiederholungen pro Workout"
                        height={300}
                        chartType="line"
                        dataKey="reps"
                        name="Wiederholungen"
                        stroke={CHART_ACCENT}
                        yAxisTickFormatter={(value) => `${value}`}
                        yAxisLabel="Wiederholungen"
                        footer={
                          <div className="mt-4 grid grid-cols-2 gap-4 text-center">
                            <div>
                              <div className="text-sm text-muted-foreground">
                                Gesamt
                              </div>
                              <div className="text-2xl font-bold text-foreground">
                                {formatNumber(repsData.totalReps)}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground">
                                Ø pro Workout
                              </div>
                              <div className="text-2xl font-bold text-foreground">
                                {formatNumber(repsData.averageReps)}
                              </div>
                            </div>
                          </div>
                        }
                      />
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">
                          Keine Wiederholungs-Daten verfügbar für die ausgewählten Filter.
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
                        title="Arbeitssätze pro Workout"
                        height={300}
                        chartType="line"
                        dataKey="sets"
                        name="Sätze"
                        stroke={CHART_ACCENT}
                        yAxisTickFormatter={(value) => `${value}`}
                        yAxisLabel="Sätze"
                        footer={
                          <div className="mt-4 grid grid-cols-2 gap-4 text-center">
                            <div>
                              <div className="text-sm text-muted-foreground">
                                Gesamt
                              </div>
                              <div className="text-2xl font-bold text-foreground">
                                {formatNumber(setsData.totalSets)}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground">
                                Ø pro Workout
                              </div>
                              <div className="text-2xl font-bold text-foreground">
                                {formatNumber(setsData.averageSets)}
                              </div>
                            </div>
                          </div>
                        }
                      />
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">
                          Keine Satz-Daten verfügbar für die ausgewählten Filter.
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
                        Muskelgruppen-Verteilung (Volumen)
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
                                  {pct}%
                                </div>
                                <div className="w-20 text-right text-xs text-muted-foreground tabular-nums">
                                  {formatNumber(mg.volume)} kg
                                </div>
                              </div>
                            );
                          })}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-3">Sortiert nach Anteil • Relative Balken zeigen die Verteilung des Volumens</p>
                    </CardContent>
                  </Card>
                )}

                {/* Personal Records (only for Home Gyms) */}
                {gymFilter !== 'andere' && (
                  <Card>
                    <div className="px-6 py-4 border-b border-border">
                      <h3 className="text-lg font-semibold text-foreground">
                        Persönliche Rekorde
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
                            ? 'Keine persönlichen Rekorde für die ausgewählten Filter gefunden'
                            : 'Noch keine persönlichen Rekorde vorhanden'}
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
                        Noch keine Trainingsdaten für den ausgewählten Zeitraum
                        vorhanden.
                      </p>
                      <Link
                        href="/workout"
                        className="mt-4 inline-block text-primary hover:underline"
                      >
                        Zum Workout →
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
