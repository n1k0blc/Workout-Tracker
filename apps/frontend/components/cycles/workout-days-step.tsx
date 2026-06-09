import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { CycleFormData, WorkoutDayData } from './cycle-wizard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

interface WorkoutDaysStepProps {
  formData: CycleFormData;
  updateFormData: (data: Partial<CycleFormData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function WorkoutDaysStep({
  formData,
  updateFormData,
  onNext,
  onBack,
}: WorkoutDaysStepProps) {
  const { user } = useAuth();
  const [selectedDays, setSelectedDays] = useState<number[]>(
    formData.workoutDays.map((d) => d.weekday)
  );
  const [dayNames, setDayNames] = useState<Record<number, string>>(
    formData.workoutDays.reduce(
      (acc, d) => ({ ...acc, [d.weekday]: d.name }),
      {}
    )
  );
  const [dayGyms, setDayGyms] = useState<Record<number, string>>(
    formData.workoutDays.reduce(
      (acc, d) => ({ ...acc, [d.weekday]: d.plannedHomeGymId || '' }),
      {}
    )
  );

  // Sort home gyms alphabetically
  const homeGyms = [...(user?.homeGyms || [])].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const weekdays = [
    { value: 1, label: 'Montag' },
    { value: 2, label: 'Dienstag' },
    { value: 3, label: 'Mittwoch' },
    { value: 4, label: 'Donnerstag' },
    { value: 5, label: 'Freitag' },
    { value: 6, label: 'Samstag' },
    { value: 0, label: 'Sonntag' },
  ];

  const toggleDay = (day: number) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter((d) => d !== day));
      const newDayNames = { ...dayNames };
      delete newDayNames[day];
      setDayNames(newDayNames);
      const newDayGyms = { ...dayGyms };
      delete newDayGyms[day];
      setDayGyms(newDayGyms);
    } else {
      setSelectedDays([...selectedDays, day]);
      // Set first home gym as default
      if (homeGyms.length > 0) {
        setDayGyms({ ...dayGyms, [day]: homeGyms[0].id });
      }
    }
  };

  const updateDayName = (day: number, name: string) => {
    setDayNames({ ...dayNames, [day]: name });
  };

  const updateDayGym = (day: number, gymId: string) => {
    setDayGyms({ ...dayGyms, [day]: gymId });
  };

  const handleNext = () => {
    const workoutDays: WorkoutDayData[] = selectedDays
      .sort((a, b) => {
        // Sort Sunday (0) to end
        if (a === 0) return 1;
        if (b === 0) return -1;
        return a - b;
      })
      .map((day, index) => {
        // Find existing day or create new one
        const existingDay = formData.workoutDays.find((d) => d.weekday === day);
        return {
          weekday: day,
          name: dayNames[day] || weekdays.find((w) => w.value === day)?.label || `Tag ${index + 1}`,
          plannedHomeGymId: dayGyms[day] || (homeGyms.length > 0 ? homeGyms[0].id : undefined),
          blueprint: existingDay?.blueprint || { exercises: [] },
        };
      });

    updateFormData({ workoutDays });
    onNext();
  };

  const isValid = selectedDays.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Wähle deine Trainingstage
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Wähle die Wochentage aus, an denen du trainieren möchtest.
        </p>

        <div className="space-y-3">
          {weekdays.map((weekday) => {
            const isSelected = selectedDays.includes(weekday.value);
            return (
              <Card
                key={weekday.value}
                className={`transition-colors cursor-pointer ${
                  isSelected ? 'border-primary ring-1 ring-primary/20' : 'hover:border-border'
                }`}
                onClick={() => toggleDay(weekday.value)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id={`day-${weekday.value}`}
                      checked={isSelected}
                      onChange={() => toggleDay(weekday.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 accent-primary"
                    />
                    <div className="flex-1">
                      <Label
                        htmlFor={`day-${weekday.value}`}
                        className="font-medium text-foreground mb-2 cursor-pointer block"
                      >
                        {weekday.label}
                      </Label>
                      {isSelected && (
                        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                          <Input
                            type="text"
                            value={dayNames[weekday.value] || ''}
                            onChange={(e) =>
                              updateDayName(weekday.value, e.target.value)
                            }
                            placeholder={`z.B. Push, Pull, Legs, ...`}
                            className="text-sm"
                          />
                          <select
                            value={dayGyms[weekday.value] || ''}
                            onChange={(e) =>
                              updateDayGym(weekday.value, e.target.value)
                            }
                            className="w-full px-3 py-2 border border-input bg-background text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            {homeGyms.map((gym) => (
                              <option key={gym.id} value={gym.id}>
                                {gym.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="flex-1"
        >
          Zurück
        </Button>
        <Button
          type="button"
          onClick={handleNext}
          disabled={!isValid}
          className="flex-1"
        >
          Weiter
        </Button>
      </div>
    </div>
  );
}
