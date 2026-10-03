'use client';

import { useCallback } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { PrefillToast } from '@/lib/last-performance';
import { fromLocalDateString } from '@/lib/local-date';

/**
 * Shows the one prefill toast (issue #112) in the user's locale: the date and gym the values
 * came from, a note when the lookup degraded to another gym, and a hint when history had a
 * different number of sets than the plan. `buildPrefillToast` decides *what* to say; this words it.
 */
export function usePrefillToast() {
  const t = useTranslations('PrefillToast');
  const format = useFormatter();

  return useCallback(
    (info: PrefillToast) => {
      const parts = [
        t('message', {
          date: format.dateTime(fromLocalDateString(info.performedOn), {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          }),
          gym: info.gymName ?? t('otherGym'),
        }),
      ];
      if (info.degraded) {
        parts.push(info.degraded === 'HOME_GYM' ? t('fallbackHomeGym') : t('fallbackAnyGym'));
      }
      if (info.setCountMismatch) parts.push(t('setCountMismatch'));
      toast.info(parts.join(' '), { duration: info.durationMs });
    },
    [t, format],
  );
}
