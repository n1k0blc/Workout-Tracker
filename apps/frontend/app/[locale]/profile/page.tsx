'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth-context';
import { useUnitSystem } from '@/lib/use-units';
import {
  weightInputString,
  weightToKg,
  weightUnitLabel,
  heightInputString,
  heightToCm,
  heightUnitLabel,
} from '@/lib/units';
import { toLocalDateString } from '@/lib/local-date';
import { notify } from '@/lib/toast';
import { apiClient } from '@/lib/api/client';
import { HomeGym } from '@/types';
import {
  IconPlus,
  IconX,
  IconEdit,
  IconCheck,
  IconTrash,
  IconLock,
} from '@tabler/icons-react';
import {
  kcalFromMacros,
  dailyTargetMacroHint,
  targetProgressPercent,
  formatKcal,
} from '@/lib/nutrition';
import { MacroProgressBar } from '@/components/nutrition/macro-progress-bar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { LogoutButton } from '@/components/logout-button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePicker } from '@/components/date-picker';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useFormErrors } from '@/hooks/useFormErrors';
import {
  HOME_GYMS_MAX,
  NAME_MAX,
  TARGET_KCAL_MAX,
  TARGET_KCAL_MIN,
  TARGET_MACRO_MAX,
  TARGET_MACRO_MIN,
  bodyLimits,
  checkBaseText,
  checkBirthDate,
  checkBodyWeight,
  checkEmail,
  checkHeight,
  checkInteger,
  checkPassword,
  checkPersonName,
  type Constraint,
} from '@/lib/field-rules';

/** A Tagesziel may be left blank (it clears the target); otherwise a whole number in range. */
const checkTarget = (raw: string, min: number, max: number): Constraint =>
  raw.trim() === '' ? null : checkInteger(raw.trim(), min, max);

export default function ProfilePage() {
  const t = useTranslations('Profile');
  const apiError = useApiErrorMessage();
  const format = useFormatter();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);

  // Profile Data
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Tagesziele (#152) - manual daily targets, each field blank when unset
  const [targetKcal, setTargetKcal] = useState('');
  const [targetCarbs, setTargetCarbs] = useState('');
  const [targetProtein, setTargetProtein] = useState('');
  const [targetFat, setTargetFat] = useState('');
  const [isEditingTargets, setIsEditingTargets] = useState(false);
  const [targetsLoading, setTargetsLoading] = useState(false);

  // Change Password
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordForm, passwordFormRef] = useFormErrors({
    fields: ['currentPassword', 'newPassword', 'confirmNewPassword'],
    codeFields: { CURRENT_PASSWORD_INCORRECT: 'currentPassword', PASSWORD_BREACHED: 'newPassword' },
  });
  const [passwordLoading, setPasswordLoading] = useState(false);

  // HomeGyms
  const [homeGyms, setHomeGyms] = useState<HomeGym[]>([]);
  const [newGymName, setNewGymName] = useState('');
  const [editingGymId, setEditingGymId] = useState<string | null>(null);
  const [editingGymName, setEditingGymName] = useState('');
  const [deleteGymId, setDeleteGymId] = useState<string | null>(null);

  // Language (#179). foodMarket also exists on User but gets no UI until a second market does.
  const [localeValue, setLocaleValue] = useState<'de' | 'en'>('de');
  const [localeSaving, setLocaleSaving] = useState(false);

  // Unit system (#186): display-only. Weight/height inputs are prefilled in it, but stored
  // values are only rewritten when the user actually edits the field (see lib/units.ts).
  const unitSystem = useUnitSystem();
  const [unitSaving, setUnitSaving] = useState(false);

  // Field errors per card; whatever the server rejects that has no field here becomes a toast.
  // Height and weight limits are named in the user's own unit (#230).
  const [profileForm, profileFormRef] = useFormErrors({
    fields: ['email', 'firstName', 'lastName', 'dateOfBirth', 'height', 'weight'],
    codeFields: { EMAIL_ALREADY_IN_USE: 'email' },
    messageValues: bodyLimits(unitSystem),
  });
  const [targetsForm, targetsFormRef] = useFormErrors({
    fields: ['targetKcal', 'targetCarbs', 'targetProtein', 'targetFat'],
    messageValues: {
      targetKcal: { min: TARGET_KCAL_MIN, max: TARGET_KCAL_MAX },
      targetCarbs: { min: TARGET_MACRO_MIN, max: TARGET_MACRO_MAX },
      targetProtein: { min: TARGET_MACRO_MIN, max: TARGET_MACRO_MAX },
      targetFat: { min: TARGET_MACRO_MIN, max: TARGET_MACRO_MAX },
    },
  });
  const gymMessageValues = { name: { max: NAME_MAX }, homeGyms: { max: HOME_GYMS_MAX } };
  const [addGymForm, addGymFormRef] = useFormErrors({
    fields: ['name', 'homeGyms'],
    codeFields: { HOME_GYM_LIMIT_REACHED: 'homeGyms' },
    messageValues: gymMessageValues,
  });
  const [editGymForm, editGymFormRef] = useFormErrors({
    fields: ['name'],
    messageValues: gymMessageValues,
  });
  const [isAddGymOpen, setIsAddGymOpen] = useState(false);

  useEffect(() => {
    if (user) {
      setEmail(user.email || '');
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setDateOfBirth(user.dateOfBirth ? new Date(user.dateOfBirth) : null);
      setHeight(user.height != null ? heightInputString(user.height, unitSystem) : '');
      setWeight(user.weight != null ? weightInputString(user.weight, unitSystem) : '');
      setTargetKcal(user.targetKcal?.toString() || '');
      setTargetCarbs(user.targetCarbs?.toString() || '');
      setTargetProtein(user.targetProtein?.toString() || '');
      setTargetFat(user.targetFat?.toString() || '');
      setLocaleValue(user.locale);
      if (user.homeGyms) {
        setHomeGyms(user.homeGyms);
      }
    }
  }, [user, unitSystem]);

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
    const valid = profileForm.setConstraints({
      email: checkEmail(email),
      firstName: checkPersonName(firstName),
      lastName: checkPersonName(lastName),
      dateOfBirth: checkBirthDate(
        dateOfBirth ? dateOfBirth.toISOString().slice(0, 10) : null,
        toLocalDateString(new Date()),
      ),
      height: checkHeight(height, unitSystem, user?.height),
      weight: checkBodyWeight(weight, unitSystem, user?.weight),
    });
    if (!valid) return;

    setLoading(true);

    try {
      // Typed values are exact in the user's own unit and converted once; untouched
      // fields keep their stored cm/kg (never write back a value the user did not type).
      await apiClient.updateProfile({
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dateOfBirth: dateOfBirth!.toISOString().split('T')[0],
        height: heightToCm(height, unitSystem, user?.height)!,
        weight: weightToKg(weight, unitSystem, user?.weight)!,
      });

      notify.success(t('profileData.updated'));
      setIsEditingProfile(false);

      // Reload user data
      window.location.reload();
    } catch (err) {
      profileForm.showApiError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTargets = async () => {
    const valid = targetsForm.setConstraints({
      targetKcal: checkTarget(targetKcal, TARGET_KCAL_MIN, TARGET_KCAL_MAX),
      targetCarbs: checkTarget(targetCarbs, TARGET_MACRO_MIN, TARGET_MACRO_MAX),
      targetProtein: checkTarget(targetProtein, TARGET_MACRO_MIN, TARGET_MACRO_MAX),
      targetFat: checkTarget(targetFat, TARGET_MACRO_MIN, TARGET_MACRO_MAX),
    });
    if (!valid) return;

    setTargetsLoading(true);

    try {
      // A blank field clears its target (null).
      const orNull = (raw: string) => (raw.trim() === '' ? null : Number(raw.trim()));
      await apiClient.updateProfile({
        targetKcal: orNull(targetKcal),
        targetCarbs: orNull(targetCarbs),
        targetProtein: orNull(targetProtein),
        targetFat: orNull(targetFat),
      });

      notify.success(t('targets.saved'));
      setIsEditingTargets(false);
      window.location.reload();
    } catch (err) {
      targetsForm.showApiError(err);
    } finally {
      setTargetsLoading(false);
    }
  };

  const handleAddGym = async () => {
    const valid = addGymForm.setConstraints({
      name: checkBaseText(newGymName, NAME_MAX),
      homeGyms: homeGyms.length >= HOME_GYMS_MAX ? 'arrayMaxSize' : null,
    });
    if (!valid) return;

    setLoading(true);

    try {
      const gym = await apiClient.createHomeGym({ name: newGymName.trim() });
      setHomeGyms([...homeGyms, gym]);
      setNewGymName('');
      notify.success(t('gyms.added'));
    } catch (err) {
      addGymForm.showApiError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateGym = async (id: string) => {
    if (!editGymForm.setConstraints({ name: checkBaseText(editingGymName, NAME_MAX) })) return;

    setLoading(true);

    try {
      const updatedGym = await apiClient.updateHomeGym(id, { name: editingGymName.trim() });
      setHomeGyms(homeGyms.map((g) => (g.id === id ? updatedGym : g)));
      setEditingGymId(null);
      setEditingGymName('');
      notify.success(t('gyms.updated'));
    } catch (err) {
      editGymForm.showApiError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGym = async (id: string) => {
    setDeleteGymId(null);
    setLoading(true);

    try {
      await apiClient.deleteHomeGym(id);
      setHomeGyms(homeGyms.filter((g) => g.id !== id));
      notify.success(t('gyms.deleted'));
    } catch (err) {
      notify.error(apiError(err, t('gyms.deleteError')));
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    const valid = passwordForm.setConstraints({
      currentPassword: checkPassword(currentPassword),
      newPassword: checkPassword(newPassword),
      confirmNewPassword:
        confirmNewPassword === ''
          ? 'isNotEmpty'
          : confirmNewPassword !== newPassword
            ? 'passwordsDiffer'
            : null,
    });
    if (!valid) return;

    setPasswordLoading(true);

    try {
      await apiClient.changePassword({ currentPassword, newPassword });
      // Changing the password revokes every session server-side (including this
      // one) - log out locally and send the user back to /login to re-authenticate.
      setIsPasswordDialogOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      await logout();
      router.push('/login');
    } catch (err: any) {
      passwordForm.showApiError(err);
    } finally {
      setPasswordLoading(false);
    }
  };

  // Persists then navigates to the new locale-prefixed URL -- a real navigation, not just
  // local state, since the acceptance criterion is the URL/catalogue actually switching
  // (#179). Middleware/next-intl resync the NEXT_LOCALE cookie once that URL loads.
  //
  // A hard navigation (window.location.href), not the locale-aware router: crossing
  // locales remounts the root layout (it owns <html lang>) purely client-side, and
  // next-themes' anti-flash inline <script> (part of every ThemeProvider render)
  // triggers a "script tag while rendering on the client" console error on that remount.
  // A full page load re-renders it server-side, where the script is part of the initial
  // HTML and hydration matches it without complaint.
  const handleLocaleChange = async (next: string) => {
    if (next !== 'de' && next !== 'en') return;

    setLocaleSaving(true);

    try {
      await apiClient.updateProfile({ locale: next });
      window.location.href = `/${next}/profile`;
    } catch (err) {
      notify.error(apiError(err, t('language.updateError')));
      setLocaleSaving(false);
    }
  };

  // Reloads rather than patching auth state: every weight in the app re-renders in the new
  // system, and the auth context has no setter for the user.
  const handleUnitSystemChange = async (next: string) => {
    if (next !== 'METRIC' && next !== 'IMPERIAL') return;

    setUnitSaving(true);

    try {
      await apiClient.updateProfile({ unitSystem: next });
      window.location.reload();
    } catch (err) {
      notify.error(apiError(err, t('units.updateError')));
      setUnitSaving(false);
    }
  };

  // Tagesziele card: the footer compares the macro targets' energy (4/4/9) to the kcal target
  // and shows a fill bar, exactly as the Schnelleintrag hint does.
  const targetMacros = {
    carbs: Number(targetCarbs.trim()) || 0,
    protein: Number(targetProtein.trim()) || 0,
    fat: Number(targetFat.trim()) || 0,
  };
  const targetMacroKcal = kcalFromMacros(targetMacros);
  const kcalTargetNum = targetKcal.trim() === '' ? null : Number(targetKcal.trim());
  const targetHint = dailyTargetMacroHint(kcalTargetNum, targetMacros);
  const anyTargetSet = [targetKcal, targetCarbs, targetProtein, targetFat].some(
    (s) => s.trim() !== '',
  );
  const targetBarPercent = targetProgressPercent(targetMacroKcal, kcalTargetNum);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback>
                {user?.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            {t('title')}
          </h1>
        </div>

        {/* Tagesziele Section (#152) */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-y-2">
            <CardTitle>{t('targets.title')}</CardTitle>
            {!isEditingTargets ? (
              <Button variant="outline" onClick={() => setIsEditingTargets(true)}>
                <IconEdit className="mr-2 size-4" />
                {t('common.edit')}
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEditingTargets(false);
                    for (const key of ['targetKcal', 'targetCarbs', 'targetProtein', 'targetFat']) {
                      targetsForm.clear(key);
                    }
                    setTargetKcal(user?.targetKcal?.toString() || '');
                    setTargetCarbs(user?.targetCarbs?.toString() || '');
                    setTargetProtein(user?.targetProtein?.toString() || '');
                    setTargetFat(user?.targetFat?.toString() || '');
                  }}
                >
                  {t('common.cancel')}
                </Button>
                <Button size="sm" onClick={handleUpdateTargets} disabled={targetsLoading}>
                  <IconCheck className="mr-2 size-4" />
                  {t('common.save')}
                </Button>
              </div>
            )}
          </CardHeader>

          <CardContent ref={targetsFormRef}>
            {!isEditingTargets && !anyTargetSet ? (
              <p className="text-sm text-muted-foreground">{t('targets.empty')}</p>
            ) : (
              <div className="space-y-5">
                <Field>
                  <FieldLabel htmlFor="targetKcal">{t('targets.kcalLabel')}</FieldLabel>
                  {isEditingTargets ? (
                    <>
                      <Input
                        id="targetKcal"
                        type="number"
                        inputMode="numeric"
                        value={targetKcal}
                        onChange={(e) => {
                          setTargetKcal(e.target.value);
                          targetsForm.clear('targetKcal');
                        }}
                        min={TARGET_KCAL_MIN}
                        max={TARGET_KCAL_MAX}
                        step={1}
                        placeholder={t('targets.kcalPlaceholder')}
                        {...targetsForm.fieldProps('targetKcal')}
                      />
                      <FieldError id={targetsForm.errorId('targetKcal')}>
                        {targetsForm.errors.targetKcal}
                      </FieldError>
                    </>
                  ) : (
                    <p className="flex items-baseline gap-1.5 py-2">
                      <span className="text-2xl font-bold">
                        {targetKcal.trim() ? formatKcal(Number(targetKcal)) : '–'}
                      </span>
                      <span className="text-sm text-muted-foreground">{t('targets.perDay')}</span>
                    </p>
                  )}
                </Field>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: 'targetCarbs', label: t('targets.carbsLabel'), value: targetCarbs, set: setTargetCarbs },
                    { key: 'targetProtein', label: t('targets.proteinLabel'), value: targetProtein, set: setTargetProtein },
                    { key: 'targetFat', label: t('targets.fatLabel'), value: targetFat, set: setTargetFat },
                  ].map((f) => (
                    <Field key={f.key}>
                      <FieldLabel htmlFor={f.key}>{f.label}</FieldLabel>
                      {isEditingTargets ? (
                        <>
                          <Input
                            id={f.key}
                            type="number"
                            inputMode="numeric"
                            value={f.value}
                            onChange={(e) => {
                              f.set(e.target.value);
                              targetsForm.clear(f.key);
                            }}
                            min={TARGET_MACRO_MIN}
                            max={TARGET_MACRO_MAX}
                            step={1}
                            placeholder={t('targets.gramsPlaceholder')}
                            {...targetsForm.fieldProps(f.key)}
                          />
                          <FieldError id={targetsForm.errorId(f.key)}>{targetsForm.errors[f.key]}</FieldError>
                        </>
                      ) : (
                        <p className="py-2">
                          <span className="text-base font-semibold">
                            {f.value.trim() ? Number(f.value) : '–'}
                          </span>
                          <span className="text-xs text-muted-foreground"> {t('targets.gramsUnit')}</span>
                        </p>
                      )}
                    </Field>
                  ))}
                </div>

                {(isEditingTargets || anyTargetSet) && (
                  <div className="border-t pt-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{t('targets.macrosResult')}</span>
                      <span className="text-[13px] font-semibold">
                        {formatKcal(targetMacroKcal)} {t('targets.kcalUnit')}
                      </span>
                    </div>
                    <MacroProgressBar percent={targetBarPercent} className="mt-2.5" />
                    {targetHint && (
                      <p className="mt-2.5 text-xs text-muted-foreground">
                        {targetHint.kind === 'match'
                          ? t('targets.hintMatch')
                          : t(targetHint.kind === 'under' ? 'targets.hintUnder' : 'targets.hintOver', {
                              kcal: targetHint.kcal,
                            })}{' '}
                        {t('targets.hintTail')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Profile Section */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-y-2">
            <CardTitle>{t('profileData.title')}</CardTitle>
            {!isEditingProfile ? (
              <Button
                variant="outline"
                onClick={() => setIsEditingProfile(true)}
              >
                <IconEdit className="mr-2 size-4" />
                {t('common.edit')}
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEditingProfile(false);
                    for (const key of ['email', 'firstName', 'lastName', 'dateOfBirth', 'height', 'weight']) {
                      profileForm.clear(key);
                    }
                  }}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  size="sm"
                  onClick={handleUpdateProfile}
                  disabled={loading}
                >
                  <IconCheck className="mr-2 size-4" />
                  {t('common.save')}
                </Button>
              </div>
            )}
          </CardHeader>

          <CardContent ref={profileFormRef}>
            <FieldGroup>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="firstName">{t('profileData.firstName')}</FieldLabel>
                  {isEditingProfile ? (
                    <>
                      <Input
                        id="firstName"
                        value={firstName}
                        onChange={(e) => {
                          setFirstName(e.target.value);
                          profileForm.clear('firstName');
                        }}
                        {...profileForm.fieldProps('firstName')}
                      />
                      <FieldError id={profileForm.errorId('firstName')}>{profileForm.errors.firstName}</FieldError>
                    </>
                  ) : (
                    <p className="text-foreground py-2">{firstName || t('profileData.empty')}</p>
                  )}
                </Field>

                <Field>
                  <FieldLabel htmlFor="lastName">{t('profileData.lastName')}</FieldLabel>
                  {isEditingProfile ? (
                    <>
                      <Input
                        id="lastName"
                        value={lastName}
                        onChange={(e) => {
                          setLastName(e.target.value);
                          profileForm.clear('lastName');
                        }}
                        {...profileForm.fieldProps('lastName')}
                      />
                      <FieldError id={profileForm.errorId('lastName')}>{profileForm.errors.lastName}</FieldError>
                    </>
                  ) : (
                    <p className="text-foreground py-2">{lastName || t('profileData.empty')}</p>
                  )}
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="email">{t('profileData.email')}</FieldLabel>
                {isEditingProfile ? (
                  <>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        profileForm.clear('email');
                      }}
                      {...profileForm.fieldProps('email')}
                    />
                    <FieldError id={profileForm.errorId('email')}>{profileForm.errors.email}</FieldError>
                  </>
                ) : (
                  <p className="text-foreground py-2">{user?.email}</p>
                )}
              </Field>

              <Field>
                <FieldLabel htmlFor="dateOfBirth">
                  {dateOfBirth
                    ? t('profileData.dateOfBirthWithAge', { age: calculateAge(dateOfBirth) })
                    : t('profileData.dateOfBirth')}
                </FieldLabel>
                {isEditingProfile ? (
                  <>
                    <DatePicker
                      id="dateOfBirth"
                      date={dateOfBirth}
                      onSelect={(date) => {
                        setDateOfBirth(date);
                        profileForm.clear('dateOfBirth');
                      }}
                      placeholder={t('profileData.datePlaceholder')}
                      {...profileForm.fieldProps('dateOfBirth')}
                    />
                    <FieldError id={profileForm.errorId('dateOfBirth')}>{profileForm.errors.dateOfBirth}</FieldError>
                  </>
                ) : (
                  <p className="text-foreground py-2">
                    {dateOfBirth ? format.dateTime(dateOfBirth) : t('profileData.empty')}
                  </p>
                )}
              </Field>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="height">{t('profileData.heightLabel', { unit: heightUnitLabel(unitSystem) })}</FieldLabel>
                  {isEditingProfile ? (
                    <>
                      <Input
                        id="height"
                        type="number"
                        value={height}
                        onChange={(e) => {
                          setHeight(e.target.value);
                          profileForm.clear('height');
                        }}
                        min={bodyLimits(unitSystem).height.min}
                        max={bodyLimits(unitSystem).height.max}
                        step={1}
                        {...profileForm.fieldProps('height')}
                      />
                      <FieldError id={profileForm.errorId('height')}>{profileForm.errors.height}</FieldError>
                    </>
                  ) : (
                    <p className="text-foreground py-2">
                      {height ? t('profileData.heightValue', { height, unit: heightUnitLabel(unitSystem) }) : t('profileData.empty')}
                    </p>
                  )}
                </Field>

                <Field>
                  <FieldLabel htmlFor="weight">{t('profileData.weightLabel', { unit: weightUnitLabel(unitSystem) })}</FieldLabel>
                  {isEditingProfile ? (
                    <>
                      <Input
                        id="weight"
                        type="number"
                        value={weight}
                        onChange={(e) => {
                          setWeight(e.target.value);
                          profileForm.clear('weight');
                        }}
                        min={bodyLimits(unitSystem).weight.min}
                        max={bodyLimits(unitSystem).weight.max}
                        step={0.1}
                        {...profileForm.fieldProps('weight')}
                      />
                      <FieldError id={profileForm.errorId('weight')}>{profileForm.errors.weight}</FieldError>
                    </>
                  ) : (
                    <p className="text-foreground py-2">
                      {weight ? t('profileData.weightValue', { weight, unit: weightUnitLabel(unitSystem) }) : t('profileData.empty')}
                    </p>
                  )}
                </Field>
              </div>
            </FieldGroup>
          </CardContent>
        </Card>

        {/* Unit system (#186): independent of language */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('units.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={unitSystem} onValueChange={handleUnitSystemChange} disabled={unitSaving}>
              <SelectTrigger className="w-48" aria-label={t('units.title')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="METRIC">{t('units.metric')}</SelectItem>
                <SelectItem value="IMPERIAL">{t('units.imperial')}</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Language Section (#179) */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('language.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={localeValue} onValueChange={handleLocaleChange} disabled={localeSaving}>
              <SelectTrigger className="w-48" aria-label={t('language.title')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="de">{t('language.german')}</SelectItem>
                <SelectItem value="en">{t('language.english')}</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* HomeGyms Section */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t('gyms.title')}</CardTitle>
              <Dialog
                open={isAddGymOpen}
                onOpenChange={(open) => {
                  setIsAddGymOpen(open);
                  if (!open) {
                    setNewGymName('');
                    addGymForm.clear('name');
                    addGymForm.clear('homeGyms');
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button>
                    <IconPlus className="mr-2 size-4" />
                    {t('gyms.add')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('gyms.addDialogTitle')}</DialogTitle>
                  </DialogHeader>
                  <div ref={addGymFormRef} className="space-y-4 py-4">
                    <Field>
                      <FieldLabel htmlFor="newGymName">{t('gyms.nameLabel')}</FieldLabel>
                      <Input
                        id="newGymName"
                        value={newGymName}
                        onChange={(e) => {
                          setNewGymName(e.target.value);
                          addGymForm.clear('name');
                          addGymForm.clear('homeGyms');
                        }}
                        placeholder={t('gyms.namePlaceholder')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddGym();
                        }}
                        {...addGymForm.fieldProps('name')}
                      />
                      <FieldError id={addGymForm.errorId('name')}>{addGymForm.errors.name}</FieldError>
                      <FieldError id={addGymForm.errorId('homeGyms')}>{addGymForm.errors.homeGyms}</FieldError>
                    </Field>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={handleAddGym}
                      disabled={loading}
                    >
                      {t('gyms.addSubmit')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>

          <CardContent>
            {homeGyms.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">{t('gyms.empty')}</p>
            ) : (
              <div className="divide-y rounded-md border">
                {homeGyms.map((gym) => (
                  <div
                    key={gym.id}
                    className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <span className="font-medium">{gym.name}</span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingGymId(gym.id);
                          setEditingGymName(gym.name);
                        }}
                      >
                        <IconEdit className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteGymId(gym.id)}
                        disabled={loading}
                        className="text-destructive hover:text-destructive"
                      >
                        <IconTrash className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Gym Dialog */}
        <Dialog
          open={!!editingGymId}
          onOpenChange={(open) => {
            if (!open) {
              setEditingGymId(null);
              editGymForm.clear('name');
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('gyms.editDialogTitle')}</DialogTitle>
            </DialogHeader>
            <div ref={editGymFormRef} className="py-4">
              <Field>
                <FieldLabel htmlFor="editingGymName">{t('gyms.nameLabel')}</FieldLabel>
                <Input
                  id="editingGymName"
                  value={editingGymName}
                  onChange={(e) => {
                    setEditingGymName(e.target.value);
                    editGymForm.clear('name');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && editingGymId) {
                      handleUpdateGym(editingGymId);
                    }
                  }}
                  {...editGymForm.fieldProps('name')}
                />
                <FieldError id={editGymForm.errorId('name')}>{editGymForm.errors.name}</FieldError>
              </Field>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingGymId(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() => editingGymId && handleUpdateGym(editingGymId)}
                disabled={loading}
              >
                {t('common.save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Gym Confirmation */}
        <AlertDialog open={!!deleteGymId} onOpenChange={(open) => !open && setDeleteGymId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('gyms.deleteDialogTitle')}</AlertDialogTitle>
              <AlertDialogDescription>{t('gyms.deleteConfirm')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteGymId && handleDeleteGym(deleteGymId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t('gyms.deleteSubmit')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Security Section */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t('security.title')}</CardTitle>
              <Dialog
                open={isPasswordDialogOpen}
                onOpenChange={(open) => {
                  setIsPasswordDialogOpen(open);
                  if (!open) {
                    passwordForm.setConstraints({
                      currentPassword: null,
                      newPassword: null,
                      confirmNewPassword: null,
                    });
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmNewPassword('');
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <IconLock className="mr-2 size-4" />
                    {t('security.changePassword')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('security.changePassword')}</DialogTitle>
                  </DialogHeader>

                  <div ref={passwordFormRef} className="space-y-4 py-4">
                    <Field>
                      <FieldLabel htmlFor="current-password">{t('security.currentPassword')}</FieldLabel>
                      <Input
                        id="current-password"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => {
                          setCurrentPassword(e.target.value);
                          passwordForm.clear('currentPassword');
                        }}
                        autoComplete="current-password"
                        {...passwordForm.fieldProps('currentPassword')}
                      />
                      <FieldError id={passwordForm.errorId('currentPassword')}>
                        {passwordForm.errors.currentPassword}
                      </FieldError>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="new-password">{t('security.newPassword')}</FieldLabel>
                      <Input
                        id="new-password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          passwordForm.clear('newPassword');
                        }}
                        autoComplete="new-password"
                        {...passwordForm.fieldProps('newPassword')}
                      />
                      <FieldError id={passwordForm.errorId('newPassword')}>
                        {passwordForm.errors.newPassword}
                      </FieldError>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="confirm-new-password">{t('security.confirmNewPassword')}</FieldLabel>
                      <Input
                        id="confirm-new-password"
                        type="password"
                        value={confirmNewPassword}
                        onChange={(e) => {
                          setConfirmNewPassword(e.target.value);
                          passwordForm.clear('confirmNewPassword');
                        }}
                        autoComplete="new-password"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleChangePassword();
                        }}
                        {...passwordForm.fieldProps('confirmNewPassword')}
                      />
                      <FieldError id={passwordForm.errorId('confirmNewPassword')}>
                        {passwordForm.errors.confirmNewPassword}
                      </FieldError>
                    </Field>
                  </div>

                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsPasswordDialogOpen(false)}
                      disabled={passwordLoading}
                    >
                      {t('common.cancel')}
                    </Button>
                    <Button onClick={handleChangePassword} disabled={passwordLoading}>
                      {t('security.changePassword')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t('security.warning')}</p>
          </CardContent>
        </Card>

        {/* Logout Section */}
        <Card>
          <CardContent className="pt-6">
            <LogoutButton variant="destructive" className="w-full" size="lg">
              {t('logout')}
            </LogoutButton>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
