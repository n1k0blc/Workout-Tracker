'use client';

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
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ExerciseSelectionModal from '@/components/workout/exercise-selection-modal';
import SelectedExerciseCard from '@/components/analytics/selected-exercise-card';

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
    color: string;
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
  }, [selectedMuscles, selectedEquipment]);

  // Color palette for chart lines
  const COLORS = [
    '#3b82f6', // blue
    '#ef4444', // red
    '#10b981', // green
    '#f59e0b', // amber
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#6366f1', // indigo
  ];

  // Translation helpers
  const translateMuscleGroup = (mg: string): string => {
    const translations: Record<string, string> = {
      CHEST: 'Brust',
      BACK: 'Rücken',
      LEGS: 'Beine',
      SHOULDERS: 'Schultern',
      BICEPS: 'Bizeps',
      TRICEPS: 'Trizeps',
      ABS: 'Bauch',
      FOREARMS: 'Unterarme',
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
      const color = COLORS[index % COLORS.length];

      lineConfigs.push({
        dataKey: lineName,
        name: lineName,
        color,
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

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('de-DE').format(Math.round(num));
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
    }).format(date);
  };

  const formatXAxisLabel = (entry: any) => {
    // If weekLabel exists, use it; otherwise format the date
    if (entry.weekLabel) {
      return entry.weekLabel;
    }
    return formatDate(entry.date);
  };

  const formatTooltipLabel = (entry: any) => {
    // For week aggregation, show date range and workout count
    if (entry.weekStartDate && entry.weekEndDate) {
      const start = formatDate(entry.weekStartDate);
      const end = formatDate(entry.weekEndDate);
      const workoutCount = entry.workoutCount || 0;
      return `${start} - ${end} (${workoutCount} Workout${workoutCount !== 1 ? 's' : ''})`;
    }
    // For day aggregation, just show the date
    return formatDate(entry.date);
  };

  const muscleGroups = [
    MuscleGroup.CHEST,
    MuscleGroup.BACK,
    MuscleGroup.BICEPS,
    MuscleGroup.TRICEPS,
    MuscleGroup.ABS,
    MuscleGroup.SHOULDERS,
    MuscleGroup.LEGS,
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
      <div className="min-h-screen bg-gray-50">
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Trainingsanalyse
              </h2>

              {/* Filter Section - ALWAYS ON TOP */}
              <div className="bg-white rounded-lg shadow p-6 space-y-4">
                {/* Row 1: Cycle Mode Toggle + Time/Gym Filter */}
                <div className="flex flex-wrap gap-4 items-center">
                  {/* Cycle Mode Button */}
                  <button
                    onClick={() => {
                      setCycleMode(!cycleMode);
                      setSelectedViews(['volume']); // Reset to volume when switching modes
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${
                      cycleMode
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Zyklus-Modus
                  </button>

                  {/* Time Filter (only in Time Mode) */}
                  {!cycleMode && (
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-gray-700">
                        Zeitraum:
                      </label>
                      <select
                        value={timeFilter}
                        onChange={(e) => setTimeFilter(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
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
                      <label className="text-sm font-medium text-gray-700">
                        Gym:
                      </label>
                      <select
                        value={gymFilter}
                        onChange={(e) => setGymFilter(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
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
                    <button
                      onClick={() => setSelectedCycleIndex(Math.min(allCycles.length - 1, selectedCycleIndex + 1))}
                      disabled={selectedCycleIndex === allCycles.length - 1}
                      className="p-2 rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>

                    <div className="text-center">
                      <div className="text-lg font-semibold text-gray-900">
                        {selectedCycle?.name}
                      </div>
                      <div className="text-sm text-gray-600">
                        {formatDate(selectedCycle?.startDate || '')}
                        {selectedCycle?.completedAt && ` - ${formatDate(selectedCycle.completedAt)}`}
                        <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                          isActiveCycle ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {isActiveCycle ? 'Aktiv' : 'Abgeschlossen'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedCycleIndex(Math.max(0, selectedCycleIndex - 1))}
                      disabled={selectedCycleIndex === 0}
                      className="p-2 rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                )}

                {/* Row 3: Aggregation Mode Toggle */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Aggregation:
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAggregationMode('day')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        aggregationMode === 'day'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Tage
                    </button>
                    <button
                      onClick={() => setAggregationMode('week')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        aggregationMode === 'week'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Wochen
                    </button>
                  </div>
                </div>

                {/* Row 4: View Mode Buttons */}
                <div className="space-y-4">
                  {/* View Mode Buttons */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Ansicht (max. 2):
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => toggleView('volume')}
                        disabled={
                          !selectedViews.includes('volume') && 
                          selectedViews.length >= calculateMaxAllowed('view')
                        }
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          selectedViews.includes('volume')
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed'
                        }`}
                      >
                        Volumen
                      </button>
                      {cycleMode && (
                        <button
                          onClick={() => toggleView('orm')}
                          disabled={
                            !selectedViews.includes('orm') && 
                            selectedViews.length >= calculateMaxAllowed('view')
                          }
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            selectedViews.includes('orm')
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed'
                          }`}
                        >
                          %ORM
                        </button>
                      )}
                      <button
                        onClick={() => toggleView('rir')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          selectedViews.includes('rir')
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        RIR
                      </button>
                      <button
                        onClick={() => toggleView('duration')}
                        disabled={
                          (!selectedViews.includes('duration') && selectedViews.length >= calculateMaxAllowed('view')) ||
                          !selectedMuscles.includes('ALL') || 
                          !selectedEquipment.includes('ALL')
                        }
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          selectedViews.includes('duration')
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed'
                        }`}
                      >
                        Dauer
                      </button>
                      <button
                        onClick={() => toggleView('restTime')}
                        disabled={
                          !selectedViews.includes('restTime') && 
                          selectedViews.length >= calculateMaxAllowed('view')
                        }
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          selectedViews.includes('restTime')
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed'
                        }`}
                      >
                        Satzpause
                      </button>
                      <button
                        onClick={() => toggleView('reps')}
                        disabled={
                          !selectedViews.includes('reps') && 
                          selectedViews.length >= calculateMaxAllowed('view')
                        }
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          selectedViews.includes('reps')
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed'
                        }`}
                      >
                        Wiederholungen
                      </button>
                      <button
                        onClick={() => toggleView('sets')}
                        disabled={
                          !selectedViews.includes('sets') && 
                          selectedViews.length >= calculateMaxAllowed('view')
                        }
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          selectedViews.includes('sets')
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed'
                        }`}
                      >
                        Sätze
                      </button>
                    </div>
                  </div>

                  {/* Muscle Group Buttons */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Muskelgruppe:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => toggleMuscle('ALL')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          selectedMuscles.includes('ALL')
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        Alle
                      </button>
                      {muscleGroups.map((mg) => {
                        const isSelected = selectedMuscles.includes(mg);
                        
                        return (
                          <button
                            key={mg}
                            onClick={() => toggleMuscle(mg)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                              isSelected
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {translateMuscleGroup(mg)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Equipment Buttons */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Equipment:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => toggleEquipment('ALL')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          selectedEquipment.includes('ALL')
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        Alle
                      </button>
                      {equipments.map((eq) => {
                        const isSelected = selectedEquipment.includes(eq);
                        
                        return (
                          <button
                            key={eq}
                            onClick={() => toggleEquipment(eq)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                              isSelected
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {translateEquipment(eq)}
                          </button>
                        );
                      })}
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
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-lg text-gray-600">Lädt Analytics...</div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Multi-Line Chart (when multiple views are selected) */}
                {selectedViews.length > 1 && mergedChartData.length > 0 && chartLineConfigs.length > 0 && (
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Vergleichsansicht
                    </h3>
                    <ResponsiveContainer width="100%" height={400}>
                      <LineChart data={mergedChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(date, index) => {
                            const entry = mergedChartData[index];
                            return formatXAxisLabel(entry);
                          }}
                          style={{ fontSize: '12px' }}
                        />
                        
                        {/* Left Y-Axis (for first view type) */}
                        <YAxis
                          yAxisId="left"
                          style={{ fontSize: '12px' }}
                          tickFormatter={(value) => {
                            const leftConfig = chartLineConfigs.find(c => c.yAxisId === 'left');
                            return `${formatNumber(value)} ${leftConfig?.unit || ''}`;
                          }}
                        />
                        
                        {/* Right Y-Axis (for second view type if exists) */}
                        {chartLineConfigs.some(config => config.yAxisId === 'right') && (
                          <YAxis
                            yAxisId="right"
                            orientation="right"
                            style={{ fontSize: '12px' }}
                            tickFormatter={(value) => {
                              const rightConfig = chartLineConfigs.find(c => c.yAxisId === 'right');
                              return `${formatNumber(value)} ${rightConfig?.unit || ''}`;
                            }}
                          />
                        )}
                        
                        <Tooltip
                          formatter={(value: any, name?: string | number) => {
                            const config = chartLineConfigs.find(c => c.dataKey === name);
                            return [`${formatNumber(value as number)} ${config?.unit || ''}`, String(name || '')];
                          }}
                          labelFormatter={(label, payload) => {
                            if (payload && payload.length > 0) {
                              return formatTooltipLabel(payload[0].payload);
                            }
                            return formatDate(label as string);
                          }}
                        />
                        <Legend />
                        
                        {/* Dynamically render lines for each filter combination */}
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
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
                
                {/* Volume Chart */}
                {selectedViews.length === 1 && selectedViews.includes('volume') && volumeData && volumeData.dataPoints.length > 0 && (
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Volumen-Entwicklung
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={volumeData.dataPoints}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey={cycleMode ? "date" : "date"}
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
                          labelFormatter={(label, payload) => {
                            if (payload && payload.length > 0) {
                              return formatTooltipLabel(payload[0].payload);
                            }
                            return formatDate(label as string);
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

                {/* ORM Chart (only in Cycle Mode) */}
                {selectedViews.length === 1 && cycleMode && selectedViews.includes('orm') && (
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
                              labelFormatter={(label, payload) => {
                                if (payload && payload.length > 0) {
                                  return formatTooltipLabel(payload[0].payload);
                                }
                                return formatDate(label as string);
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
                            />
                          </LineChart>
                        </ResponsiveContainer>
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

                {/* RIR Chart (Cycle Mode) */}
                {selectedViews.length === 1 && cycleMode && selectedViews.includes('rir') && (
                  <div className="bg-white rounded-lg shadow p-6">
                    {rirData && rirData.dataPoints.length > 0 ? (
                      <>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                          RIR-Verteilung
                        </h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={rirData.dataPoints}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="date"
                              tickFormatter={formatDate}
                              style={{ fontSize: '12px' }}
                            />
                            <YAxis
                              label={{ value: 'Anzahl Sätze', angle: -90, position: 'insideLeft' }}
                              style={{ fontSize: '12px' }}
                            />
                            <Tooltip
                              labelFormatter={(label: any) => formatDate(label as string)}
                            />
                            <Legend />
                            <Bar dataKey="rir0Count" fill="#ef4444" name="RIR 0" />
                            <Bar dataKey="rir1Count" fill="#eab308" name="RIR 1" />
                            <Bar dataKey="rir2Count" fill="#22c55e" name="RIR 2" />
                          </BarChart>
                        </ResponsiveContainer>
                        <div className="mt-4 text-center">
                          <div className="text-sm text-gray-600">
                            Gesamte Sets
                          </div>
                          <div className="text-2xl font-bold text-gray-900">
                            {rirData.totalSets}
                          </div>
                        </div>
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

                {/* RIR Chart (Time Mode) */}
                {selectedViews.length === 1 && !cycleMode && selectedViews.includes('rir') && (
                  <div className="bg-white rounded-lg shadow p-6">
                    {rirData && rirData.dataPoints.length > 0 ? (
                      <>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                          RIR-Verteilung
                        </h3>
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
                              labelFormatter={(label, payload) => {
                                if (payload && payload.length > 0) {
                                  return formatTooltipLabel(payload[0].payload);
                                }
                                return formatDate(label as string);
                              }}
                            />
                            <Legend />
                            <Bar dataKey="rir0Count" fill="#ef4444" name="RIR 0" />
                            <Bar dataKey="rir1Count" fill="#eab308" name="RIR 1" />
                            <Bar dataKey="rir2Count" fill="#22c55e" name="RIR 2" />
                          </BarChart>
                        </ResponsiveContainer>
                        <div className="mt-4 text-center">
                          <div className="text-sm text-gray-600">
                            Gesamte Sets
                          </div>
                          <div className="text-2xl font-bold text-gray-900">
                            {rirData.totalSets}
                          </div>
                        </div>
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

                {/* Duration Chart (Time Mode) */}
                {selectedViews.length === 1 && !cycleMode && selectedViews.includes('duration') && (
                  <div className="bg-white rounded-lg shadow p-6">
                    {!selectedMuscles.includes('ALL') || !selectedEquipment.includes('ALL') ? (
                      <div className="text-center py-12">
                        <p className="text-gray-600">
                          Workout-Dauer bezieht sich auf das gesamte Training.
                        </p>
                        <p className="text-sm text-gray-500 mt-2">
                          Bitte wähle "Alle" bei Muskelgruppe und Equipment aus.
                        </p>
                      </div>
                    ) : durationData && durationData.dataPoints.length > 0 ? (
                      <>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                          Workout-Dauer
                        </h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={durationData.dataPoints}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="date"
                              tickFormatter={formatDate}
                              style={{ fontSize: '12px' }}
                            />
                            <YAxis
                              label={{ value: 'Minuten', angle: -90, position: 'insideLeft' }}
                              style={{ fontSize: '12px' }}
                            />
                            <Tooltip
                              formatter={(value: any) => [`${value} min`, 'Dauer']}
                              labelFormatter={(label: any) => formatDate(label as string)}
                            />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="duration"
                              stroke="#8b5cf6"
                              strokeWidth={2}
                              dot={{ r: 4 }}
                              name="Dauer"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                        <div className="mt-4 text-center">
                          <div className="text-sm text-gray-600">
                            Durchschnittliche Dauer
                          </div>
                          <div className="text-2xl font-bold text-gray-900">
                            {Math.round(
                              durationData.dataPoints.reduce((sum, point) => sum + point.duration, 0) /
                                durationData.dataPoints.length
                            )} min
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-gray-600">
                          Keine Dauer-Daten verfügbar für die ausgewählten Filter.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Duration Chart (Cycle Mode) */}
                {selectedViews.length === 1 && cycleMode && selectedViews.includes('duration') && (
                  <div className="bg-white rounded-lg shadow p-6">
                    {!selectedMuscles.includes('ALL') || !selectedEquipment.includes('ALL') ? (
                      <div className="text-center py-12">
                        <p className="text-gray-600">
                          Workout-Dauer bezieht sich auf das gesamte Training.
                        </p>
                        <p className="text-sm text-gray-500 mt-2">
                          Bitte wähle "Alle" bei Muskelgruppe und Equipment aus.
                        </p>
                      </div>
                    ) : durationData && durationData.dataPoints.length > 0 ? (
                      <>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                          Workout-Dauer
                        </h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={durationData.dataPoints}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="date"
                              tickFormatter={(date, index) => formatXAxisLabel(durationData.dataPoints[index])}
                              style={{ fontSize: '12px' }}
                            />
                            <YAxis
                              label={{ value: 'Minuten', angle: -90, position: 'insideLeft' }}
                              style={{ fontSize: '12px' }}
                            />
                            <Tooltip
                              formatter={(value: any) => [`${value} min`, 'Dauer']}
                              labelFormatter={(label, payload) => {
                                if (payload && payload.length > 0) {
                                  return formatTooltipLabel(payload[0].payload);
                                }
                                return formatDate(label as string);
                              }}
                            />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="duration"
                              stroke="#8b5cf6"
                              strokeWidth={2}
                              dot={{ r: 4 }}
                              name="Dauer"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                        <div className="mt-4 text-center">
                          <div className="text-sm text-gray-600">
                            Durchschnittliche Dauer
                          </div>
                          <div className="text-2xl font-bold text-gray-900">
                            {Math.round(
                              durationData.dataPoints.reduce((sum, point) => sum + point.duration, 0) /
                                durationData.dataPoints.length
                            )} min
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-gray-600">
                          Keine Dauer-Daten verfügbar für die ausgewählten Filter.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* RestTime Chart (Time Mode) */}
                {selectedViews.length === 1 && !cycleMode && selectedViews.includes('restTime') && (
                  <div className="bg-white rounded-lg shadow p-6">
                    {restTimeData && restTimeData.dataPoints.length > 0 ? (
                      <>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                          Durchschnittliche Satzpause
                        </h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={restTimeData.dataPoints}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="date"
                              tickFormatter={formatDate}
                              style={{ fontSize: '12px' }}
                            />
                            <YAxis
                              label={{ value: 'Sekunden', angle: -90, position: 'insideLeft' }}
                              style={{ fontSize: '12px' }}
                            />
                            <Tooltip
                              formatter={(value: any) => [`${value}s`, 'Satzpause']}
                              labelFormatter={(label: any) => formatDate(label as string)}
                            />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="averageRestTime"
                              stroke="#f59e0b"
                              strokeWidth={2}
                              dot={{ r: 4 }}
                              name="Satzpause"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                        <div className="mt-4 text-center">
                          <div className="text-sm text-gray-600">
                            Durchschnittliche Pause
                          </div>
                          <div className="text-2xl font-bold text-gray-900">
                            {restTimeData.overallAverage}s
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-gray-600">
                          Keine Satzpausen-Daten verfügbar für die ausgewählten Filter.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* RestTime Chart (Cycle Mode) */}
                {selectedViews.length === 1 && cycleMode && selectedViews.includes('restTime') && (
                  <div className="bg-white rounded-lg shadow p-6">
                    {restTimeData && restTimeData.dataPoints.length > 0 ? (
                      <>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                          Durchschnittliche Satzpause
                        </h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={restTimeData.dataPoints}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="date"
                              tickFormatter={(date, index) => formatXAxisLabel(restTimeData.dataPoints[index])}
                              style={{ fontSize: '12px' }}
                            />
                            <YAxis
                              label={{ value: 'Sekunden', angle: -90, position: 'insideLeft' }}
                              style={{ fontSize: '12px' }}
                            />
                            <Tooltip
                              formatter={(value: any) => [`${value}s`, 'Satzpause']}
                              labelFormatter={(label, payload) => {
                                if (payload && payload.length > 0) {
                                  return formatTooltipLabel(payload[0].payload);
                                }
                                return formatDate(label as string);
                              }}
                            />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="averageRestTime"
                              stroke="#f59e0b"
                              strokeWidth={2}
                              dot={{ r: 4 }}
                              name="Satzpause"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                        <div className="mt-4 text-center">
                          <div className="text-sm text-gray-600">
                            Durchschnittliche Pause
                          </div>
                          <div className="text-2xl font-bold text-gray-900">
                            {restTimeData.overallAverage}s
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-gray-600">
                          Keine Satzpausen-Daten verfügbar für die ausgewählten Filter.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Reps Chart (Time Mode) */}
                {selectedViews.length === 1 && !cycleMode && selectedViews.includes('reps') && (
                  <div className="bg-white rounded-lg shadow p-6">
                    {repsData && repsData.dataPoints.length > 0 ? (
                      <>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                          Wiederholungen pro Workout
                        </h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={repsData.dataPoints}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="date"
                              tickFormatter={formatDate}
                              style={{ fontSize: '12px' }}
                            />
                            <YAxis
                              label={{ value: 'Wiederholungen', angle: -90, position: 'insideLeft' }}
                              style={{ fontSize: '12px' }}
                            />
                            <Tooltip
                              formatter={(value: any) => [value, 'Wiederholungen']}
                              labelFormatter={(label: any) => formatDate(label as string)}
                            />
                            <Legend />
                            <Line
                              dataKey="reps"
                              stroke="#10b981"
                              strokeWidth={2}
                              name="Wiederholungen"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                        <div className="mt-4 grid grid-cols-2 gap-4 text-center">
                          <div>
                            <div className="text-sm text-gray-600">
                              Gesamt
                            </div>
                            <div className="text-2xl font-bold text-gray-900">
                              {formatNumber(repsData.totalReps)}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-600">
                              Ø pro Workout
                            </div>
                            <div className="text-2xl font-bold text-gray-900">
                              {formatNumber(repsData.averageReps)}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-gray-600">
                          Keine Wiederholungs-Daten verfügbar für die ausgewählten Filter.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Sets Chart (Time Mode) */}
                {selectedViews.length === 1 && !cycleMode && selectedViews.includes('sets') && (
                  <div className="bg-white rounded-lg shadow p-6">
                    {setsData && setsData.dataPoints.length > 0 ? (
                      <>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                          Arbeitssätze pro Workout
                        </h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={setsData.dataPoints}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="date"
                              tickFormatter={formatDate}
                              style={{ fontSize: '12px' }}
                            />
                            <YAxis
                              label={{ value: 'Sätze', angle: -90, position: 'insideLeft' }}
                              style={{ fontSize: '12px' }}
                            />
                            <Tooltip
                              formatter={(value: any) => [value, 'Sätze']}
                              labelFormatter={(label: any) => formatDate(label as string)}
                            />
                            <Legend />
                            <Line
                              dataKey="sets"
                              stroke="#f59e0b"
                              strokeWidth={2}
                              name="Sätze"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                        <div className="mt-4 grid grid-cols-2 gap-4 text-center">
                          <div>
                            <div className="text-sm text-gray-600">
                              Gesamt
                            </div>
                            <div className="text-2xl font-bold text-gray-900">
                              {formatNumber(setsData.totalSets)}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-600">
                              Ø pro Workout
                            </div>
                            <div className="text-2xl font-bold text-gray-900">
                              {formatNumber(setsData.averageSets)}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-gray-600">
                          Keine Satz-Daten verfügbar für die ausgewählten Filter.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Reps Chart (Cycle Mode) */}
                {selectedViews.length === 1 && cycleMode && selectedViews.includes('reps') && (
                  <div className="bg-white rounded-lg shadow p-6">
                    {repsData && repsData.dataPoints.length > 0 ? (
                      <>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                          Wiederholungen pro Workout
                        </h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={repsData.dataPoints}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="date"
                              tickFormatter={(date, index) => formatXAxisLabel(repsData.dataPoints[index])}
                              style={{ fontSize: '12px' }}
                            />
                            <YAxis
                              label={{ value: 'Wiederholungen', angle: -90, position: 'insideLeft' }}
                              style={{ fontSize: '12px' }}
                            />
                            <Tooltip
                              formatter={(value: any) => [value, 'Wiederholungen']}
                              labelFormatter={(label, payload) => {
                                if (payload && payload.length > 0) {
                                  return formatTooltipLabel(payload[0].payload);
                                }
                                return formatDate(label as string);
                              }}
                            />
                            <Legend />
                            <Line
                              dataKey="reps"
                              stroke="#10b981"
                              strokeWidth={2}
                              name="Wiederholungen"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                        <div className="mt-4 grid grid-cols-2 gap-4 text-center">
                          <div>
                            <div className="text-sm text-gray-600">
                              Gesamt
                            </div>
                            <div className="text-2xl font-bold text-gray-900">
                              {formatNumber(repsData.totalReps)}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-600">
                              Ø pro Workout
                            </div>
                            <div className="text-2xl font-bold text-gray-900">
                              {formatNumber(repsData.averageReps)}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-gray-600">
                          Keine Wiederholungs-Daten verfügbar für die ausgewählten Filter.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Sets Chart (Cycle Mode) */}
                {selectedViews.length === 1 && cycleMode && selectedViews.includes('sets') && (
                  <div className="bg-white rounded-lg shadow p-6">
                    {setsData && setsData.dataPoints.length > 0 ? (
                      <>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                          Arbeitssätze pro Workout
                        </h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={setsData.dataPoints}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="date"
                              tickFormatter={(date, index) => formatXAxisLabel(setsData.dataPoints[index])}
                              style={{ fontSize: '12px' }}
                            />
                            <YAxis
                              label={{ value: 'Sätze', angle: -90, position: 'insideLeft' }}
                              style={{ fontSize: '12px' }}
                            />
                            <Tooltip
                              formatter={(value: any) => [value, 'Sätze']}
                              labelFormatter={(label, payload) => {
                                if (payload && payload.length > 0) {
                                  return formatTooltipLabel(payload[0].payload);
                                }
                                return formatDate(label as string);
                              }}
                            />
                            <Legend />
                            <Line
                              dataKey="sets"
                              stroke="#f59e0b"
                              strokeWidth={2}
                              name="Sätze"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                        <div className="mt-4 grid grid-cols-2 gap-4 text-center">
                          <div>
                            <div className="text-sm text-gray-600">
                              Gesamt
                            </div>
                            <div className="text-2xl font-bold text-gray-900">
                              {formatNumber(setsData.totalSets)}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-600">
                              Ø pro Workout
                            </div>
                            <div className="text-2xl font-bold text-gray-900">
                              {formatNumber(setsData.averageSets)}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-gray-600">
                          Keine Satz-Daten verfügbar für die ausgewählten Filter.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Muscle Distribution Chart */}
                {selectedViews.includes('volume') && selectedMuscles.includes('ALL') && volumeData && volumeData.byMuscleGroup && volumeData.byMuscleGroup.length > 0 && (
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Muskelgruppen-Verteilung
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={volumeData.byMuscleGroup}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={(entry: any) =>
                              `${translateMuscleGroup(entry.muscleGroup)} (${Math.round(entry.percentage)}%)`
                            }
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="volume"
                          >
                            {volumeData.byMuscleGroup.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: any) => [
                              `${formatNumber(value as number)} kg`,
                              'Volumen',
                            ]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-2">
                        {volumeData.byMuscleGroup.map((mg, idx) => (
                          <div
                            key={mg.muscleGroup}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="w-4 h-4 rounded"
                                style={{
                                  backgroundColor: COLORS[idx % COLORS.length],
                                }}
                              />
                              <span className="font-medium text-gray-900">
                                {translateMuscleGroup(mg.muscleGroup)}
                              </span>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold text-gray-900">
                                {formatNumber(mg.volume)} kg
                              </div>
                              <div className="text-xs text-gray-600">
                                {Math.round(mg.percentage)}%
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Personal Records (only for Home Gyms) */}
                {gymFilter !== 'andere' && (
                  <div className="bg-white rounded-lg shadow">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Persönliche Rekorde
                      </h3>
                    </div>

                    <div className="p-6">
                      {prs.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {prs.map((pr) => (
                            <div
                              key={`${pr.exerciseId}-${pr.type}`}
                              className="border border-gray-200 rounded-lg p-4"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="font-semibold text-gray-900">
                                    {pr.exerciseName}
                                  </div>
                                  <div className="text-sm text-gray-600 mt-1">
                                    <span className="font-medium">Gewicht:</span>{' '}
                                    {pr.value}kg
                                  </div>
                                  {pr.details && pr.details.weight && pr.details.reps && (
                                    <div className="text-xs text-gray-500 mt-1">
                                      {pr.details.weight}kg × {pr.isUnilateral ? `${pr.details.reps * 2} (${pr.details.reps}x2)` : pr.details.reps} Wdh.
                                    </div>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500 ml-4">
                                  {formatDate(pr.date)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-center py-8">
                          {!selectedMuscles.includes('ALL') || !selectedEquipment.includes('ALL')
                            ? 'Keine persönlichen Rekorde für die ausgewählten Filter gefunden'
                            : 'Noch keine persönlichen Rekorde vorhanden'}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {(!volumeData || volumeData.dataPoints.length === 0) && (
                  <div className="bg-white rounded-lg shadow p-12 text-center">
                    <p className="text-gray-500">
                      Noch keine Trainingsdaten für den ausgewählten Zeitraum
                      vorhanden.
                    </p>
                    <Link
                      href="/workout"
                      className="mt-4 inline-block text-blue-600 hover:text-blue-800"
                    >
                      Zum Workout →
                    </Link>
                  </div>
                )}
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
