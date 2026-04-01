'use client';

export type GymLocation = 'HOME' | 'OTHER';

interface GymLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGym: (location: GymLocation) => void;
}

export default function GymLocationModal({
  isOpen,
  onClose,
  onSelectGym,
}: GymLocationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-2xl font-bold mb-2 text-center">
          Wo trainierst du heute?
        </h2>
        <p className="text-gray-600 text-center mb-6">
          Wähle dein Trainingsort aus
        </p>

        <div className="space-y-4">
          <button
            onClick={() => onSelectGym('HOME')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-6 px-6 rounded-lg transition-colors flex flex-col items-center gap-2 text-lg"
          >
            <span className="text-3xl">🏠</span>
            <span>Home Gym</span>
          </button>

          <button
            onClick={() => onSelectGym('OTHER')}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-6 px-6 rounded-lg transition-colors flex flex-col items-center gap-2 text-lg"
          >
            <span className="text-3xl">🏋️</span>
            <span>Anderes Gym</span>
          </button>
        </div>

        <p className="text-xs text-gray-500 text-center mt-4">
          PRs werden nur von Home Gym Workouts gezählt
        </p>
      </div>
    </div>
  );
}
