'use client';

import { useTranslations } from 'next-intl';
import { IconListCheck } from '@tabler/icons-react';

interface SetsSlideProps {
  count: number;
}

export function SetsSlide({ count }: SetsSlideProps) {
  const t = useTranslations('WorkoutCompletion.sets');
  return (
    <div className="text-center space-y-6 animate-fadeIn">
      <div className="flex justify-center">
        <div className="p-4 bg-primary/10 rounded-full">
          <IconListCheck className="h-12 w-12 text-primary" />
        </div>
      </div>

      <h2 className="text-2xl font-semibold text-foreground">
        {t('title')}
      </h2>

      <div className="space-y-2">
        <div className="text-6xl font-bold text-primary">
          {count}
        </div>
        <div className="text-xl text-muted-foreground">
          {t('count', { count })}
        </div>
      </div>

      <p className="text-muted-foreground max-w-md mx-auto">
        {t('description')}
      </p>
    </div>
  );
}
