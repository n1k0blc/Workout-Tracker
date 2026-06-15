'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ChevronLeft, Plus, X } from 'lucide-react';

interface HomeGymInput {
  name: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Step 1: Account & Profile
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');

  // Step 2: Home Gyms
  const [homeGyms, setHomeGyms] = useState<HomeGymInput[]>([{ name: '' }]);

  const handleStep1Next = () => {
    setError('');

    // Validation
    if (!email || !password || !confirmPassword || !firstName || !lastName || !dateOfBirth || !height || !weight) {
      setError('Bitte fülle alle Felder aus');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwörter stimmen nicht überein');
      return;
    }

    if (password.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen lang sein');
      return;
    }

    const heightNum = parseInt(height);
    if (heightNum < 50 || heightNum > 300) {
      setError('Größe muss zwischen 50 und 300 cm liegen');
      return;
    }

    const weightNum = parseFloat(weight);
    if (weightNum < 20 || weightNum > 500) {
      setError('Gewicht muss zwischen 20 und 500 kg liegen');
      return;
    }

    // Calculate age
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < 13) {
      setError('Du musst mindestens 13 Jahre alt sein');
      return;
    }

    if (age > 120) {
      setError('Bitte gib ein gültiges Geburtsdatum ein');
      return;
    }

    setStep(2);
  };

  const handleAddGym = () => {
    setHomeGyms([...homeGyms, { name: '' }]);
  };

  const handleRemoveGym = (index: number) => {
    if (homeGyms.length > 1) {
      setHomeGyms(homeGyms.filter((_, i) => i !== index));
    }
  };

  const handleGymNameChange = (index: number, name: string) => {
    const updated = [...homeGyms];
    updated[index] = { name };
    setHomeGyms(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate homeGyms
    const validGyms = homeGyms.filter(gym => gym.name.trim() !== '');
    if (validGyms.length === 0) {
      setError('Bitte füge mindestens ein Home Gym hinzu');
      return;
    }

    setLoading(true);

    try {
      await register({
        email,
        password,
        firstName,
        lastName,
        dateOfBirth: dateOfBirth!.toISOString().split('T')[0], // YYYY-MM-DD
        height: parseInt(height),
        weight: parseFloat(weight),
        homeGyms: validGyms,
      });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registrierung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
            Registrieren
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {step === 1 ? 'Schritt 1 von 2: Deine Daten' : 'Schritt 2 von 2: Deine Studios'}
          </p>
          {step === 1 && (
            <p className="mt-1 text-center text-sm text-gray-600">
              Oder{' '}
              <Link
                href="/login"
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                melde dich mit bestehendem Account an
              </Link>
            </p>
          )}
        </div>

        {step === 1 ? (
          <form className="mt-8 space-y-4" onSubmit={(e) => { e.preventDefault(); handleStep1Next(); }}>
            {/* Email & Password */}
            <div className="space-y-3">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  E-Mail-Adresse
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="max@example.com"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Passwort
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Mindestens 6 Zeichen"
                />
              </div>
              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
                  Passwort bestätigen
                </label>
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Passwort wiederholen"
                />
              </div>
            </div>

            {/* Personal Info */}
            <div className="space-y-3 pt-4 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-900">Persönliche Daten</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                    Vorname
                  </label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Max"
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                    Nachname
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Mustermann"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 mb-1">
                  Geburtsdatum
                </label>
                <DatePicker
                  id="dateOfBirth"
                  selected={dateOfBirth}
                  onChange={(date: Date | null) => setDateOfBirth(date)}
                  dateFormat="dd.MM.yyyy"
                  showYearDropdown
                  scrollableYearDropdown
                  yearDropdownItemNumber={100}
                  maxDate={new Date()}
                  placeholderText="TT.MM.JJJJ"
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="height" className="block text-sm font-medium text-gray-700 mb-1">
                    Größe (cm)
                  </label>
                  <input
                    id="height"
                    name="height"
                    type="number"
                    min="50"
                    max="300"
                    required
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="180"
                  />
                </div>
                <div>
                  <label htmlFor="weight" className="block text-sm font-medium text-gray-700 mb-1">
                    Gewicht (kg)
                  </label>
                  <input
                    id="weight"
                    name="weight"
                    type="number"
                    step="0.1"
                    min="20"
                    max="500"
                    required
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="75.0"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Weiter
              </button>
            </div>
          </form>
        ) : (
          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Deine Home Gyms
                </label>
                <button
                  type="button"
                  onClick={handleAddGym}
                  className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Hinzufügen
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Füge die Studios hinzu, in denen du trainierst. Du kannst später weitere hinzufügen.
              </p>
              <div className="space-y-2">
                {homeGyms.map((gym, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={gym.name}
                      onChange={(e) => handleGymNameChange(index, e.target.value)}
                      placeholder={index === 0 ? "z.B. Mein Home Gym" : "Studio Name"}
                      className="flex-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                    {homeGyms.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveGym(index)}
                        className="p-2 text-gray-400 hover:text-red-500 focus:outline-none"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 flex items-center justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Zurück
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Wird erstellt...' : 'Account erstellen'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
