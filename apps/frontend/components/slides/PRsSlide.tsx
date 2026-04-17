import { PersonalRecord } from '@/types';
import { Trophy, TrendingUp } from 'lucide-react';

interface PRsSlideProps {
  personalRecords: PersonalRecord[];
}

export function PRsSlide({ personalRecords }: PRsSlideProps) {
  const formatPRType = (type: string) => {
    switch (type) {
      case 'weight':
        return 'Gewicht';
      case 'reps':
        return 'Wiederholungen';
      case 'volume':
        return 'Volumen';
      case 'one_rm':
        return '1RM';
      default:
        return type;
    }
  };

  const formatPRValue = (pr: PersonalRecord) => {
    switch (pr.type) {
      case 'weight':
        return `${pr.value} kg`;
      case 'reps':
        return `${pr.value} Wdh`;
      case 'volume':
        return `${Math.round(pr.value)} kg`;
      case 'one_rm':
        return `${Math.round(pr.value)} kg`;
      default:
        return `${pr.value}`;
    }
  };

  return (
    <div className="text-center space-y-6 animate-fadeIn">
      <div className="flex justify-center">
        <div className="p-4 bg-yellow-100 rounded-full">
          <Trophy className="h-12 w-12 text-yellow-600" />
        </div>
      </div>
      
      <h2 className="text-2xl font-semibold text-gray-900">
        🎉 Neue Personal Records!
      </h2>
      
      <div className="space-y-3 max-w-lg mx-auto max-h-[400px] overflow-y-auto pr-2">
        {personalRecords.map((pr, index) => (
          <div
            key={index}
            className="bg-gradient-to-r from-yellow-50 to-blue-50 border border-yellow-200 rounded-lg p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 text-left">
                <div className="font-semibold text-gray-900">
                  {pr.exerciseName}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {formatPRType(pr.type)} PR
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">
                  {formatPRValue(pr)}
                </div>
                {pr.details?.weight && pr.details?.reps && (
                  <div className="text-sm text-gray-600 mt-1">
                    {pr.details.weight} kg × {pr.details.reps}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="flex items-center justify-center gap-2 text-gray-500">
        <TrendingUp className="h-5 w-5" />
        <span>Hervorragende Leistung!</span>
      </div>
    </div>
  );
}
