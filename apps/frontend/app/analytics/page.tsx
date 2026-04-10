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
} from '@/types';
import {
  LineChart,
  Line,
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
  const [prs, setPrs] = useState<PersonalRecord[]>([]);
  const [homeGyms, setHomeGyms] = useState<HomeGym[]>([]);
  const [cycles, setCycles] = useState<CycleList | null>(null);
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [cycleMode, setCycleMode] = useState(false);
  const [viewMode, setViewMode] = useState<'volume' | 'orm'>('volume');
  
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

    setVolumeData(volume);
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

      // Add trainingDay to dataPoints for cycle mode
      const volumeWithTrainingDays = {
        ...volume,
        dataPoints: volume.dataPoints.map((point, index) => ({
          ...point,
          trainingDay: index + 1,
        })),
      };

      setVolumeData(volumeWithTrainingDays as any);
      setPrs(records.allTimePRs || []);
    } else {
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

                  {/* Gym Filter */}
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
                </div>

                {/* Row 2: Cycle Navigation (only in Cycle Mode) */}
                {cycleMode && allCycles.length > 0 && (
                  <div className="flex items-center justify-between border-t pt-4">
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

                {/* Row 3: Volume/ORM Toggle (only in Cycle Mode) */}
                {cycleMode && (
                  <div className="flex items-center gap-2 border-t pt-4">
                    <button
                      onClick={() => setViewMode('volume')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium ${
                        viewMode === 'volume'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Volumen
                    </button>
                    <button
                      onClick={() => setViewMode('orm')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium ${
                        viewMode === 'orm'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      %ORM
                    </button>
                  </div>
                )}

                {/* Row 4: Muscle Group Filter */}
                <div className="border-t pt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Muskelgruppe
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setMuscleFilter(undefined)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                        !muscleFilter
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Alle
                    </button>
                    {muscleGroups.map((mg) => (
                      <button
                        key={mg}
                        onClick={() => setMuscleFilter(mg)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                          muscleFilter === mg
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {translateMuscleGroup(mg)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Row 5: Equipment Filter */}
                <div className="border-t pt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Equipment
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setEquipmentFilter(undefined)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                        !equipmentFilter
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Alle
                    </button>
                    {equipments.map((eq) => (
                      <button
                        key={eq}
                        onClick={() => setEquipmentFilter(eq)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                          equipmentFilter === eq
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {translateEquipment(eq)}
                      </button>
                    ))}
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
                {(!cycleMode || viewMode === 'volume') && volumeData && volumeData.dataPoints.length > 0 && (
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Volumen-Entwicklung
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={volumeData.dataPoints}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey={cycleMode ? "trainingDay" : "date"}
                          tickFormatter={cycleMode ? (val) => `Tag ${val}` : formatDate}
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
                          labelFormatter={(label: any) =>
                            cycleMode ? `Tag ${label}` : formatDate(label as string)
                          }
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
                              dataKey="trainingDay"
                              tickFormatter={(val) => `Tag ${val}`}
                              style={{ fontSize: '12px' }}
                            />
                            <YAxis
                              tickFormatter={(value) => `${value}%`}
                              style={{ fontSize: '12px' }}
                            />
                            <Tooltip
                              formatter={(value: any) => [`${value}%`, '%ORM']}
                              labelFormatter={(label: any) => `Tag ${label}`}
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

                {/* Muscle Distribution Chart */}
                {volumeData && volumeData.byMuscleGroup && volumeData.byMuscleGroup.length > 0 && (
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
