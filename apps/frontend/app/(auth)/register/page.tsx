'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { IconChevronLeft, IconPlus, IconX } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/date-picker';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight">
            Registrieren
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            {step === 1 ? 'Schritt 1 von 2: Deine Daten' : 'Schritt 2 von 2: Deine Studios'}
          </p>
          {step === 1 && (
            <p className="mt-1 text-center text-sm text-muted-foreground">
              Oder{' '}
              <Link href="/login" className="font-medium text-primary hover:underline">
                melde dich mit bestehendem Account an
              </Link>
            </p>
          )}
        </div>

        {step === 1 ? (
          <form className="mt-8 space-y-6" onSubmit={(e) => { e.preventDefault(); handleStep1Next(); }}>
            <FieldGroup>
              {/* Email & Password */}
              <Field>
                <FieldLabel htmlFor="email">E-Mail-Adresse</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="max@example.com"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="password">Passwort</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mindestens 6 Zeichen"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="confirm-password">Passwort bestätigen</FieldLabel>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Passwort wiederholen"
                />
              </Field>
            </FieldGroup>

            {/* Personal Info */}
            <div className="pt-4">
              <div className="mb-3 text-sm font-medium text-muted-foreground">Persönliche Daten</div>
              <FieldGroup>
                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel htmlFor="firstName">Vorname</FieldLabel>
                    <Input
                      id="firstName"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Max"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="lastName">Nachname</FieldLabel>
                    <Input
                      id="lastName"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Mustermann"
                    />
                  </Field>
                </div>

                <Field>
                  <FieldLabel htmlFor="dateOfBirth">Geburtsdatum</FieldLabel>
                  <DatePicker
                    date={dateOfBirth}
                    onSelect={setDateOfBirth}
                    placeholder="TT.MM.JJJJ"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel htmlFor="height">Größe (cm)</FieldLabel>
                    <Input
                      id="height"
                      type="number"
                      min="50"
                      max="300"
                      required
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      placeholder="180"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="weight">Gewicht (kg)</FieldLabel>
                    <Input
                      id="weight"
                      type="number"
                      step="0.1"
                      min="20"
                      max="500"
                      required
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      placeholder="75.0"
                    />
                  </Field>
                </div>
              </FieldGroup>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" size="lg">
              Weiter
            </Button>
          </form>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <div className="flex items-center justify-between">
                  <FieldLabel>Deine Home Gyms</FieldLabel>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleAddGym}
                    className="text-primary hover:text-primary/80"
                  >
                    <IconPlus className="mr-1 size-4" />
                    Hinzufügen
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Füge die Studios hinzu, in denen du trainierst. Du kannst später weitere hinzufügen.
                </p>
              </Field>

              <FieldGroup className="gap-3">
                {homeGyms.map((gym, index) => (
                  <Field key={index} className="flex-row items-center gap-2">
                    <Input
                      value={gym.name}
                      onChange={(e) => handleGymNameChange(index, e.target.value)}
                      placeholder={index === 0 ? "z.B. Mein Home Gym" : "Studio Name"}
                      className="flex-1"
                    />
                    {homeGyms.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveGym(index)}
                        className="text-muted-foreground hover:text-destructive shrink-0"
                      >
                        <IconX />
                      </Button>
                    )}
                  </Field>
                ))}
              </FieldGroup>
            </FieldGroup>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setStep(1)}
              >
                <IconChevronLeft className="mr-1 size-4" />
                Zurück
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? 'Wird erstellt...' : 'Account erstellen'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
