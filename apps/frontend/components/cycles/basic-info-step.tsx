import { CycleFormData } from './cycle-wizard';

interface BasicInfoStepProps {
  formData: CycleFormData;
  updateFormData: (data: Partial<CycleFormData>) => void;
  onNext: () => void;
}

export default function BasicInfoStep({
  formData,
  updateFormData,
  onNext,
}: BasicInfoStepProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  const isValid = formData.name.trim().length > 0 && formData.duration > 0;

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
      <div className="space-y-6">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Zyklus-Name *
          </label>
          <input
            type="text"
            id="name"
            value={formData.name}
            onChange={(e) => updateFormData({ name: e.target.value })}
            placeholder="z.B. Push/Pull/Legs 8 Wochen"
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="duration"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Dauer (Wochen) *
          </label>
          <input
            type="number"
            id="duration"
            value={formData.duration}
            onChange={(e) =>
              updateFormData({ duration: parseInt(e.target.value) })
            }
            min="1"
            max="52"
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-sm text-gray-600">
            Wie viele Wochen soll dieser Zyklus dauern? (1-52)
          </p>
        </div>

        <div>
          <label
            htmlFor="startDate"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Start-Datum *
          </label>
          <input
            type="date"
            id="startDate"
            value={formData.startDate}
            onChange={(e) => updateFormData({ startDate: e.target.value })}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={!isValid}
            className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Weiter
          </button>
        </div>
      </div>
    </form>
  );
}
