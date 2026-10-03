'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth-context';
import { IconChevronLeft, IconPlus, IconX } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/date-picker';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';

interface HomeGymInput {
  name: string;
}

export default function RegisterPage() {
  const t = useTranslations('RegisterPage');
  const apiError = useApiErrorMessage();
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
  const [homeGyms, setHomeGyms] = useState<HomeGymInput[]>([]);

  const handleStep1Next = () => {
    setError('');

    // Validation
    if (!email || !password || !confirmPassword || !firstName || !lastName || !dateOfBirth || !height || !weight) {
      setError(t('errors.missingFields'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('errors.passwordMismatch'));
      return;
    }

    if (password.length < 8) {
      setError(t('errors.passwordTooShort'));
      return;
    }

    const heightNum = parseInt(height);
    if (heightNum < 50 || heightNum > 300) {
      setError(t('errors.heightRange'));
      return;
    }

    const weightNum = parseFloat(weight);
    if (weightNum < 20 || weightNum > 500) {
      setError(t('errors.weightRange'));
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
      setError(t('errors.tooYoung'));
      return;
    }

    if (age > 120) {
      setError(t('errors.invalidBirthDate'));
      return;
    }

    setStep(2);
  };

  const handleAddGym = () => {
    setHomeGyms([...homeGyms, { name: '' }]);
  };

  const handleRemoveGym = (index: number) => {
    setHomeGyms(homeGyms.filter((_, i) => i !== index));
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
      setError(t('errors.noGym'));
      return;
    }

    setLoading(true);

    try {
      // The submitted locale is derived server-side from the X-Locale header (#179), not
      // sent as a form field -- the user's own locale comes back on the response.
      const user = await register({
        email,
        password,
        firstName,
        lastName,
        dateOfBirth: dateOfBirth!.toISOString().split('T')[0], // YYYY-MM-DD
        height: parseInt(height),
        weight: parseFloat(weight),
        homeGyms: validGyms,
      });
      // Hard navigation, not the locale-aware router -- see the matching comment in
      // login/page.tsx for why crossing locales needs a full page load.
      window.location.href = `/${user.locale}/dashboard`;
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight">
            {t('title')}
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            {step === 1 ? t('step1') : t('step2')}
          </p>
          {step === 1 && (
            <p className="mt-1 text-center text-sm text-muted-foreground">
              {t('or')}{' '}
              <Link href="/login" className="font-medium text-primary hover:underline">
                {t('signIn')}
              </Link>
            </p>
          )}
        </div>

        {step === 1 ? (
          <form className="mt-8 space-y-6" onSubmit={(e) => { e.preventDefault(); handleStep1Next(); }}>
            <FieldGroup>
              {/* Email & Password */}
              <Field>
                <FieldLabel htmlFor="email">{t('email')}</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('emailPlaceholder')}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="password">{t('password')}</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('passwordPlaceholder')}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="confirm-password">{t('confirmPassword')}</FieldLabel>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('confirmPlaceholder')}
                />
              </Field>
            </FieldGroup>

            {/* Personal Info */}
            <div className="pt-4">
              <div className="mb-3 text-sm font-medium text-muted-foreground">{t('personal')}</div>
              <FieldGroup>
                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel htmlFor="firstName">{t('firstName')}</FieldLabel>
                    <Input
                      id="firstName"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder={t('firstNamePlaceholder')}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="lastName">{t('lastName')}</FieldLabel>
                    <Input
                      id="lastName"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder={t('lastNamePlaceholder')}
                    />
                  </Field>
                </div>

                <Field>
                  <FieldLabel htmlFor="dateOfBirth">{t('dateOfBirth')}</FieldLabel>
                  <DatePicker
                    date={dateOfBirth}
                    onSelect={setDateOfBirth}
                    placeholder={t('dateOfBirthPlaceholder')}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel htmlFor="height">{t('height')}</FieldLabel>
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
                    <FieldLabel htmlFor="weight">{t('weight')}</FieldLabel>
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
              {t('next')}
            </Button>
          </form>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel>{t('homeGyms')}</FieldLabel>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  {t('homeGymsHint')}
                </p>
              </Field>

              {homeGyms.length > 0 && (
                <FieldGroup className="gap-3">
                  {homeGyms.map((gym, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={gym.name}
                        onChange={(e) => handleGymNameChange(index, e.target.value)}
                        placeholder={t('gymPlaceholder')}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveGym(index)}
                        aria-label={t('removeGym')}
                        className="text-muted-foreground hover:text-destructive shrink-0"
                      >
                        <IconX />
                      </Button>
                    </div>
                  ))}
                </FieldGroup>
              )}

              {/* Add Home Gym button - centered, same style as add exercise in workouts */}
              <div className="flex justify-center py-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddGym}
                  className={homeGyms.length === 0 
                    ? "h-16 w-16 rounded-lg p-0 flex items-center justify-center" 
                    : "h-14 w-14 rounded-lg p-0 flex items-center justify-center"}
                  aria-label={homeGyms.length === 0 ? t('addGym') : t('addAnotherGym')}
                >
                  <IconPlus className={homeGyms.length === 0 ? "size-8" : "size-7"} />
                </Button>
              </div>
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
                {t('back')}
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? t('creating') : t('create')}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
