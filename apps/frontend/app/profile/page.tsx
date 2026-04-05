'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api/client';
import { HomeGym } from '@/types';
import { UserCircle, Plus, X, Edit2, Check } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Profile Data
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // HomeGyms
  const [homeGyms, setHomeGyms] = useState<HomeGym[]>([]);
  const [newGymName, setNewGymName] = useState('');
  const [editingGymId, setEditingGymId] = useState<string | null>(null);
  const [editingGymName, setEditingGymName] = useState('');

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setDateOfBirth(user.dateOfBirth ? new Date(user.dateOfBirth) : null);
      setHeight(user.height?.toString() || '');
      setWeight(user.weight?.toString() || '');
      if (user.homeGyms) {
        setHomeGyms(user.homeGyms);
      }
    }
  }, [user]);

  useEffect(() => {
    loadHomeGyms();
  }, []);

  const loadHomeGyms = async () => {
    try {
      const gyms = await apiClient.getHomeGyms();
      setHomeGyms(gyms);
    } catch (err) {
      console.error('Failed to load home gyms:', err);
    }
  };

  const calculateAge = (dob: Date): number => {
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  };

  const handleUpdateProfile = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Validate
      if (!firstName || !lastName || !dateOfBirth || !height || !weight) {
        throw new Error('Bitte alle Felder ausfüllen');
      }

      const heightNum = parseInt(height);
      const weightNum = parseFloat(weight);

      if (heightNum < 50 || heightNum > 300) {
        throw new Error('Größe muss zwischen 50 und 300 cm liegen');
      }

      if (weightNum < 20 || weightNum > 500) {
        throw new Error('Gewicht muss zwischen 20 und 500 kg liegen');
      }

      const age = calculateAge(dateOfBirth);
      if (age < 13 || age > 120) {
        throw new Error('Alter muss zwischen 13 und 120 Jahren liegen');
      }

      await apiClient.updateProfile({
        firstName,
        lastName,
        dateOfBirth: dateOfBirth.toISOString().split('T')[0],
        height: heightNum,
        weight: weightNum,
      });

      setSuccess('Profil erfolgreich aktualisiert');
      setIsEditingProfile(false);
      
      // Reload user data
      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Fehler beim Aktualisieren des Profils');
    } finally {
      setLoading(false);
    }
  };

  const handleAddGym = async () => {
    if (!newGymName.trim()) return;

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const gym = await apiClient.createHomeGym({ name: newGymName.trim() });
      setHomeGyms([...homeGyms, gym]);
      setNewGymName('');
      setSuccess('Gym erfolgreich hinzugefügt');
    } catch (err: any) {
      setError(err.message || 'Fehler beim Hinzufügen des Gyms');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateGym = async (id: string) => {
    if (!editingGymName.trim()) return;

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const updatedGym = await apiClient.updateHomeGym(id, { name: editingGymName.trim() });
      setHomeGyms(homeGyms.map((g) => (g.id === id ? updatedGym : g)));
      setEditingGymId(null);
      setEditingGymName('');
      setSuccess('Gym erfolgreich aktualisiert');
    } catch (err: any) {
      setError(err.message || 'Fehler beim Aktualisieren des Gyms');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGym = async (id: string) => {
    if (!confirm('Gym wirklich löschen? Dies ist nicht möglich, wenn das Gym in Workouts verwendet wird.')) {
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await apiClient.deleteHomeGym(id);
      setHomeGyms(homeGyms.filter((g) => g.id !== id));
      setSuccess('Gym erfolgreich gelöscht');
    } catch (err: any) {
      setError(err.message || 'Fehler beim Löschen des Gyms. Möglicherweise wird es noch in Workouts verwendet.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <UserCircle className="h-8 w-8" />
            Mein Profil
          </h1>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-600">
            {success}
          </div>
        )}

        {/* Profile Section */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-6 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Profildaten</h2>
            {!isEditingProfile ? (
              <button
                onClick={() => setIsEditingProfile(true)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Bearbeiten
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditingProfile(false)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleUpdateProfile}
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Speichern
                </button>
              </div>
            )}
          </div>

          <div className="p-6">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vorname
                  </label>
                  {isEditingProfile ? (
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{firstName || '-'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nachname
                  </label>
                  {isEditingProfile ? (
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{lastName || '-'}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <p className="text-gray-900">{user?.email}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Geburtsdatum {dateOfBirth && `(${calculateAge(dateOfBirth)} Jahre)`}
                </label>
                {isEditingProfile ? (
                  <DatePicker
                    selected={dateOfBirth}
                    onChange={(date) => setDateOfBirth(date)}
                    dateFormat="dd.MM.yyyy"
                    showYearDropdown
                    scrollableYearDropdown
                    yearDropdownItemNumber={100}
                    maxDate={new Date()}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">
                    {dateOfBirth ? dateOfBirth.toLocaleDateString('de-DE') : '-'}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Größe (cm)
                  </label>
                  {isEditingProfile ? (
                    <input
                      type="number"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      min="50"
                      max="300"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{height ? `${height} cm` : '-'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gewicht (kg)
                  </label>
                  {isEditingProfile ? (
                    <input
                      type="number"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      min="20"
                      max="500"
                      step="0.1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{weight ? `${weight} kg` : '-'}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* HomeGyms Section */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Meine Gyms</h2>
          </div>

          <div className="p-6">
            {/* Add New Gym */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Neues Gym hinzufügen
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newGymName}
                  onChange={(e) => setNewGymName(e.target.value)}
                  placeholder="Gym-Name"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddGym()}
                />
                <button
                  onClick={handleAddGym}
                  disabled={loading || !newGymName.trim()}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Hinzufügen
                </button>
              </div>
            </div>

            {/* Gym List */}
            <div className="space-y-2">
              {homeGyms.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  Noch keine Gyms hinzugefügt
                </p>
              ) : (
                homeGyms.map((gym) => (
                  <div
                    key={gym.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-md hover:bg-gray-50"
                  >
                    {editingGymId === gym.id ? (
                      <>
                        <input
                          type="text"
                          value={editingGymName}
                          onChange={(e) => setEditingGymName(e.target.value)}
                          className="flex-1 px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          onKeyPress={(e) => e.key === 'Enter' && handleUpdateGym(gym.id)}
                        />
                        <div className="flex gap-2 ml-2">
                          <button
                            onClick={() => handleUpdateGym(gym.id)}
                            className="p-1 text-green-600 hover:text-green-700"
                          >
                            <Check className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingGymId(null);
                              setEditingGymName('');
                            }}
                            className="p-1 text-gray-600 hover:text-gray-700"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="text-gray-900 font-medium">{gym.name}</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingGymId(gym.id);
                              setEditingGymName(gym.name);
                            }}
                            className="p-1 text-blue-600 hover:text-blue-700"
                          >
                            <Edit2 className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteGym(gym.id)}
                            disabled={loading}
                            className="p-1 text-red-600 hover:text-red-700 disabled:opacity-50"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Logout Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <button
            onClick={handleLogout}
            className="w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
          >
            Abmelden
          </button>
        </div>
      </div>
    </div>
  );
}
