'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth-context';
import { IconChevronLeft, IconPlus, IconX } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/date-picker';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { useFormErrors } from '@/hooks/useFormErrors';
import { toLocalDateString } from '@/lib/local-date';
import {
  BODY_WEIGHT_KG_MAX,
  BODY_WEIGHT_KG_MIN,
  HEIGHT_CM_MAX,
  HEIGHT_CM_MIN,
  HOME_GYMS_MAX,
  NAME_MAX,
  bodyLimits,
  checkBaseText,
  checkBirthDate,
  checkDecimal,
  checkEmail,
  checkInteger,
  checkPassword,
  checkPersonName,
} from '@/lib/field-rules';

interface HomeGymInput {
  name: string;
}

const gymKey = (index: number) => `homeGyms.${index}.name`;

export default function RegisterPage() {
  const t = useTranslations('RegisterPage');
  const { register } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
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

  // Field errors, the server's `fieldErrors` and the toast fallback all go through this (#222).
  // A gym's key is the path the server reports for it, `homeGyms.<row>.name`.
  const [form, formRef] = useFormErrors({
    fields: [
      'email', 'password', 'confirmPassword', 'firstName', 'lastName', 'dateOfBirth', 'height', 'weight',
      'homeGyms', ...homeGyms.map((_, i) => gymKey(i)),
    ],
    codeFields: { EMAIL_ALREADY_REGISTERED: 'email', PASSWORD_BREACHED: 'password' },
    // Nobody is signed in yet, so the limits are named in metric.
    messageValues: { ...bodyLimits('METRIC'), name: { max: NAME_MAX } },
  });

  const handleStep1Next = () => {
    const valid = form.setConstraints({
      email: checkEmail(email),
      password: checkPassword(password),
      confirmPassword:
        confirmPassword === '' ? 'isNotEmpty' : confirmPassword !== password ? 'passwordsDiffer' : null,
      firstName: checkPersonName(firstName),
      lastName: checkPersonName(lastName),
      dateOfBirth: checkBirthDate(
        dateOfBirth ? dateOfBirth.toISOString().slice(0, 10) : null,
        toLocalDateString(new Date()),
      ),
      height: checkInteger(height, HEIGHT_CM_MIN, HEIGHT_CM_MAX),
      weight: checkDecimal(weight, BODY_WEIGHT_KG_MIN, BODY_WEIGHT_KG_MAX, 1),
    });
    if (valid) setStep(2);
  };

  const handleAddGym = () => {
    setHomeGyms([...homeGyms, { name: '' }]);
  };

  const handleRemoveGym = (index: number) => {
    setHomeGyms(homeGyms.filter((_, i) => i !== index));
    form.clear('homeGyms');
    // Rows after the removed one shift up, so their errors would sit under the wrong gym.
    homeGyms.forEach((_, i) => form.clear(gymKey(i)));
  };

  const handleGymNameChange = (index: number, name: string) => {
    const updated = [...homeGyms];
    updated[index] = { name };
    setHomeGyms(updated);
    form.clear(gymKey(index));
    form.clear('homeGyms');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Every row is a gym: a blank row is an error, not silently dropped, so the row numbers the
    // server reports in `homeGyms.<row>.name` are the rows on screen.
    const valid = form.setConstraints({
      homeGyms: homeGyms.length === 0 ? 'arrayMinSize' : null,
      ...Object.fromEntries(homeGyms.map((gym, i) => [gymKey(i), checkBaseText(gym.name, NAME_MAX)])),
    });
    if (!valid) return;

    setLoading(true);

    try {
      // The submitted locale is derived server-side from the X-Locale header (#179), not
      // sent as a form field -- the user's own locale comes back on the response.
      const user = await register({
        email: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dateOfBirth: dateOfBirth!.toISOString().split('T')[0], // YYYY-MM-DD
        height: parseInt(height),
        weight: parseFloat(weight),
        homeGyms: homeGyms.map((gym) => ({ name: gym.name.trim() })),
      });
      // Hard navigation, not the locale-aware router -- see the matching comment in
      // login/page.tsx for why crossing locales needs a full page load.
      window.location.href = `/${user.locale}/dashboard`;
    } catch (err) {
      // A rejection of a step 1 field sends the user back to it.
      const placed = form.showApiError(err);
      if (placed.some((key) => !key.startsWith('homeGyms'))) setStep(1);
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
          <form ref={formRef} noValidate className="mt-8 space-y-6" onSubmit={(e) => { e.preventDefault(); handleStep1Next(); }}>
            <FieldGroup>
              {/* Email & Password */}
              <Field>
                <FieldLabel htmlFor="email">{t('email')}</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); form.clear('email'); }}
                  placeholder={t('emailPlaceholder')}
                  {...form.fieldProps('email')}
                />
                <FieldError id={form.errorId('email')}>{form.errors.email}</FieldError>
              </Field>

              <Field>
                <FieldLabel htmlFor="password">{t('password')}</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); form.clear('password'); }}
                  placeholder={t('passwordPlaceholder')}
                  {...form.fieldProps('password')}
                />
                <FieldError id={form.errorId('password')}>{form.errors.password}</FieldError>
              </Field>

              <Field>
                <FieldLabel htmlFor="confirm-password">{t('confirmPassword')}</FieldLabel>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); form.clear('confirmPassword'); }}
                  placeholder={t('confirmPlaceholder')}
                  {...form.fieldProps('confirmPassword')}
                />
                <FieldError id={form.errorId('confirmPassword')}>{form.errors.confirmPassword}</FieldError>
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
                      value={firstName}
                      onChange={(e) => { setFirstName(e.target.value); form.clear('firstName'); }}
                      placeholder={t('firstNamePlaceholder')}
                      {...form.fieldProps('firstName')}
                    />
                    <FieldError id={form.errorId('firstName')}>{form.errors.firstName}</FieldError>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="lastName">{t('lastName')}</FieldLabel>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => { setLastName(e.target.value); form.clear('lastName'); }}
                      placeholder={t('lastNamePlaceholder')}
                      {...form.fieldProps('lastName')}
                    />
                    <FieldError id={form.errorId('lastName')}>{form.errors.lastName}</FieldError>
                  </Field>
                </div>

                <Field>
                  <FieldLabel htmlFor="dateOfBirth">{t('dateOfBirth')}</FieldLabel>
                  <DatePicker
                    id="dateOfBirth"
                    date={dateOfBirth}
                    onSelect={(date) => { setDateOfBirth(date); form.clear('dateOfBirth'); }}
                    placeholder={t('dateOfBirthPlaceholder')}
                    {...form.fieldProps('dateOfBirth')}
                  />
                  <FieldError id={form.errorId('dateOfBirth')}>{form.errors.dateOfBirth}</FieldError>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel htmlFor="height">{t('height')}</FieldLabel>
                    <Input
                      id="height"
                      type="number"
                      min={HEIGHT_CM_MIN}
                      max={HEIGHT_CM_MAX}
                      step={1}
                      value={height}
                      onChange={(e) => { setHeight(e.target.value); form.clear('height'); }}
                      placeholder="180"
                      {...form.fieldProps('height')}
                    />
                    <FieldError id={form.errorId('height')}>{form.errors.height}</FieldError>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="weight">{t('weight')}</FieldLabel>
                    <Input
                      id="weight"
                      type="number"
                      step={0.1}
                      min={BODY_WEIGHT_KG_MIN}
                      max={BODY_WEIGHT_KG_MAX}
                      value={weight}
                      onChange={(e) => { setWeight(e.target.value); form.clear('weight'); }}
                      placeholder="75.0"
                      {...form.fieldProps('weight')}
                    />
                    <FieldError id={form.errorId('weight')}>{form.errors.weight}</FieldError>
                  </Field>
                </div>
              </FieldGroup>
            </div>

            <Button type="submit" className="w-full" size="lg">
              {t('next')}
            </Button>
          </form>
        ) : (
          <form ref={formRef} noValidate className="mt-8 space-y-6" onSubmit={handleSubmit}>
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
                    <div key={index} className="grid gap-1">
                      <div className="flex items-center gap-2">
                      <Input
                        value={gym.name}
                        onChange={(e) => handleGymNameChange(index, e.target.value)}
                        placeholder={t('gymPlaceholder')}
                        className="flex-1"
                        {...form.fieldProps(gymKey(index))}
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
                      <FieldError id={form.errorId(gymKey(index))}>{form.errors[gymKey(index)]}</FieldError>
                    </div>
                  ))}
                </FieldGroup>
              )}

              <FieldError id={form.errorId('homeGyms')}>{form.errors.homeGyms}</FieldError>

              {/* Add Home Gym button - centered, same style as add exercise in workouts */}
              <div className="flex justify-center py-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddGym}
                  className={homeGyms.length === 0 
                    ? "h-16 w-16 rounded-lg p-0 flex items-center justify-center" 
                    : "h-14 w-14 rounded-lg p-0 flex items-center justify-center"}
                  disabled={homeGyms.length >= HOME_GYMS_MAX}
                  aria-label={homeGyms.length === 0 ? t('addGym') : t('addAnotherGym')}
                >
                  <IconPlus className={homeGyms.length === 0 ? "size-8" : "size-7"} />
                </Button>
              </div>
            </FieldGroup>

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
