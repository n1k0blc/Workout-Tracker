'use client';

import { useAuth } from '@/lib/auth-context';
import { HomeGym } from '@/types';

interface GymLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGym: (homeGymId: string | null) => void;
  plannedHomeGymId?: string | null;
}

export default function GymLocationModal({
  isOpen,
  onClose,
  onSelectGym,
  plannedHomeGymId,
}: GymLocationModalProps) {
  const { user } = useAuth();

  if (!isOpen) return null;

  // Sort home gyms alphabetically
  const homeGyms = [...(user?.homeGyms || [])].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <h2 className="text-2xl font-bold mb-2 text-center">
          Wo trainierst du heute?
        </h2>
        <p className="text-gray-600 text-center mb-6">
          Wähle dein Trainingsort aus
        </p>

        <div className="space-y-3">
          {/* Home Gyms */}
          {homeGyms.map((gym) => {
            const isRecommended = plannedHomeGymId === gym.id;
            return (
              <button
                key={gym.id}
                onClick={() => onSelectGym(gym.id)}
                className="relative w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold py-5 px-6 rounded-lg transition-colors flex flex-col items-center gap-1 text-lg"
              >
                {isRecommended && (
                  <span className="absolute top-2 right-2 text-xs bg-white text-violet-600 px-2 py-1 rounded-full font-medium">
                    Heute empfohlen
                  </span>
                )}
                <span className="text-2xl">🏠</span>
                <span>{gym.name}</span>
              </button>
            );
          })}

          {/* Other Gym */}
          <button
            onClick={() => onSelectGym(null)}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-5 px-6 rounded-lg transition-colors flex flex-col items-center gap-1 text-lg"
          >
            <span className="text-2xl">🏋️</span>
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
