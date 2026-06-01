'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api/client';
import { HomeGym } from '@/types';
import {
  IconUserCircle,
  IconPlus,
  IconX,
  IconEdit,
  IconCheck,
  IconTrash,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
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
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <IconUserCircle className="size-8" />
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
                <p className="text-foreground py-2">{user?.email}</p>
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

        {/* Logout Section */}
        <Card>
          <CardContent className="pt-6">
            <Button
              variant="destructive"
              className="w-full"
              size="lg"
              onClick={handleLogout}
            >
              Abmelden
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
