'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
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
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
  const [passwordError, setPasswordError] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // HomeGyms
  const [homeGyms, setHomeGyms] = useState<HomeGym[]>([]);
  const [newGymName, setNewGymName] = useState('');
  const [editingGymId, setEditingGymId] = useState<string | null>(null);
  const [editingGymName, setEditingGymName] = useState('');

  useEffect(() => {
    if (user) {
      setEmail(user.email || '');
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setDateOfBirth(user.dateOfBirth ? new Date(user.dateOfBirth) : null);
      setHeight(user.height?.toString() || '');
      setWeight(user.weight?.toString() || '');
      setTargetKcal(user.targetKcal?.toString() || '');
      setTargetCarbs(user.targetCarbs?.toString() || '');
      setTargetProtein(user.targetProtein?.toString() || '');
      setTargetFat(user.targetFat?.toString() || '');
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
      if (!email || !firstName || !lastName || !dateOfBirth || !height || !weight) {
        throw new Error('Bitte alle Felder ausfüllen');
      }

      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(email)) {
        throw new Error('Bitte eine gültige Email-Adresse angeben');
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
        email,
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

  /** A blank Tagesziel field clears the target (null); otherwise it must be a whole number in range. */
  const parseTargetField = (raw: string, label: string, max: number): number | null => {
    const trimmed = raw.trim();
    if (trimmed === '') return null;
    const value = Number(trimmed);
    if (!Number.isInteger(value) || value < 1 || value > max) {
      throw new Error(`${label} muss eine ganze Zahl zwischen 1 und ${max} sein`);
    }
    return value;
  };

  const handleUpdateTargets = async () => {
    setError('');
    setSuccess('');
    setTargetsLoading(true);

    try {
      const payload = {
        targetKcal: parseTargetField(targetKcal, 'Kalorienziel', 20000),
        targetCarbs: parseTargetField(targetCarbs, 'Kohlenhydrate-Ziel', 2000),
        targetProtein: parseTargetField(targetProtein, 'Protein-Ziel', 2000),
        targetFat: parseTargetField(targetFat, 'Fett-Ziel', 2000),
      };

      await apiClient.updateProfile(payload);

      setSuccess('Tagesziele gespeichert');
      setIsEditingTargets(false);
      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern der Tagesziele');
    } finally {
      setTargetsLoading(false);
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

  const handleChangePassword = async () => {
    setPasswordError('');

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPasswordError('Bitte alle Felder ausfüllen');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('Neues Passwort muss mindestens 8 Zeichen lang sein');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError('Die Passwörter stimmen nicht überein');
      return;
    }

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
      setPasswordError(err.message || 'Fehler beim Ändern des Passworts');
    } finally {
      setPasswordLoading(false);
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
            Mein Profil
          </h1>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-4">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Tagesziele Section (#152) */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Tagesziele</CardTitle>
            {!isEditingTargets ? (
              <Button variant="outline" onClick={() => setIsEditingTargets(true)}>
                <IconEdit className="mr-2 size-4" />
                Bearbeiten
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditingTargets(false);
                    setTargetKcal(user?.targetKcal?.toString() || '');
                    setTargetCarbs(user?.targetCarbs?.toString() || '');
                    setTargetProtein(user?.targetProtein?.toString() || '');
                    setTargetFat(user?.targetFat?.toString() || '');
                  }}
                >
                  Abbrechen
                </Button>
                <Button onClick={handleUpdateTargets} disabled={targetsLoading}>
                  <IconCheck className="mr-2 size-4" />
                  Speichern
                </Button>
              </div>
            )}
          </CardHeader>

          <CardContent>
            {!isEditingTargets && !anyTargetSet ? (
              <p className="text-sm text-muted-foreground">
                Noch keine Tagesziele festgelegt. Ohne Ziele zeigt die Tagesansicht nur die
                erfassten Summen.
              </p>
            ) : (
              <div className="space-y-5">
                <Field>
                  <FieldLabel>Kalorien</FieldLabel>
                  {isEditingTargets ? (
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={targetKcal}
                      onChange={(e) => setTargetKcal(e.target.value)}
                      min="1"
                      max="20000"
                      placeholder="z.B. 2400"
                    />
                  ) : (
                    <p className="flex items-baseline gap-1.5 py-2">
                      <span className="text-2xl font-bold">
                        {targetKcal.trim() ? formatKcal(Number(targetKcal)) : '–'}
                      </span>
                      <span className="text-sm text-muted-foreground">kcal / Tag</span>
                    </p>
                  )}
                </Field>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Kohlenh.', value: targetCarbs, set: setTargetCarbs },
                    { label: 'Protein', value: targetProtein, set: setTargetProtein },
                    { label: 'Fett', value: targetFat, set: setTargetFat },
                  ].map((f) => (
                    <Field key={f.label}>
                      <FieldLabel>{f.label}</FieldLabel>
                      {isEditingTargets ? (
                        <Input
                          type="number"
                          inputMode="numeric"
                          value={f.value}
                          onChange={(e) => f.set(e.target.value)}
                          min="1"
                          max="2000"
                          placeholder="g"
                        />
                      ) : (
                        <p className="py-2">
                          <span className="text-base font-semibold">
                            {f.value.trim() ? Number(f.value) : '–'}
                          </span>
                          <span className="text-xs text-muted-foreground"> g</span>
                        </p>
                      )}
                    </Field>
                  ))}
                </div>

                {(isEditingTargets || anyTargetSet) && (
                  <div className="border-t pt-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Makros ergeben</span>
                      <span className="text-[13px] font-semibold">
                        {formatKcal(targetMacroKcal)} kcal
                      </span>
                    </div>
                    <MacroProgressBar percent={targetBarPercent} className="mt-2.5" />
                    {targetHint && (
                      <p className="mt-2.5 text-xs text-muted-foreground">{targetHint}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Profile Section */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Profildaten</CardTitle>
            {!isEditingProfile ? (
              <Button
                variant="outline"
                onClick={() => setIsEditingProfile(true)}
              >
                <IconEdit className="mr-2 size-4" />
                Bearbeiten
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsEditingProfile(false)}
                >
                  Abbrechen
                </Button>
                <Button
                  onClick={handleUpdateProfile}
                  disabled={loading}
                >
                  <IconCheck className="mr-2 size-4" />
                  Speichern
                </Button>
              </div>
            )}
          </CardHeader>

          <CardContent>
            <FieldGroup>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field>
                  <FieldLabel>Vorname</FieldLabel>
                  {isEditingProfile ? (
                    <Input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  ) : (
                    <p className="text-foreground py-2">{firstName || '-'}</p>
                  )}
                </Field>

                <Field>
                  <FieldLabel>Nachname</FieldLabel>
                  {isEditingProfile ? (
                    <Input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  ) : (
                    <p className="text-foreground py-2">{lastName || '-'}</p>
                  )}
                </Field>
              </div>

              <Field>
                <FieldLabel>Email</FieldLabel>
                {isEditingProfile ? (
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                ) : (
                  <p className="text-foreground py-2">{user?.email}</p>
                )}
              </Field>

              <Field>
                <FieldLabel>
                  Geburtsdatum {dateOfBirth && `(${calculateAge(dateOfBirth)} Jahre)`}
                </FieldLabel>
                {isEditingProfile ? (
                  <DatePicker
                    date={dateOfBirth}
                    onSelect={setDateOfBirth}
                    placeholder="TT.MM.JJJJ"
                  />
                ) : (
                  <p className="text-foreground py-2">
                    {dateOfBirth ? dateOfBirth.toLocaleDateString('de-DE') : '-'}
                  </p>
                )}
              </Field>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field>
                  <FieldLabel>Größe (cm)</FieldLabel>
                  {isEditingProfile ? (
                    <Input
                      type="number"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      min="50"
                      max="300"
                    />
                  ) : (
                    <p className="text-foreground py-2">{height ? `${height} cm` : '-'}</p>
                  )}
                </Field>

                <Field>
                  <FieldLabel>Gewicht (kg)</FieldLabel>
                  {isEditingProfile ? (
                    <Input
                      type="number"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      min="20"
                      max="500"
                      step="0.1"
                    />
                  ) : (
                    <p className="text-foreground py-2">{weight ? `${weight} kg` : '-'}</p>
                  )}
                </Field>
              </div>
            </FieldGroup>
          </CardContent>
        </Card>

        {/* HomeGyms Section */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Meine Gyms</CardTitle>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <IconPlus className="mr-2 size-4" />
                    Gym hinzufügen
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Neues Gym hinzufügen</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <Field>
                      <FieldLabel>Gym-Name</FieldLabel>
                      <Input
                        value={newGymName}
                        onChange={(e) => setNewGymName(e.target.value)}
                        placeholder="z.B. Fitness Studio Mitte"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddGym();
                        }}
                      />
                    </Field>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={handleAddGym}
                      disabled={loading || !newGymName.trim()}
                    >
                      Hinzufügen
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>

          <CardContent>
            {homeGyms.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Noch keine Gyms hinzugefügt
              </p>
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
                        onClick={() => handleDeleteGym(gym.id)}
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
        <Dialog open={!!editingGymId} onOpenChange={(open) => !open && setEditingGymId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Gym bearbeiten</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Field>
                <FieldLabel>Gym-Name</FieldLabel>
                <Input
                  value={editingGymName}
                  onChange={(e) => setEditingGymName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && editingGymId) {
                      handleUpdateGym(editingGymId);
                    }
                  }}
                />
              </Field>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingGymId(null)}>
                Abbrechen
              </Button>
              <Button
                onClick={() => editingGymId && handleUpdateGym(editingGymId)}
                disabled={loading || !editingGymName.trim()}
              >
                Speichern
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Security Section */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Sicherheit</CardTitle>
              <Dialog
                open={isPasswordDialogOpen}
                onOpenChange={(open) => {
                  setIsPasswordDialogOpen(open);
                  if (!open) {
                    setPasswordError('');
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmNewPassword('');
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <IconLock className="mr-2 size-4" />
                    Passwort ändern
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Passwort ändern</DialogTitle>
                  </DialogHeader>

                  {passwordError && (
                    <Alert variant="destructive">
                      <AlertDescription>{passwordError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-4 py-4">
                    <Field>
                      <FieldLabel>Aktuelles Passwort</FieldLabel>
                      <Input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        autoComplete="current-password"
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Neues Passwort</FieldLabel>
                      <Input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Neues Passwort bestätigen</FieldLabel>
                      <Input
                        type="password"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        autoComplete="new-password"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleChangePassword();
                        }}
                      />
                    </Field>
                  </div>

                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsPasswordDialogOpen(false)}
                      disabled={passwordLoading}
                    >
                      Abbrechen
                    </Button>
                    <Button onClick={handleChangePassword} disabled={passwordLoading}>
                      Passwort ändern
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Nach dem Ändern deines Passworts wirst du überall abgemeldet und musst dich erneut anmelden.
            </p>
          </CardContent>
        </Card>

        {/* Logout Section */}
        <Card>
          <CardContent className="pt-6">
            <LogoutButton variant="destructive" className="w-full" size="lg">
              Abmelden
            </LogoutButton>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
