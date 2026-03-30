import { useState } from 'react';
import { CycleFormData, WorkoutDayData } from './cycle-wizard';

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
  const [selectedDays, setSelectedDays] = useState<number[]>(
    formData.workoutDays.map((d) => d.weekday)
  );
  const [dayNames, setDayNames] = useState<Record<number, string>>(
    formData.workoutDays.reduce(
      (acc, d) => ({ ...acc, [d.weekday]: d.name }),
      {}
    )
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
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const updateDayName = (day: number, name: string) => {
    setDayNames({ ...dayNames, [day]: name });
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
          blueprint: existingDay?.blueprint || { exercises: [] },
        };
      });

    updateFormData({ workoutDays });
    onNext();
  };

  const isValid = selectedDays.length > 0;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Wähle deine Trainingstage
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Wähle die Wochentage aus, an denen du trainieren möchtest.
          </p>

          <div className="space-y-3">
            {weekdays.map((weekday) => (
              <div
                key={weekday.value}
                className={`border rounded-lg p-4 transition-colors ${
                  selectedDays.includes(weekday.value)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id={`day-${weekday.value}`}
                    checked={selectedDays.includes(weekday.value)}
                    onChange={() => toggleDay(weekday.value)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <label
                      htmlFor={`day-${weekday.value}`}
                      className="block font-medium text-gray-900 mb-2 cursor-pointer"
                    >
                      {weekday.label}
                    </label>
                    {selectedDays.includes(weekday.value) && (
                      <input
                        type="text"
                        value={dayNames[weekday.value] || ''}
                        onChange={(e) =>
                          updateDayName(weekday.value, e.target.value)
                        }
                        placeholder={`z.B. Push, Pull, Legs, ...`}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
          >
            Zurück
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={!isValid}
            className="flex-1 py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Weiter
          </button>
        </div>
      </div>
    </div>
  );
}
