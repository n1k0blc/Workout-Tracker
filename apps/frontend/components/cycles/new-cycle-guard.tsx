'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { apiClient } from '@/lib/api';
import { notify } from '@/lib/toast';

/**
 * The one gate in front of the Zyklus wizard (#226). Every way in -- the Zyklen page, the
 * dashboard card, a past Zyklus, a typed URL -- lands on the wizard route, so the check lives
 * here and nowhere else. A Zyklus scheduled for the future is `ACTIVE` and counts.
 *
 * If the lookup itself fails the wizard opens anyway: the server rejects a second active
 * Zyklus on save, so a failed lookup costs the user nothing but the early warning.
 */
export function NewCycleGuard({ children }: { children: React.ReactNode }) {
  const t = useTranslations('CycleWizard');
  const router = useRouter();
  const [state, setState] = useState<'checking' | 'open' | 'blocked'>('checking');

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getCycles()
      .then((cycles) => cycles.some((cycle) => cycle.status === 'ACTIVE'))
      .catch(() => false)
      .then((hasActive) => {
        if (cancelled) return;
        if (hasActive) {
          setState('blocked');
          notify.warning(t('activeCycleExists'));
          router.replace('/cycles');
        } else {
          setState('open');
        }
      });
    return () => {
      cancelled = true;
    };
    // Runs once per visit; `t` and `router` identities must not retrigger the redirect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === 'open') return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-lg text-muted-foreground">{t('checking')}</div>
    </div>
  );
}
