'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

/**
 * The picker's line tabs and their placeholder copy, shared by the logging picker
 * (`food-picker-sheet`) and the Mahlzeit editor's Zutat search (`meal-editor-screen`) so the
 * two surfaces cannot drift (#148).
 *
 * The tab set is a parameter, not a constant: the logging picker splits its long list into
 * separate Lebensmittel and Mahlzeiten tabs, while the Zutat search has no Mahlzeiten tab --
 * a Mahlzeit cannot be an ingredient of another one (#155). Labels live in the shared
 * `PickerTabs` message namespace so both surfaces stay in sync.
 */
export const LOGGING_PICKER_TAB_IDS = ['lebensmittel', 'mahlzeiten', 'favoriten', 'zuletzt'] as const;
export const ZUTAT_PICKER_TAB_IDS = ['lebensmittel', 'favoriten', 'zuletzt'] as const;

export type PickerTabId = (typeof LOGGING_PICKER_TAB_IDS)[number];

export function PickerTabBar({
  tab,
  onTab,
  tabs,
}: {
  tab: PickerTabId;
  onTab: (t: PickerTabId) => void;
  tabs: readonly PickerTabId[];
}) {
  const t = useTranslations('PickerTabs');
  return (
    <div className="flex gap-1 border-b">
      {tabs.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onTab(id)}
          className={cn(
            'relative px-3 py-2 text-xs font-semibold uppercase tracking-[0.05em]',
            tab === id ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {t(id)}
          {tab === id && (
            <span className="absolute inset-x-0 -bottom-px h-0.5 bg-foreground" />
          )}
        </button>
      ))}
    </div>
  );
}

/** The centered muted line a tab shows while loading or when it has nothing to list. */
export function PickerTabPlaceholder({ children }: { children: ReactNode }) {
  return <p className="py-10 text-center text-sm text-muted-foreground">{children}</p>;
}
