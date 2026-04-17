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

export default function AnalyticsPage() {
  // Data states
  const [volumeData, setVolumeData] = useState<VolumeAnalytics | null>(null);
  const [ormData, setOrmData] = useState<ORMByCycleAnalytics | null>(null);
  const [rirData, setRirData] = useState<RIRByCycleAnalytics | RIRAnalytics | null>(null);
  const [durationData, setDurationData] = useState<DurationByCycleAnalytics | DurationAnalytics | null>(null);
  const [restTimeData, setRestTimeData] = useState<RestTimeByCycleAnalytics | RestTimeAnalytics | null>(null);
  const [repsData, setRepsData] = useState<RepsByCycleAnalytics | RepsAnalytics | null>(null);
  const [prs, setPrs] = useState<PersonalRecord[]>([]);
  const [homeGyms, setHomeGyms] = useState<HomeGym[]>([]);
  const [cycles, setCycles] = useState<CycleList | null>(null);
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [cycleMode, setCycleMode] = useState(false);
  const [viewMode, setViewMode] = useState<'volume' | 'orm' | 'rir' | 'duration' | 'restTime' | 'reps'>('volume');
  
  // Filter states
  const [timeFilter, setTimeFilter] = useState('7');
  const [gymFilter, setGymFilter] = useState('alle');
  const [muscleFilter, setMuscleFilter] = useState<MuscleGroup | undefined>();
  const [equipmentFilter, setEquipmentFilter] = useState<Equipment | undefined>();
  
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
  }, [cycleMode, timeFilter, gymFilter, muscleFilter, equipmentFilter, selectedCycleIndex, viewMode]);

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

    if (viewMode === 'volume') {
      const [volume, records] = await Promise.all([
        apiClient.getVolumeAnalytics({
          startDate,
          endDate,
          gymId: gymFilter,
          muscleGroup: muscleFilter,
          equipment: equipmentFilter,
        }),
        apiClient.getPersonalRecords({
          muscleGroup: muscleFilter,
          equipment: equipmentFilter,
          gymId: gymFilter,
        }),
      ]);

      // Filter out empty days (volume = 0)
      const filteredVolume = {
        ...volume,
        dataPoints: volume.dataPoints.filter(point => point.volume > 0),
      };

      setVolumeData(filteredVolume);
      setPrs(records.allTimePRs || []);
    } else if (viewMode === 'rir') {
      const [rir, records] = await Promise.all([
        apiClient.getRIRAnalytics({
          startDate,
          endDate,
          gymId: gymFilter,
          muscleGroup: muscleFilter,
          equipment: equipmentFilter,
        }),
        apiClient.getPersonalRecords({
          muscleGroup: muscleFilter,
          equipment: equipmentFilter,
          gymId: gymFilter,
        }),
      ]);

      setRirData(rir);
      setPrs(records.allTimePRs || []);
    } else if (viewMode === 'duration') {
      const [duration, records] = await Promise.all([
        apiClient.getDurationAnalytics({
          startDate,
          endDate,
          gymId: gymFilter,
          muscleGroup: muscleFilter,
          equipment: equipmentFilter,
        }),
        apiClient.getPersonalRecords({
          muscleGroup: muscleFilter,
          equipment: equipmentFilter,
          gymId: gymFilter,
        }),
      ]);

      setDurationData(duration);
      setPrs(records.allTimePRs || []);
    } else if (viewMode === 'restTime') {
      const [restTime, records] = await Promise.all([
        apiClient.getRestTimeAnalytics({
          startDate,
          endDate,
          gymId: gymFilter,
          muscleGroup: muscleFilter,
          equipment: equipmentFilter,
        }),
        apiClient.getPersonalRecords({
          muscleGroup: muscleFilter,
          equipment: equipmentFilter,
          gymId: gymFilter,
        }),
      ]);

      setRestTimeData(restTime);
      setPrs(records.allTimePRs || []);
    } else if (viewMode === 'reps') {
      const [reps, records] = await Promise.all([
        apiClient.getRepsAnalytics({
          startDate,
          endDate,
          gymId: gymFilter,
          muscleGroup: muscleFilter,
          equipment: equipmentFilter,
        }),
        apiClient.getPersonalRecords({
          muscleGroup: muscleFilter,
          equipment: equipmentFilter,
          gymId: gymFilter,
        }),
      ]);

      setRepsData(reps);
      setPrs(records.allTimePRs || []);
    }
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

    if (viewMode === 'volume') {
      // Load volume for cycle period
      const cycleStart = new Date(selectedCycle.startDate).toISOString();
      // For active cycles, don't set endDate to allow future mock dates
      const cycleEnd = selectedCycle.completedAt
        ? new Date(selectedCycle.completedAt).toISOString()
        : undefined;

      const [volume, records] = await Promise.all([
        apiClient.getVolumeAnalytics({
          startDate: cycleStart,
          endDate: cycleEnd,
          gymId: gymFilter,
          muscleGroup: muscleFilter,
          equipment: equipmentFilter,
          cycleId: selectedCycle.id, // NEW: Only this cycle's workouts
        }),
        apiClient.getPersonalRecords({
          muscleGroup: muscleFilter,
          equipment: equipmentFilter,
          gymId: gymFilter,
        }),
      ]);

      // Filter out empty days (volume = 0)
      const filteredVolume = {
        ...volume,
        dataPoints: volume.dataPoints.filter(point => point.volume > 0),
      };

      setVolumeData(filteredVolume);
      setPrs(records.allTimePRs || []);
    } else if (viewMode === 'orm') {
      // Load ORM data for cycle
      const [orm, records] = await Promise.all([
        apiClient.getORMByCycle(
          selectedCycle.id,
          muscleFilter,
          equipmentFilter,
        ),
        apiClient.getPersonalRecords({
          muscleGroup: muscleFilter,
          equipment: equipmentFilter,
          gymId: gymFilter,
        }),
      ]);

      setOrmData(orm);
      setPrs(records.allTimePRs || []);
    } else if (viewMode === 'rir') {
      // Load RIR data for cycle
      const [rir, records] = await Promise.all([
        apiClient.getRIRByCycle(
          selectedCycle.id,
          gymFilter,
          muscleFilter,
          equipmentFilter,
          timeFilter === '7' ? undefined : timeFilter === '30' ? undefined : undefined, // timeOfDay filter
        ),
        apiClient.getPersonalRecords({
          muscleGroup: muscleFilter,
          equipment: equipmentFilter,
          gymId: gymFilter,
        }),
      ]);

      setRirData(rir);
      setPrs(records.allTimePRs || []);
    } else if (viewMode === 'duration') {
      // Load Duration data for cycle
      const [duration, records] = await Promise.all([
        apiClient.getDurationByCycle(
          selectedCycle.id,
          gymFilter,
          muscleFilter,
          equipmentFilter,
        ),
        apiClient.getPersonalRecords({
          muscleGroup: muscleFilter,
          equipment: equipmentFilter,
          gymId: gymFilter,
        }),
      ]);

      setDurationData(duration);
      setPrs(records.allTimePRs || []);
    } else if (viewMode === 'restTime') {
      // Load RestTime data for cycle
      const [restTime, records] = await Promise.all([
        apiClient.getRestTimeByCycle(
          selectedCycle.id,
          gymFilter,
          muscleFilter,
          equipmentFilter,
        ),
        apiClient.getPersonalRecords({
          muscleGroup: muscleFilter,
          equipment: equipmentFilter,
          gymId: gymFilter,
        }),
      ]);

      setRestTimeData(restTime);
      setPrs(records.allTimePRs || []);
    } else if (viewMode === 'reps') {
      // Load Reps data for cycle
      const [reps, records] = await Promise.all([
        apiClient.getRepsByCycle(
          selectedCycle.id,
          muscleFilter,
          equipmentFilter,
        ),
        apiClient.getPersonalRecords({
          muscleGroup: muscleFilter,
          equipment: equipmentFilter,
          gymId: gymFilter,
        }),
      ]);

      setRepsData(reps);
      setPrs(records.allTimePRs || []);
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
    }).format(date);
  };

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
                      setViewMode('volume'); // Reset to volume when switching modes
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
                  {!(cycleMode && viewMode === 'orm') && (
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

                {/* Row 3: View Mode, Muscle Group & Equipment Dropdowns */}
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  {/* View Mode Dropdown */}
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                      Ansicht:
                    </label>
                    <select
                      value={viewMode}
                      onChange={(e) => setViewMode(e.target.value as typeof viewMode)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="volume">Volumen</option>
                      {cycleMode && <option value="orm">%ORM</option>}
                      <option value="rir">RIR</option>
                      <option value="duration">Dauer</option>
                      <option value="restTime">Satzpause</option>
                      <option value="reps">Wiederholungen</option>
                    </select>
                  </div>

                  {/* Muscle Group Dropdown */}
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                      Muskelgruppe:
                    </label>
                    <select
                      value={muscleFilter || ''}
                      onChange={(e) => setMuscleFilter(e.target.value ? e.target.value as MuscleGroup : undefined)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Alle</option>
                      {muscleGroups.map((mg) => (
                        <option key={mg} value={mg}>
                          {translateMuscleGroup(mg)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Equipment Dropdown */}
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                      Equipment:
                    </label>
                    <select
                      value={equipmentFilter || ''}
                      onChange={(e) => setEquipmentFilter(e.target.value ? e.target.value as Equipment : undefined)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Alle</option>
                      {equipments.map((eq) => (
                        <option key={eq} value={eq}>
                          {translateEquipment(eq)}
                        </option>
                      ))}
                    </select>
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
                {/* Volume Chart */}
                {viewMode === 'volume' && volumeData && volumeData.dataPoints.length > 0 && (
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Volumen-Entwicklung
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={volumeData.dataPoints}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey={cycleMode ? "date" : "date"}
                          tickFormatter={formatDate}
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
                          labelFormatter={(label: any) => formatDate(label as string)}
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
                {cycleMode && viewMode === 'orm' && (
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
                              tickFormatter={formatDate}
                              style={{ fontSize: '12px' }}
                            />
                            <YAxis
                              tickFormatter={(value) => `${value}%`}
                              style={{ fontSize: '12px' }}
                            />
                            <Tooltip
                              formatter={(value: any) => [`${value}%`, '%ORM']}
                              labelFormatter={(label: any) => formatDate(label as string)}
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
                {cycleMode && viewMode === 'rir' && (
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
                {!cycleMode && viewMode === 'rir' && (
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

                {/* Duration Chart (Time Mode) */}
                {!cycleMode && viewMode === 'duration' && (
                  <div className="bg-white rounded-lg shadow p-6">
                    {muscleFilter || equipmentFilter ? (
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
                {cycleMode && viewMode === 'duration' && (
                  <div className="bg-white rounded-lg shadow p-6">
                    {muscleFilter || equipmentFilter ? (
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

                {/* RestTime Chart (Time Mode) */}
                {!cycleMode && viewMode === 'restTime' && (
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
                {cycleMode && viewMode === 'restTime' && (
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

                {/* Reps Chart (Time Mode) */}
                {!cycleMode && viewMode === 'reps' && (
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

                {/* Reps Chart (Cycle Mode) */}
                {cycleMode && viewMode === 'reps' && (
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

                {/* Muscle Distribution Chart */}
                {viewMode === 'volume' && !muscleFilter && volumeData && volumeData.byMuscleGroup && volumeData.byMuscleGroup.length > 0 && (
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

                {/* Personal Records */}
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
                        {muscleFilter || equipmentFilter
                          ? 'Keine persönlichen Rekorde für die ausgewählten Filter gefunden'
                          : 'Noch keine persönlichen Rekorde vorhanden'}
                      </p>
                    )}
                  </div>
                </div>

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
    </ProtectedRoute>
  );
}
