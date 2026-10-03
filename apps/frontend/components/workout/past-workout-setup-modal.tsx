'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IconDumbbell, IconCalendar, IconTemplate, IconArrowLeft } from '@tabler/icons-react';

interface PastWorkoutSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChooseFree: () => void;
  onChooseCycle: () => void;
  onChooseTemplate: () => void;
}

export default function PastWorkoutSetupModal({
  isOpen,
  onClose,
  onChooseFree,
  onChooseCycle,
  onChooseTemplate,
}: PastWorkoutSetupModalProps) {
  const t = useTranslations('WorkoutStart.pastSetupModal');
  const handleTypeSelection = (type: 'free' | 'cycle' | 'template') => {
    if (type === 'free') {
      onChooseFree();
    } else if (type === 'cycle') {
      onChooseCycle();
    } else {
      onChooseTemplate();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">{t('title')}</DialogTitle>
          <DialogDescription className="text-center">
            {t('description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <Button
            onClick={() => handleTypeSelection('free')}
            className="w-full h-auto py-5 flex flex-col items-center gap-2 text-base"
            variant="default"
          >
            <IconDumbbell className="size-6" />
            <span>{t('free')}</span>
          </Button>

          <Button
            onClick={() => handleTypeSelection('cycle')}
            className="w-full h-auto py-5 flex flex-col items-center gap-2 text-base"
          >
            <IconCalendar className="size-6" />
            <span>{t('cycle')}</span>
          </Button>

          <Button
            onClick={() => handleTypeSelection('template')}
            className="w-full h-auto py-5 flex flex-col items-center gap-2 text-base"
          >
            <IconTemplate className="size-6" />
            <span>{t('template')}</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
