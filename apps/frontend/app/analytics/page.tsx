'use client';

import { ProtectedRoute } from '@/components/protected-route';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import {
  VolumeAnalytics,
  PersonalRecord,
  MuscleGroup,
  Equipment,
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

export default function AnalyticsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [volumeData, setVolumeData] = useState<VolumeAnalytics | null>(null);
  const [prs, setPrs] = useState<PersonalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [prMuscleFilter, setPrMuscleFilter] = useState<MuscleGroup | undefined>();
  const [prEquipmentFilter, setPrEquipmentFilter] = useState<Equipment | undefined>();

  useEffect(() => {
    loadAnalyticsData();
  }, [dateRange, prMuscleFilter, prEquipmentFilter]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      const endDate = new Date().toISOString();
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      const startDate = new Date(
        Date.now() - days * 24 * 60 * 60 * 1000
      ).toISOString();

      const [volume, records] = await Promise.all([
        apiClient.getVolumeAnalytics({ startDate, endDate }),
        apiClient.getPersonalRecords({
          muscleGroup: prMuscleFilter,
          equipment: prEquipmentFilter,
        }),
      ]);

      setVolumeData(volume);
      setPrs(records.allTimePRs || []);
    } catch (error) {
      console.error('Failed to load analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
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
                    className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
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
                    className="border-blue-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
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
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-lg text-gray-600">Lädt Analytics...</div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Header with Date Range Selector */}
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">
                    Trainingsanalyse
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDateRange('7d')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium ${
                        dateRange === '7d'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      7 Tage
                    </button>
                    <button
                      onClick={() => setDateRange('30d')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium ${
                        dateRange === '30d'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      30 Tage
                    </button>
                    <button
                      onClick={() => setDateRange('90d')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium ${
                        dateRange === '90d'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      90 Tage
                    </button>
                  </div>
                </div>

                {/* Volume Chart */}
                {volumeData && volumeData.dataPoints.length > 0 && (
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Volumen-Entwicklung
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={volumeData.dataPoints}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
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
                              `${translateMuscleGroup(entry.muscleGroup)} (${entry.percentage}%)`
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
                                {mg.percentage}%
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
                  
                  {/* PR Filters */}
                  <div className="p-6 border-b border-gray-200 space-y-4">
                    {/* Muscle Group Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Muskelgruppe
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setPrMuscleFilter(undefined)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                            !prMuscleFilter
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          Alle
                        </button>
                        {muscleGroups.map((mg) => (
                          <button
                            key={mg}
                            onClick={() => setPrMuscleFilter(mg)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                              prMuscleFilter === mg
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {translateMuscleGroup(mg)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Equipment Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Equipment
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setPrEquipmentFilter(undefined)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                            !prEquipmentFilter
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          Alle
                        </button>
                        {equipments.map((eq) => (
                          <button
                            key={eq}
                            onClick={() => setPrEquipmentFilter(eq)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                              prEquipmentFilter === eq
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
                                    {pr.details.weight}kg × {pr.details.reps} Wdh.
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
                        {prMuscleFilter || prEquipmentFilter
                          ? 'Keine persönlichen Rekorde für die ausgewählten Filter gefunden'
                          : 'Noch keine persönlichen Rekorde vorhanden'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Empty State */}
                {(!volumeData || volumeData.dataPoints.length === 0) && (
                  <div className="bg-white rounded-lg shadow p-12 text-center">
                    <p className="text-gray-600 mb-4">
                      Noch keine Daten für den gewählten Zeitraum vorhanden.
                    </p>
                    <Link
                      href="/workout"
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
                    >
                      Erstes Workout starten
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
