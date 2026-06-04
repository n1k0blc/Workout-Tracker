import { PersonalRecord } from '@/types';
import { PersonalRecordCard } from '@/components/PersonalRecordCard';
import { IconTrophy, IconTrendingUp } from '@tabler/icons-react';

interface PRsSlideProps {
  personalRecords: PersonalRecord[];
}

export function PRsSlide({ personalRecords }: PRsSlideProps) {
  return (
    <div className="text-center space-y-6 animate-fadeIn">
      <div className="flex justify-center">
        <div className="p-4 bg-amber-100 dark:bg-amber-900/20 rounded-full">
          <IconTrophy className="h-12 w-12 text-amber-600 dark:text-amber-500" />
        </div>
      </div>

      <h2 className="text-2xl font-semibold text-foreground">
        🎉 Neue Personal Records!
      </h2>

      <div className="space-y-3 max-w-lg mx-auto max-h-[400px] overflow-y-auto pr-2">
        {personalRecords.map((pr, index) => (
          <PersonalRecordCard
            key={index}
            pr={pr}
            showDate={false}
          />
        ))}
      </div>

      <div className="flex items-center justify-center gap-2 text-muted-foreground">
        <IconTrendingUp className="h-5 w-5" />
        <span>Hervorragende Leistung!</span>
      </div>
    </div>
  );
}
